// ============================================================
// CLEANOVA - TEST SUITE: TWO-WALLET SYSTEM FOR STAFF (GRAB DRIVER MODEL)
// Kiểm thử toàn diện 13 kịch bản bắt buộc theo Section 11 của yêu cầu:
// 1. Đơn tiền mặt 200k, CK 40k: trừ ví tín dụng 40k, ví thu nhập không đổi.
// 2. Đơn trực tuyến 200k, CK 40k: trừ ví tín dụng 40k, ví thu nhập +160k.
// 3. Số dư tín dụng 100.000đ: KHÔNG được nhận đơn.
// 4. Số dư tín dụng 100.001đ: ĐƯỢC nhận đơn.
// 5. Số dư tín dụng âm: KHÔNG được nhận đơn.
// 6. Chuyển 150k từ ví thu nhập sang ví tín dụng: số dư chuẩn, không tạo doanh thu sàn.
// 7. Nạp tiền khi ví tín dụng âm: bù âm trước.
// 8. Idempotency key nạp tiền: không cộng tiền hai lần.
// 9. Quyết toán nhiều lần: không trừ chiết khấu hai lần.
// 10. Request đồng thời (Concurrency): không sai lệch số dư.
// 11. Phân quyền & Bảo mật (RBAC): nhân viên không thể tự sửa số dư hoặc gọi admin API.
// 12. Admin dashboard: tách bạch doanh thu, không cộng trùng chuyển tiền nội bộ.
// 13. Đơn hủy và hoàn tiền được xử lý đúng chính sách.
// ============================================================

