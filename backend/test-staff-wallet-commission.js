// ============================================================
// CLEANOVA - TEST SUITE: STAFF WALLET, COMMISSION & ADMIN REVENUE
// Theo yêu cầu BIG UPDATE: Kiểm thử công thức chiết khấu,
// chống ghi trùng, luồng ví nhân viên, và 10 chỉ số doanh thu admin.
// ============================================================
const http = require('http');
const pricingService = require('./src/services/pricingService');
const pool = require('./src/config/db');

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

async function runTestSuite() {
  console.log('============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: STAFF WALLET COMMISSION & ADMIN REVENUE');
  console.log('============================================================\n');

  for (let i = 0; i < 20; i++) {
    if (pool.isMySQLConnected()) break;
    await new Promise(r => setTimeout(r, 100));
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, testName, details = null) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
      results.push({ name: testName, status: 'PASS' });
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error('     Chi tiết:', JSON.stringify(details));
      failed++;
      results.push({ name: testName, status: 'FAIL', details });
    }
  }

  // ------------------------------------------------------------
  // PHẦN 1: UNIT TESTS CHO CÔNG THỨC CHIẾT KHẤU & TIỀN TỆ NGUYÊN VND
  // ------------------------------------------------------------
  console.log('--- PHẦN 1: UNIT TESTS CÔNG THỨC CHIẾT KHẤU & TIỀN CÔNG ---');

  // Test 1.1: Tiền công gộp 200.000 VNĐ, tỷ lệ 20% -> CK 40.000, Thực nhận 160.000
  const c1 = pricingService.calculateCommission(200000, 0.20);
  assert(
    c1.grossWage === 200000 && c1.platformCommission === 40000 && c1.netWage === 160000 && c1.commissionRate === 0.2,
    '1.1. Công thức cơ bản: 200k gross * 20% CK -> 40k commission, 160k net',
    c1
  );

  // Test 1.2: Tỷ lệ chiết khấu bằng 0 -> CK = 0, Net = Gross
  const c2 = pricingService.calculateCommission(250000, 0);
  assert(
    c2.grossWage === 250000 && c2.platformCommission === 0 && c2.netWage === 250000,
    '1.2. Tỷ lệ chiết khấu bằng 0: CK = 0, nhân viên nhận trọn tiền công gộp',
    c2
  );

  // Test 1.3: Tiền công gộp bằng 0 hoặc âm -> trả về 0 an toàn
  const c3 = pricingService.calculateCommission(0, 0.20);
  const c4 = pricingService.calculateCommission(-50000, 0.20);
  assert(
    c3.grossWage === 0 && c3.platformCommission === 0 && c3.netWage === 0 &&
    c4.grossWage === 0 && c4.platformCommission === 0 && c4.netWage === 0,
    '1.3. Tiền công gộp bằng 0 hoặc âm: chuẩn hóa về 0 an toàn, không sinh số âm',
    { c3, c4 }
  );

  // Test 1.4: Làm tròn nguyên VND (không dùng floating-point lẻ xu)
  // 175.333 VNĐ * 20% = 35.066,6 -> 35.067 VNĐ, Net = 140.266 VNĐ
  const c5 = pricingService.calculateCommission(175333, 0.20);
  assert(
    Number.isInteger(c5.grossWage) && Number.isInteger(c5.platformCommission) && Number.isInteger(c5.netWage) &&
    c5.platformCommission === 35067 && c5.netWage === 140266 && (c5.platformCommission + c5.netWage === c5.grossWage),
    '1.4. Đơn vị tiền tệ nguyên VND: làm tròn nguyên số, tổng Commission + Net = Gross',
    c5
  );

  // Test 1.5: Tỷ lệ chiết khấu vượt ngưỡng [0, 1] được kẹp chặt an toàn
  const c6 = pricingService.calculateCommission(100000, 1.5); // vượt quá 100%
  const c7 = pricingService.calculateCommission(100000, -0.2); // nhỏ hơn 0
  assert(
    c6.commissionRate === 1.0 && c6.platformCommission === 100000 && c6.netWage === 0 &&
    c7.commissionRate === 0.0 && c7.platformCommission === 0 && c7.netWage === 100000,
    '1.5. Giới hạn tỷ lệ chiết khấu an toàn trong đoạn [0, 1]',
    { c6, c7 }
  );

  // ------------------------------------------------------------
  // PHẦN 2: XÁC THỰC VÀ ĐĂNG NHẬP (ADMIN & STAFF)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 2: XÁC THỰC TÀI KHOẢN (API AUTH) ---');

  let adminToken = '';
  let staffToken = '';
  let staffUser = null;

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' }
  });
  assert(adminLogin.status === 200 && adminLogin.body.data && adminLogin.body.data.token, '2.1. Đăng nhập Admin thành công');
  if (adminLogin.status === 200) adminToken = adminLogin.body.data.token;

  const toRows = (res) => Array.isArray(res) ? res : (res && res.id !== undefined ? [res] : []);
  const first = (res) => Array.isArray(res) ? res[0] : res;

  // Lấy hoặc tạo tài khoản Staff để kiểm thử
  const bcrypt = require('bcryptjs');
  const staffHash = await bcrypt.hash('Staff@Cleanova2026!', 10);
  const custHash = await bcrypt.hash('Customer@Cleanova2026!', 10);

  const rawStaffRows = await pool.query("SELECT id, name, email FROM users WHERE role = 'staff' AND status = 'active' LIMIT 1");
  const staffList = toRows(rawStaffRows);
  if (staffList.length === 0) {
    const insStaff = await pool.query(
      "INSERT INTO users (name, email, password, phone, address, role, status) VALUES ('Nhân Viên Thử Nghiệm', 'staff.test@cleanova.vn', ?, '0988776655', 'Cầu Giấy, Hà Nội', 'staff', 'active')",
      [staffHash]
    );
    staffUser = { id: insStaff.insertId || insStaff.id, name: 'Nhân Viên Thử Nghiệm', email: 'staff.test@cleanova.vn' };
  } else {
    staffUser = staffList[0];
    await pool.query("UPDATE users SET password = ? WHERE id = ?", [staffHash, staffUser.id]);
  }

  // Đảm bảo có tài khoản Customer
  const rawCustRows = await pool.query("SELECT id, name, email FROM users WHERE role = 'customer' AND status = 'active' LIMIT 1");
  const custList = toRows(rawCustRows);
  let customerUser = null;
  if (custList.length === 0) {
    const insCust = await pool.query(
      "INSERT INTO users (name, email, password, phone, address, role, status) VALUES ('Khách Hàng Test', 'customer.test@cleanova.vn', ?, '0911223344', 'Đống Đa, Hà Nội', 'customer', 'active')",
      [custHash]
    );
    customerUser = { id: insCust.insertId || insCust.id, name: 'Khách Hàng Test', email: 'customer.test@cleanova.vn' };
  } else {
    customerUser = custList[0];
  }

  const staffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: staffUser.email, password: 'Staff@Cleanova2026!' }
  });
  if (staffLogin.status === 200 && staffLogin.body.data) {
    staffToken = staffLogin.body.data.token;
  }
  assert(Boolean(staffToken), '2.2. Đăng nhập Nhân viên (Staff) thành công');

  // ------------------------------------------------------------
  // PHẦN 3: CẤU HÌNH TỶ LỆ CHIẾT KHẤU TOÀN HỆ THỐNG (SYSTEM CONFIG)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 3: CẤU HÌNH CHIẾT KHẤU HỆ THỐNG (ADMIN API) ---');

  // Test 3.1: Lấy cấu hình chiết khấu hiện tại
  const cfgGet = await request('/api/admin/config/commission', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(
    cfgGet.status === 200 && cfgGet.body.data && typeof cfgGet.body.data.rate === 'number',
    '3.1. GET /api/admin/config/commission trả về tỷ lệ chiết khấu hợp lệ',
    cfgGet.body
  );
  const initialRate = cfgGet.body.data ? cfgGet.body.data.rate : 0.20;

  // Test 3.2: Cập nhật tỷ lệ chiết khấu mới với lý do audit trail
  const cfgPut = await request('/api/admin/config/commission', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { rate: 0.25, reason: 'Kiểm thử cập nhật tỷ lệ chiết khấu quý 4' }
  });
  assert(
    cfgPut.status === 200 && cfgPut.body.data && cfgPut.body.data.rate === 0.25,
    '3.2. PUT /api/admin/config/commission cập nhật thành công (0.25) kèm lý do audit',
    cfgPut.body
  );

  // Test 3.3: Từ chối cập nhật nếu tỷ lệ ngoài khoảng [0, 1] hoặc thiếu lý do
  const cfgPutInvalid = await request('/api/admin/config/commission', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { rate: 1.5, reason: 'test' }
  });
  assert(
    cfgPutInvalid.status === 400,
    '3.3. Từ chối tỷ lệ không hợp lệ (> 100%) với mã lỗi HTTP 400'
  );

  // Khôi phục lại tỷ lệ ban đầu
  await request('/api/admin/config/commission', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { rate: initialRate, reason: 'Khôi phục tỷ lệ ban đầu' }
  });

  // ------------------------------------------------------------
  // PHẦN 4: LUỒNG DUYỆT THÙ LAO & STAFF WALLET IDEMPOTENCY
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 4: DUYỆT THÙ LAO, STAFF WALLET & IDEMPOTENCY ---');

  // Tạo một đơn hàng test hoàn tất để kiểm tra duyệt thù lao
  const testBookingCode = 'TEST-COMM-' + Date.now().toString(36).toUpperCase();
  const custId = customerUser.id;

  // Đơn hàng: Tiền khách 300.000 VNĐ, tiền công gộp 200.000 VNĐ, tỷ lệ 20%
  // Khấu trừ CleanNova = 40.000 VNĐ, Tiền thực nhận = 160.000 VNĐ
  const insertBooking = await pool.query(
    `INSERT INTO bookings (
      booking_code, user_id, staff_id, service_id, status, payment_status, payment_method,
      total_price, staff_wage, commission_rate, platform_commission, staff_net_wage,
      booking_date, booking_time, address, phone
    ) VALUES (?, ?, ?, 1, 'completed', 'paid', 'vnpay', 300000, 200000, 0.20, 40000, 160000, CURDATE(), '09:00:00', '123 Test St', '0901234567')`,
    [testBookingCode, custId, staffUser.id]
  );
  const testBookingId = insertBooking.insertId || insertBooking.id;

  // Lấy số dư ví thu nhập của nhân viên trước khi duyệt thù lao
  const wBeforeRaw = await pool.query("SELECT balance FROM wallets WHERE user_id = ? AND wallet_type = 'earnings'", [staffUser.id]);
  const wBeforeList = toRows(wBeforeRaw);
  const balanceBefore = wBeforeList.length > 0 ? Number(wBeforeList[0].balance) : 0;

  // Test 4.1: Admin duyệt tiền công lần đầu -> ghi có vào ví đúng bằng staff_net_wage (160.000)
  const payout1 = await request(`/api/admin/bookings/${testBookingId}/payout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { note: 'Duyệt thù lao đơn kiểm thử' }
  });
  assert(
    payout1.status === 200 && payout1.body.success,
    '4.1. Admin duyệt thù lao đơn hàng thành công lần đầu',
    payout1.body
  );

  const wAfterRaw = await pool.query("SELECT balance FROM wallets WHERE user_id = ? AND wallet_type = 'earnings'", [staffUser.id]);
  const wAfterList = toRows(wAfterRaw);
  const balanceAfter = wAfterList.length > 0 ? Number(wAfterList[0].balance) : 0;
  assert(
    balanceAfter === balanceBefore + 160000,
    `4.2. Số dư ví nhân viên tăng chính xác 160.000 VNĐ (net_wage): ${balanceBefore} -> ${balanceAfter}`,
    { balanceBefore, balanceAfter }
  );

  // Kiểm tra bảng kê staff_payout_logs lưu đầy đủ 4 giá trị
  const payoutLogsRaw = await pool.query(
    "SELECT gross_wage, commission_rate, platform_commission, net_wage FROM staff_payout_logs WHERE booking_id = ?",
    [testBookingId]
  );
  const payoutLogs = toRows(payoutLogsRaw);
  assert(
    payoutLogs.length > 0 &&
    Number(payoutLogs[0].gross_wage) === 200000 &&
    Number(payoutLogs[0].commission_rate) === 0.20 &&
    Number(payoutLogs[0].platform_commission) === 40000 &&
    Number(payoutLogs[0].net_wage) === 160000,
    '4.3. staff_payout_logs lưu đủ 4 giá trị tài chính: gross=200k, rate=0.20, comm=40k, net=160k',
    payoutLogs[0]
  );

  // Test 4.4: IDEMPOTENCY CHECK - Duyệt tiền công lần 2 trên cùng một đơn -> BỊ TỪ CHỐI
  const payout2 = await request(`/api/admin/bookings/${testBookingId}/payout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { note: 'Cố tình duyệt lần 2' }
  });
  assert(
    payout2.status === 400 || payout2.status === 409 || !payout2.body.success,
    '4.4. IDEMPOTENCY: Từ chối duyệt tiền công lần hai, ngăn chặn ghi có trùng lặp',
    payout2.body
  );

  const wAfter2Raw = await pool.query("SELECT balance FROM wallets WHERE user_id = ? AND wallet_type = 'earnings'", [staffUser.id]);
  const wAfter2List = toRows(wAfter2Raw);
  assert(
    (wAfter2List.length > 0 ? Number(wAfter2List[0].balance) : 0) === balanceAfter,
    '4.5. Số dư ví nhân viên KHÔNG bị cộng trùng sau khi thử duyệt lần 2',
    { balanceAfter, balanceAfter2: (wAfter2List.length > 0 ? Number(wAfter2List[0].balance) : 0) }
  );

  // ------------------------------------------------------------
  // PHẦN 5: STAFF WALLET SUMMARY & RÚT TIỀN (WITHDRAWAL)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 5: API VÍ NHÂN VIÊN & RÚT TIỀN (STAFF PORTAL) ---');

  // Test 5.1: Lấy tổng hợp ví nhân viên (Summary, Bookings, Ledger)
  const staffSummaryRes = await request('/api/wallet/staff/summary', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  assert(
    staffSummaryRes.status === 200 && staffSummaryRes.body.data &&
    staffSummaryRes.body.data.wallet && staffSummaryRes.body.data.summary,
    '5.1. GET /api/wallet/staff/summary trả về đầy đủ ví, thống kê thù lao, đơn hàng & sổ cái',
    staffSummaryRes.body.data ? staffSummaryRes.body.data.summary : null
  );

  const staffSum = staffSummaryRes.body.data ? staffSummaryRes.body.data.summary : {};
  assert(
    Number(staffSum.gross_earnings) >= 200000 &&
    Number(staffSum.commission_deducted) >= 40000 &&
    Number(staffSum.net_earnings) >= 160000,
    '5.2. Thống kê thù lao nhân viên phân tách rõ ràng: Gross, Commission và Net',
    staffSum
  );

  // Test 5.3: Yêu cầu rút tiền vượt quá số dư khả dụng -> BỊ TỪ CHỐI
  const withdrawFail = await request('/api/wallet/withdraw', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      amount: balanceAfter + 5000000, // vượt quá số dư
      bankName: 'Vietcombank',
      accountNumber: '9999999999',
      accountName: 'NGUYEN VAN STAFF'
    }
  });
  assert(
    withdrawFail.status === 400,
    '5.3. Rút tiền vượt số dư khả dụng bị từ chối với mã HTTP 400',
    withdrawFail.body
  );

  // Test 5.4: Rút số tiền hợp lệ (50.000 VNĐ)
  const withdrawSuccess = await request('/api/wallet/withdraw', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      amount: 50000,
      bankName: 'MB Bank',
      accountNumber: '1234567890',
      accountName: 'NGUYEN VAN STAFF'
    }
  });
  assert(
    withdrawSuccess.status === 200 && withdrawSuccess.body.success,
    '5.4. Rút tiền hợp lệ thành công (50.000 VNĐ)',
    withdrawSuccess.body
  );

  const wAfterWithdrawRaw = await pool.query("SELECT balance FROM wallets WHERE user_id = ? AND wallet_type = 'earnings'", [staffUser.id]);
  const wAfterWithdrawList = toRows(wAfterWithdrawRaw);
  const currentBalAfterWithdraw = wAfterWithdrawList.length > 0 ? Number(wAfterWithdrawList[0].balance) : 0;
  assert(
    currentBalAfterWithdraw === balanceAfter - 50000,
    `5.5. Số dư ví bị trừ chính xác 50.000 VNĐ sau khi rút: ${balanceAfter} -> ${currentBalAfterWithdraw}`,
    { balanceAfter, currentBalance: currentBalAfterWithdraw }
  );

  // ------------------------------------------------------------
  // PHẦN 6: ADMIN STATS & BỘ LỌC DOANH THU MINH BẠCH (10 CHỈ SỐ)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 6: ADMIN FINANCIAL STATS & BỘ LỌC DOANH THU ---');

  // Test 6.1: Lấy thống kê mặc định (tháng này)
  const statsRes = await request('/api/admin/stats?period=month', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(
    statsRes.status === 200 && statsRes.body.data,
    '6.1. GET /api/admin/stats trả về thành công với period=month'
  );

  const stats = statsRes.body.data || {};
  assert(
    stats.gross_payments !== undefined &&
    stats.refund_amount !== undefined &&
    stats.net_receipts !== undefined &&
    stats.staff_gross_wages !== undefined &&
    stats.platform_commission !== undefined &&
    stats.staff_net_wages !== undefined &&
    stats.staff_payable !== undefined &&
    stats.staff_settled !== undefined &&
    stats.platform_profit !== undefined &&
    stats.customer_wallet_liability !== undefined,
    '6.2. Cung cấp đầy đủ 10 chỉ số tài chính riêng biệt, không gộp mập mờ',
    {
      gross_payments: stats.gross_payments,
      refund_amount: stats.refund_amount,
      net_receipts: stats.net_receipts,
      staff_gross_wages: stats.staff_gross_wages,
      platform_commission: stats.platform_commission,
      staff_net_wages: stats.staff_net_wages,
      staff_payable: stats.staff_payable,
      staff_settled: stats.staff_settled,
      platform_profit: stats.platform_profit,
      customer_wallet_liability: stats.customer_wallet_liability
    }
  );

  // Test 6.3: Kiểm tra tính nhất quán công thức: Net Receipts = Gross - Refund
  assert(
    stats.net_receipts === (stats.gross_payments - stats.refund_amount),
    `6.3. Tính nhất quán: Net Receipts (${stats.net_receipts}) = Gross (${stats.gross_payments}) - Refund (${stats.refund_amount})`
  );

  // Test 6.4: Kiểm tra tính nhất quán công thức: Staff Net = Staff Gross - Platform Commission
  assert(
    stats.staff_net_wages === (stats.staff_gross_wages - stats.platform_commission),
    `6.4. Tính nhất quán: Staff Net (${stats.staff_net_wages}) = Staff Gross (${stats.staff_gross_wages}) - Commission (${stats.platform_commission})`
  );

  // Test 6.5: Báo cáo chi tiết từng ngày (Daily Breakdown)
  assert(
    Array.isArray(stats.daily_breakdown),
    `6.5. daily_breakdown là mảng đối soát từng ngày độc lập (${stats.daily_breakdown ? stats.daily_breakdown.length : 0} ngày)`
  );

  // Test 6.6: Kiểm tra các bộ lọc thời gian: today, 7days, all
  const [sToday, s7Days, sAll] = await Promise.all([
    request('/api/admin/stats?period=today', { headers: { Authorization: `Bearer ${adminToken}` } }),
    request('/api/admin/stats?period=7days', { headers: { Authorization: `Bearer ${adminToken}` } }),
    request('/api/admin/stats?period=all', { headers: { Authorization: `Bearer ${adminToken}` } })
  ]);
  assert(
    sToday.status === 200 && s7Days.status === 200 && sAll.status === 200,
    '6.6. Mọi bộ lọc thời gian (today, 7days, all) hoạt động chính xác ở backend'
  );

  // Test 6.7: Bộ lọc khoảng thời gian tùy chỉnh (custom date range)
  const todayStr = new Date().toISOString().split('T')[0];
  const sCustom = await request(`/api/admin/stats?period=custom&from_date=${todayStr}&to_date=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(
    sCustom.status === 200 && sCustom.body.data && sCustom.body.data.filter.period === 'custom',
    '6.7. Bộ lọc tùy biến from_date và to_date truy vấn chính xác theo phạm vi'
  );

  // Dọn dẹp dữ liệu đơn hàng test
  await pool.query("DELETE FROM staff_payout_logs WHERE booking_id = ?", [testBookingId]);
  await pool.query("DELETE FROM wallet_transactions WHERE reference_type = 'booking_wage' AND reference_id = ?", [String(testBookingId)]);
  await pool.query("DELETE FROM bookings WHERE id = ?", [testBookingId]);

  console.log('\n============================================================');
  console.log(`🏁 KẾT THÚC KIỂM THỬ: ${passed} PASS, ${failed} FAIL (TỔNG: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Lỗi thực thi test suite:', err);
  process.exit(1);
});