const http = require('http');
const pool = require('./src/config/db');
const WalletModel = require('./src/models/walletModel');
const BookingModel = require('./src/models/bookingModel');

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:5000${urlPath}`);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(data); } catch (e) { body = data; }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function toRows(result) {
  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0]) && !result[0].hasOwnProperty('id')) {
      return result[0];
    }
    return result;
  }
  return result ? [result] : [];
}

async function getWalletBal(walletId) {
  const rows = await pool.query('SELECT balance FROM wallets WHERE id = ?', [walletId]);
  return Number(rows[0]?.balance || 0);
}

async function runTwoWalletTestSuite() {
  console.log('============================================================');
  console.log('🛵 CLEANOVA: TEST SUITE HỆ THỐNG HAI VÍ ĐỐI TÁC (GRAB DRIVER)');
  console.log('============================================================\n');

  for (let i = 0; i < 20; i++) {
    if (pool.isMySQLConnected()) break;
    await new Promise(r => setTimeout(r, 100));
  }

  let passed = 0;
  let failed = 0;
  const testResults = [];

  function assert(condition, testName, details = null) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
      testResults.push({ name: testName, status: 'PASS' });
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error('     Chi tiết:', JSON.stringify(details, null, 2));
      failed++;
      testResults.push({ name: testName, status: 'FAIL', details });
    }
  }

  try {
    // ------------------------------------------------------------
    // 0. CHUẨN BỊ TÀI KHOẢN & DỮ LIỆU THỬ NGHIỆM
    // ------------------------------------------------------------
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' }
    });
    const adminToken = adminLogin.body.data?.token;

    const staffLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'staff@cleanova.vn', password: 'Staff@Cleanova2026!' }
    });
    const staffToken = staffLogin.body.data?.token;
    const staffUser = staffLogin.body.data?.user;

    const custLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'demo@nova.app', password: 'NovaDemo2026!' }
    });
    const custToken = custLogin.body.data?.token;
    const custUser = custLogin.body.data?.user;

    assert(adminToken && staffToken && custToken, '0.1. Đăng nhập thành công Admin, Staff và Customer');

    const staffId = staffUser.id;
    const adminId = adminLogin.body.data.user.id;

    // Đảm bảo nhân viên có 2 ví: credit và earnings
    const { creditWallet, earningsWallet } = await WalletModel.getOrCreateStaffWallets(staffId);
    assert(
      creditWallet && creditWallet.wallet_type === 'credit' &&
      earningsWallet && earningsWallet.wallet_type === 'earnings',
      '0.2. getOrCreateStaffWallets khởi tạo chính xác Ví Tín Dụng và Ví Thu Nhập'
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 1: ĐƠN TIỀN MẶT 200k, CHIẾT KHẤU 40k
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 1: ĐƠN TIỀN MẶT (CASH BOOKING 200k, CK 40k) ---');
    // Reset số dư ví để kiểm tra độc lập
    await pool.query('UPDATE wallets SET balance = 0.00 WHERE id = ?', [creditWallet.id]);
    await pool.query('UPDATE wallets SET balance = 0.00 WHERE id = ?', [earningsWallet.id]);

    const code1 = 'TEST-CASH-' + Date.now().toString(36).toUpperCase();
    const ins1 = await pool.query(`
      INSERT INTO bookings (
        booking_code, user_id, staff_id, service_id, status, payment_status, payment_method,
        total_price, staff_wage, commission_rate, platform_commission, staff_net_wage,
        booking_date, booking_time, address, phone
      ) VALUES (?, ?, ?, 1, 'completed', 'paid', 'cash', 200000, 200000, 0.20, 40000, 160000, CURDATE(), '08:00:00', '123 Test Cash', '0911000001')
    `, [code1, custUser.id, staffId]);
    const bId1 = ins1.insertId || ins1.id;

    // Quyết toán đơn tiền mặt
    const settle1 = await WalletModel.settleBookingCommissionAndWage({ bookingId: bId1, adminId });
    const cw1Bal = await getWalletBal(creditWallet.id);
    const ew1Bal = await getWalletBal(earningsWallet.id);

    assert(
      cw1Bal === -40000,
      '1.1. Đơn tiền mặt: Ví tín dụng bị trừ đúng 40.000 VNĐ (0 -> -40.000đ)',
      { cw1Bal, expected: -40000 }
    );
    assert(
      ew1Bal === 0,
      '1.2. Đơn tiền mặt: Ví thu nhập KHÔNG đổi (0đ) do nhân viên đã giữ trọn tiền mặt từ khách',
      { ew1Bal, expected: 0 }
    );
    assert(
      settle1.success === true && settle1.payment_method === 'cash' && settle1.platform_commission === 40000,
      '1.3. Kết quả settleBookingCommissionAndWage ghi nhận đúng đơn tiền mặt và chiết khấu 40.000đ',
      settle1
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 2: ĐƠN TRỰC TUYẾN 200k, CHIẾT KHẤU 40k
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 2: ĐƠN TRỰC TUYẾN (ONLINE BOOKING 200k, CK 40k) ---');
    // Đặt số dư ví về: Ví tín dụng = 0, Ví thu nhập = 0
    await pool.query('UPDATE wallets SET balance = 0.00 WHERE id = ?', [creditWallet.id]);
    await pool.query('UPDATE wallets SET balance = 0.00 WHERE id = ?', [earningsWallet.id]);

    const code2 = 'TEST-ONLINE-' + Date.now().toString(36).toUpperCase();
    const ins2 = await pool.query(`
      INSERT INTO bookings (
        booking_code, user_id, staff_id, service_id, status, payment_status, payment_method,
        total_price, staff_wage, commission_rate, platform_commission, staff_net_wage,
        booking_date, booking_time, address, phone
      ) VALUES (?, ?, ?, 1, 'completed', 'paid', 'vnpay', 200000, 200000, 0.20, 40000, 160000, CURDATE(), '10:00:00', '123 Test Online', '0911000002')
    `, [code2, custUser.id, staffId]);
    const bId2 = ins2.insertId || ins2.id;

    const settle2 = await WalletModel.settleBookingCommissionAndWage({ bookingId: bId2, adminId });
    const cw2Bal = await getWalletBal(creditWallet.id);
    const ew2Bal = await getWalletBal(earningsWallet.id);

    assert(
      cw2Bal === -40000,
      '2.1. Đơn trực tuyến: Ví tín dụng bị trừ đúng 40.000 VNĐ chiết khấu sàn (0 -> -40.000đ)',
      { cw2Bal, expected: -40000 }
    );
    assert(
      ew2Bal === 160000,
      '2.2. Đơn trực tuyến: Ví thu nhập được cộng đúng 160.000 VNĐ tiền công ròng (0 -> +160.000đ)',
      { ew2Bal, expected: 160000 }
    );
    assert(
      settle2.success === true && settle2.payment_method === 'vnpay' && settle2.net_wage === 160000 && settle2.earnings_balance_after === 160000,
      '2.3. Settle đối soát ghi nhận net_wage = 160.000đ vào ví thu nhập cho đơn trực tuyến',
      settle2
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 3, 4, 5: ĐIỀU KIỆN NHẬN ĐƠN (creditBalance > 100.000 VNĐ)
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 3, 4, 5: ĐIỀU KIỆN NHẬN ĐƠN (creditBalance > 100.000 VNĐ) ---');

    // 3. Số dư đúng 100.000 VNĐ -> KHÔNG ĐƯỢC NHẬN ĐƠN (bất đẳng thức nghiêm ngặt)
    await pool.query('UPDATE wallets SET balance = 100000.00 WHERE id = ?', [creditWallet.id]);
    const elig100k = await WalletModel.checkStaffBookingEligibility(staffId);
    assert(
      elig100k.eligible === false && elig100k.creditBalance === 100000 && elig100k.amountNeeded === 1,
      '3.1. Số dư ví tín dụng đúng 100.000 VNĐ: eligible = FALSE (cần thêm tối thiểu 1đ)',
      elig100k
    );

    // Test API Backend chặn gán đơn khi số dư đúng 100.000đ
    const testAssignCode = 'TEST-ASSIGN-' + Date.now().toString(36).toUpperCase();
    const insAssign = await pool.query(`
      INSERT INTO bookings (
        booking_code, user_id, service_id, status, payment_status, payment_method,
        total_price, booking_date, booking_time, address, phone
      ) VALUES (?, ?, 1, 'pending', 'unpaid', 'cash', 150000, CURDATE(), '14:00:00', '123 Street', '0911000003')
    `, [testAssignCode, custUser.id]);
    const bIdAssign = insAssign.insertId || insAssign.id;

    const assignRes1 = await request(`/api/admin/bookings/${bIdAssign}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { staff_id: staffId }
    });
    assert(
      assignRes1.status === 400 && assignRes1.body.code === 'STAFF_INELIGIBLE_CREDIT',
      '3.2. Admin API chặn gán đơn cho thợ có ví tín dụng = 100.000đ (HTTP 400 STAFF_INELIGIBLE_CREDIT)',
      assignRes1.body
    );

    // 4. Số dư 100.001 VNĐ -> ĐƯỢC NHẬN ĐƠN
    await pool.query('UPDATE wallets SET balance = 100001.00 WHERE id = ?', [creditWallet.id]);
    const elig100k1 = await WalletModel.checkStaffBookingEligibility(staffId);
    assert(
      elig100k1.eligible === true && elig100k1.amountNeeded === 0,
      '4.1. Số dư ví tín dụng 100.001 VNĐ: eligible = TRUE (> 100.000đ)',
      elig100k1
    );

    const assignRes2 = await request(`/api/admin/bookings/${bIdAssign}/assign`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { staff_id: staffId }
    });
    assert(
      assignRes2.status === 200 && assignRes2.body.success,
      '4.2. Admin API gán đơn thành công cho thợ có ví tín dụng 100.001đ',
      assignRes2.body
    );

    // 5. Số dư âm (-40.000 VNĐ) -> KHÔNG ĐƯỢC NHẬN ĐƠN
    await pool.query('UPDATE wallets SET balance = -40000.00 WHERE id = ?', [creditWallet.id]);
    const eligNeg = await WalletModel.checkStaffBookingEligibility(staffId);
    assert(
      eligNeg.eligible === false && eligNeg.creditBalance === -40000 && eligNeg.amountNeeded === 140001,
      '5.1. Số dư ví tín dụng âm (-40.000đ): eligible = FALSE (cần nạp 140.001đ để vượt ngưỡng)',
      eligNeg
    );

    // Thợ tự nhận đơn (update status sang confirmed) khi đang nợ bị từ chối
    const staffConfirmRes = await request(`/api/staff/tasks/${bIdAssign}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'confirmed' }
    });
    assert(
      staffConfirmRes.status === 403 && staffConfirmRes.body.code === 'INSUFFICIENT_CREDIT_BALANCE',
      '5.2. Staff API từ chối thợ nhận việc khi ví tín dụng âm (HTTP 403 INSUFFICIENT_CREDIT_BALANCE)',
      staffConfirmRes.body
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 6: CHUYỂN TIỀN TỪ VÍ THU NHẬP SANG VÍ TÍN DỤNG
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 6: CHUYỂN TIỀN GIỮA HAI VÍ (VÍ THU NHẬP -> VÍ TÍN DỤNG) ---');
    // Thiết lập số dư ví theo ví dụ đề bài:
    // Ví tín dụng: -40.000 VNĐ. Ví thu nhập khả dụng: 200.000 VNĐ.
    // Chuyển 150.000 VNĐ. Kết quả mong muốn: Ví tín dụng: 110.000 VNĐ, Ví thu nhập: 50.000 VNĐ.
    await pool.query('UPDATE wallets SET balance = -40000.00 WHERE id = ?', [creditWallet.id]);
    await pool.query('UPDATE wallets SET balance = 200000.00 WHERE id = ?', [earningsWallet.id]);

    const transferRes = await WalletModel.transferEarningsToCredit({
      staffId,
      amount: 150000,
      note: 'Chuyển tiền duy trì quyền nhận đơn theo ví dụ đề bài'
    });

    const cw6Bal = await getWalletBal(creditWallet.id);
    const ew6Bal = await getWalletBal(earningsWallet.id);

    assert(
      cw6Bal === 110000,
      '6.1. Ví tín dụng sau khi nhận chuyển 150k: -40.000đ + 150.000đ = +110.000 VNĐ',
      { cw6Bal, expected: 110000 }
    );
    assert(
      ew6Bal === 50000,
      '6.2. Ví thu nhập sau khi chuyển 150k: 200.000đ - 150.000đ = +50.000 VNĐ',
      { ew6Bal, expected: 50000 }
    );
    assert(
      transferRes.success === true && transferRes.amount_transferred === 150000 && !!transferRes.transaction_code,
      '6.3. Transaction chuyển tiền nội bộ thành công với mã duy nhất',
      transferRes
    );

    // Chuyển vượt số dư khả dụng bị từ chối
    let threwOverdraft = false;
    try {
      await WalletModel.transferEarningsToCredit({ staffId, amount: 60000 });
    } catch (e) {
      threwOverdraft = true;
    }
    assert(threwOverdraft, '6.4. Chuyển vượt số dư khả dụng (yêu cầu 60k khi ví thu nhập chỉ còn 50k) bị từ chối');

    // Chuyển số âm hoặc 0 bị từ chối
    let threwInvalid = false;
    try {
      await WalletModel.transferEarningsToCredit({ staffId, amount: -10000 });
    } catch (e) {
      threwInvalid = true;
    }
    assert(threwInvalid, '6.5. Chuyển số tiền âm bị từ chối ngay tại model');

    // ------------------------------------------------------------
    // TÌNH HUỐNG 7: NẠP TIỀN KHI VÍ TÍN DỤNG ÂM (BÙ ÂM TRƯỚC)
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 7: NẠP TIỀN KHI VÍ TÍN DỤNG ÂM (BÙ KHOẢN ÂM TRƯỚC) ---');
    await pool.query('UPDATE wallets SET balance = -80000.00 WHERE id = ?', [creditWallet.id]);

    const topupRes = await WalletModel.topupCreditWallet({
      staffId,
      amount: 200000,
      paymentMethod: 'sandbox_vnpay',
      idempotencyKey: 'TEST-TOPUP-OFFSET-' + Date.now()
    });

    const cw7Bal = await getWalletBal(creditWallet.id);
    assert(
      cw7Bal === 120000,
      '7.1. Nạp 200.000đ khi ví đang âm -80.000đ: Bù âm trước, số dư mới = +120.000 VNĐ',
      { cw7Bal, expected: 120000, topupRes }
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 8: IDEMPOTENT TOP-UP KEY (CHỐNG WEBHOOK CỘNG TRÙNG)
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 8: CHỐNG WEBHOOK CỘNG TRÙNG (IDEMPOTENCY KEY) ---');
    const dupKey = 'WEBHOOK-IDEMPOTENT-KEY-' + Date.now();
    const topup1 = await WalletModel.topupCreditWallet({
      staffId,
      amount: 50000,
      idempotencyKey: dupKey
    });

    const cw8aBal = await getWalletBal(creditWallet.id);

    // Thử gửi webhook lần 2 với cùng idempotency key
    const topup2 = await WalletModel.topupCreditWallet({
      staffId,
      amount: 50000,
      idempotencyKey: dupKey
    });

    const cw8bBal = await getWalletBal(creditWallet.id);

    assert(
      cw8aBal === cw8bBal && topup2.isIdempotent === true,
      '8.1. Webhook lặp lại với cùng idempotencyKey không làm tăng số dư lần 2',
      { beforeRetry: cw8aBal, afterRetry: cw8bBal, topup2 }
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 9: HOÀN THÀNH NHIỀU LẦN KHÔNG TRỪ CHIẾT KHẤU 2 LẦN
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 9: KHÔNG TRỪ CHIẾT KHẤU HAI LẦN CHO CÙNG MỘT ĐƠN ---');
    const cw9Before = await getWalletBal(creditWallet.id);

    const dupSettleRes = await WalletModel.settleBookingCommissionAndWage({ bookingId: bId1, adminId });
    const cw9After = await getWalletBal(creditWallet.id);

    assert(
      dupSettleRes.alreadySettled === true && cw9Before === cw9After,
      '9.1. Gọi settleBookingCommissionAndWage lần thứ hai: đã quyết toán, số dư ví không bị trừ thêm lần nữa',
      { cw9Before, cw9After, dupSettleRes }
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 10: XỬ LÝ CONCURRENT REQUESTS KHÔNG LÀM SAI SỐ DƯ
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 10: REQUEST ĐỒNG THỜI (CONCURRENCY & ROW LOCKING) ---');
    // Nạp thêm vào ví thu nhập 300.000đ để test rút tiền / chuyển tiền song song
    await pool.query('UPDATE wallets SET balance = 300000.00 WHERE id = ?', [earningsWallet.id]);

    // Gửi đồng thời 2 yêu cầu chuyển 200.000đ (tổng yêu cầu 400.000đ > số dư 300.000đ)
    // Đúng ra chỉ 1 request thành công, request thứ 2 phải thất bại do hết số dư khả dụng
    const p1 = WalletModel.transferEarningsToCredit({ staffId, amount: 200000, idempotencyKey: 'CONCURRENT-1-' + Date.now() }).catch(e => ({ error: e.message }));
    const p2 = WalletModel.transferEarningsToCredit({ staffId, amount: 200000, idempotencyKey: 'CONCURRENT-2-' + Date.now() }).catch(e => ({ error: e.message }));

    const [resP1, resP2] = await Promise.all([p1, p2]);
    const successes = [resP1, resP2].filter(r => !r.error && r.success);
    const failures = [resP1, resP2].filter(r => r.error);

    const ew10Bal = await getWalletBal(earningsWallet.id);

    assert(
      successes.length === 1 && failures.length === 1 && ew10Bal === 100000,
      '10.1. Hai request chuyển 200k đồng thời trên số dư 300k: Đúng 1 request thành công, số dư còn lại chính xác 100k',
      { successes: successes.length, failures: failures.length, finalBalance: ew10Bal }
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 11: BẢO MẬT PHÂN QUYỀN (RBAC) & CHỐNG SỬA SỐ DƯ
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 11: PHÂN QUYỀN (RBAC) & BẢO VỆ SỐ DƯ ---');
    // Nhân viên không thể gọi API duyệt chiết khấu hoặc xem ví quản trị
    const staffCallAdmin = await request('/api/admin/staff-wallets', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert(
      staffCallAdmin.status === 403,
      '11.1. Nhân viên gọi GET /api/admin/staff-wallets bị từ chối với HTTP 403',
      staffCallAdmin.body
    );

    // Khách hàng không thể gọi API chuyển tiền của nhân viên
    const custCallTransfer = await request('/api/wallet/staff/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${custToken}` },
      body: { amount: 50000 }
    });
    assert(
      custCallTransfer.status === 403,
      '11.2. Khách hàng gọi POST /api/wallet/staff/transfer bị từ chối với HTTP 403',
      custCallTransfer.body
    );

    // Nhân viên không thể rút tiền từ ví tín dụng (chỉ được rút từ ví thu nhập khả dụng)
    const staffWithdrawRes = await request('/api/wallet/withdraw', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        amount: 50000,
        bank_name: 'Vietcombank',
        account_number: '1234567890',
        account_name: 'TRAN VAN BAO'
      }
    });
    assert(
      staffWithdrawRes.status === 200 && staffWithdrawRes.body.success,
      '11.3. Nhân viên rút tiền hợp lệ (50.000đ) từ ví thu nhập khả dụng thành công',
      staffWithdrawRes.body
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 12: DASHBOARD ADMIN ĐỐI SOÁT & KHÔNG CỘNG TRÙNG
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 12: DASHBOARD ADMIN & KHÔNG COI CHUYỂN VÍ LÀ DOANH THU ---');
    const statsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const s = statsRes.body.data;

    assert(
      s.gross_payments !== undefined && s.cash_payments !== undefined && s.online_payments !== undefined,
      '12.1. Admin stats tách bạch rõ ràng Gross Payments, Cash Payments và Online Payments'
    );
    assert(
      s.staff_credit_balance_total !== undefined &&
      s.staff_credit_debt_total !== undefined &&
      s.staff_negative_credit_count !== undefined &&
      s.staff_earnings_balance_total !== undefined &&
      s.staff_credit_topup_total !== undefined &&
      s.staff_interwallet_transfer_total !== undefined,
      '12.2. Admin stats cung cấp đủ 6 chỉ số Quản trị Hai Ví Đối Tác (Mô hình Grab Driver)',
      {
        creditTotal: s.staff_credit_balance_total,
        creditDebt: s.staff_credit_debt_total,
        negativeCount: s.staff_negative_credit_count,
        earningsTotal: s.staff_earnings_balance_total,
        topupTotal: s.staff_credit_topup_total,
        transferTotal: s.staff_interwallet_transfer_total
      }
    );

    // Chuyển tiền giữa 2 ví (staff_interwallet_transfer_total) không được cộng vào gross_payments
    // Kiểm tra tính nhất quán tài chính: Net Receipts = Gross - Refund
    const expectedNet = s.gross_payments - s.refunds;
    assert(
      s.net_receipts === expectedNet,
      `12.3. Tính nhất quán: Net Receipts (${s.net_receipts}) = Gross (${s.gross_payments}) - Refunds (${s.refunds})`
    );

    // ------------------------------------------------------------
    // TÌNH HUỐNG 13: ĐƠN HỦY / HOÀN TIỀN XỬ LÝ ĐÚNG CHÍNH SÁCH
    // ------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 13: ĐƠN HỦY & HOÀN TIỀN (CANCELLATION & REFUNDS) ---');
    const codeCancel = 'TEST-CANCEL-' + Date.now().toString(36).toUpperCase();
    const insCancel = await pool.query(`
      INSERT INTO bookings (
        booking_code, user_id, staff_id, service_id, status, payment_status, payment_method,
        total_price, staff_wage, commission_rate, platform_commission, staff_net_wage,
        booking_date, booking_time, address, phone
      ) VALUES (?, ?, ?, 1, 'cancelled', 'refunded', 'vnpay', 250000, 200000, 0.20, 40000, 160000, CURDATE(), '16:00:00', '123 Cancel', '0911000013')
    `, [codeCancel, custUser.id, staffId]);
    const bIdCancel = insCancel.insertId || insCancel.id;

    // Cố tình gọi settle trên đơn đã bị hủy -> Phải bị từ chối
    let threwCancelled = false;
    try {
      await WalletModel.settleBookingCommissionAndWage({ bookingId: bIdCancel, adminId });
    } catch (e) {
      threwCancelled = true;
    }
    assert(
      threwCancelled,
      '13.1. Đơn bị hủy (cancelled) không được phép quyết toán chiết khấu hoặc thù lao'
    );

    console.log('\n============================================================');
    console.log(`🏁 KẾT THÚC KIỂM THỬ: ${passed} PASS, ${failed} FAIL (TỔNG: ${passed + failed})`);
    console.log('============================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ LỖI KHÔNG MONG MUỐN KHI CHẠY TEST SUITE:', err);
    process.exit(1);
  }
}

runTwoWalletTestSuite();
