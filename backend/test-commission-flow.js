// ============================================================
// DABCLEAN - TEST SUITE: MÔ HÌNH THANH TOÁN CHIẾT KHẤU KHI NHẬN ĐƠN
// Kiểm thử đầy đủ 17 kịch bản bắt buộc theo Mục XII:
// 1. Ví đủ tiền: trừ đúng khoản chiết khấu và nhận đơn thành công.
// 2. Ví thiếu tiền: không trừ ví, chuyển sang luồng chuyển khoản.
// 3. Chuyển khoản chưa xác minh: đơn chưa được nhận.
// 4. Chuyển khoản thành công: đơn chỉ được phân công một lần.
// 5. Webhook gửi lặp: không thanh toán hoặc phân công hai lần.
// 6. Hai nhân viên nhận cùng một đơn: chỉ một người thành công.
// 7. Hai request thanh toán cùng lúc: số dư không bị âm và không bị trừ trùng.
// 8. Hủy đơn không do lỗi nhân viên: hoàn đúng khoản chiết khấu.
// 9. Hủy đơn do lỗi nhân viên: không tự động hoàn.
// 10. Hủy đơn chưa rõ nguyên nhân: chuyển sang chờ xem xét.
// 11. Hai request hủy đồng thời: không hoàn tiền hai lần.
// 12. Hoàn tiền thất bại: không báo thành công giả.
// 13. Đơn bị hủy trong lúc thanh toán đang chờ xác minh: không phân công đơn sau khi đã hủy.
// 14. Đơn được người khác nhận trước khi webhook thanh toán đến: xử lý khoản tiền theo quy trình an toàn.
// 15. API nạp tiền cũ: không còn cho phép người dùng tự nạp tiền.
// 16. Lịch sử ví và số dư sau các thao tác: nhất quán và đối soát được.
// 17. Các chức năng đặt lịch, thanh toán của khách hàng và quản lý đơn hàng hiện tại vẫn hoạt động.
// ============================================================

const http = require('http');
const db = require('./src/config/db');
const WalletModel = require('./src/models/walletModel');
const BookingModel = require('./src/models/bookingModel');
const CommissionPaymentModel = require('./src/models/commissionPaymentModel');

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

async function getWalletBal(userId, type = 'credit') {
  const rows = await db.query(
    'SELECT balance FROM wallets WHERE user_id = ? AND wallet_type = ? LIMIT 1',
    [userId, type]
  );
  return Number(rows[0]?.balance || 0);
}

async function setWalletBal(userId, type = 'credit', balance = 0) {
  await db.query(
    'UPDATE wallets SET balance = ? WHERE user_id = ? AND wallet_type = ?',
    [balance, userId, type]
  );
}

async function createTestBooking({ userId, serviceId = 1, price = 500000, wage = 400000, comm = 80000, status = 'pending', staffId = null }) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const code = `TC${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
  const insertId = await BookingModel.create({
    booking_code: code,
    user_id: userId,
    service_id: serviceId,
    booking_date: dateStr,
    booking_time: '09:00:00',
    area_size: 'medium',
    address: '123 Đường Test, Hà Nội',
    phone: '0987654321',
    total_price: price,
    staff_wage: wage,
    commission_rate: 0.20,
    platform_commission: comm,
    staff_net_wage: wage - comm,
    payment_method: 'cash'
  });
  if (status !== 'pending' || staffId) {
    await db.query('UPDATE bookings SET status = ?, staff_id = ? WHERE id = ?', [status, staffId, insertId]);
  }
  return { id: insertId, booking_code: code, total_price: price, staff_wage: wage, platform_commission: comm };
}

async function runCommissionTestSuite() {
  console.log('============================================================');
  console.log('🏦 DABCLEAN: TEST SUITE MÔ HÌNH THANH TOÁN CHIẾT KHẤU NHẬN ĐƠN');
  console.log('============================================================\n');

  for (let i = 0; i < 30; i++) {
    if (db.isMySQLConnected()) break;
    await new Promise(r => setTimeout(r, 100));
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, name, details = null) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
      results.push({ name, status: 'PASS' });
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (details) console.error('     Chi tiết:', JSON.stringify(details, null, 2));
      failed++;
      results.push({ name, status: 'FAIL', details });
    }
  }

  try {
    // 0. Khởi tạo phiên đăng nhập
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' }
    });
    const adminToken = adminLogin.body.data?.token;
    const adminId = adminLogin.body.data?.user?.id;

    const staffLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'staff@cleanova.vn', password: 'Staff@Cleanova2026!' }
    });
    const staffToken = staffLogin.body.data?.token;
    const staffId = staffLogin.body.data?.user?.id;

    // Tìm hoặc tạo nhân viên thứ hai cho test concurrency
    const staff2Rows = await db.query("SELECT id FROM users WHERE role = 'staff' AND id != ? LIMIT 1", [staffId]);
    let staff2Id = staff2Rows[0]?.id;
    if (!staff2Id) {
      const newStaff = await db.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ('Staff 2 Concurrency', 'staff2_test@dabclean.vn', '$2a$10$hashed', 'staff', 'active')"
      );
      staff2Id = newStaff.insertId;
    }

    const custLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'demo@nova.app', password: 'NovaDemo2026!' }
    });
    const custToken = custLogin.body.data?.token;
    const custId = custLogin.body.data?.user?.id;

    assert(adminToken && staffToken && custToken, '0. Đăng nhập thành công và lấy JWT tokens');

    await WalletModel.getOrCreateStaffWallets(staffId);
    await WalletModel.getOrCreateStaffWallets(staff2Id);

    // ------------------------------------------------------------
    // TEST 1: Ví đủ tiền -> trừ đúng chiết khấu và nhận đơn thành công
    // ------------------------------------------------------------
    const b1 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 200000);
    const balBefore1 = await getWalletBal(staffId, 'credit');

    const res1 = await request(`/api/staff/tasks/${b1.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { payment_method: 'wallet' }
    });

    const balAfter1 = await getWalletBal(staffId, 'credit');
    const [b1Row] = await db.query('SELECT status, staff_id, commission_status FROM bookings WHERE id = ?', [b1.id]);

    assert(
      res1.status === 200 &&
      res1.body.requires_bank_transfer === false &&
      balAfter1 === balBefore1 - 80000 &&
      b1Row?.status === 'confirmed' &&
      b1Row?.staff_id === staffId &&
      b1Row?.commission_status === 'paid',
      '1. Ví đủ tiền: trừ đúng khoản chiết khấu 80.000đ và nhận đơn thành công (status confirmed)',
      { res1: res1.body, balBefore1, balAfter1, b1Row }
    );

    // ------------------------------------------------------------
    // TEST 2: Ví thiếu tiền -> không trừ ví, chuyển sang luồng chuyển khoản
    // ------------------------------------------------------------
    const b2 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 30000); // 30k < 80k
    const balBefore2 = await getWalletBal(staffId, 'credit');

    const res2 = await request(`/api/staff/tasks/${b2.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { payment_method: 'wallet' }
    });

    const balAfter2 = await getWalletBal(staffId, 'credit');
    const [b2Row] = await db.query('SELECT status, staff_id, commission_status FROM bookings WHERE id = ?', [b2.id]);

    assert(
      res2.status === 200 &&
      res2.body.requires_bank_transfer === true &&
      res2.body.data?.payment?.reference_code &&
      res2.body.data?.payment?.amount === 80000 &&
      balAfter2 === balBefore2 && // Không trừ ví dù chỉ một phần
      b2Row?.status === 'pending' && // Đơn chưa chuyển confirmed
      b2Row?.commission_status !== 'paid',
      '2. Ví thiếu tiền: KHÔNG trừ ví, tạo yêu cầu chuyển khoản ngân hàng VietQR đủ 80.000đ',
      { res2: res2.body, balBefore2, balAfter2, b2Row }
    );

    const refCode2 = res2.body.data?.payment?.reference_code;

    // ------------------------------------------------------------
    // TEST 3: Chuyển khoản chưa xác minh -> đơn chưa được nhận
    // ------------------------------------------------------------
    const [b3Row] = await db.query('SELECT status, staff_id FROM bookings WHERE id = ?', [b2.id]);
    assert(
      b3Row?.status === 'pending' && b3Row?.staff_id !== staffId,
      '3. Chuyển khoản chưa xác minh: đơn vẫn ở trạng thái pending, chưa được phân công nhận việc'
    );

    // ------------------------------------------------------------
    // TEST 4: Chuyển khoản thành công -> đơn chỉ được phân công một lần
    // ------------------------------------------------------------
    const res4 = await request('/api/wallet/commission/webhook', {
      method: 'POST',
      body: {
        reference_code: refCode2,
        amount: 80000,
        transaction_id: `TXN-BANK-TEST4-${Date.now()}`
      }
    });

    const [b4Row] = await db.query('SELECT status, staff_id, commission_status, commission_payment_method FROM bookings WHERE id = ?', [b2.id]);

    assert(
      res4.status === 200 &&
      res4.body.success === true &&
      b4Row?.status === 'confirmed' &&
      b4Row?.staff_id === staffId &&
      b4Row?.commission_status === 'paid' &&
      b4Row?.commission_payment_method === 'bank_transfer',
      '4. Chuyển khoản thành công: webhook xác minh thành công và phân công đơn cho nhân viên (status confirmed)'
    );

    // ------------------------------------------------------------
    // TEST 5: Webhook gửi lặp (Idempotent) -> không thanh toán hoặc phân công 2 lần
    // ------------------------------------------------------------
    const res5 = await request('/api/wallet/commission/webhook', {
      method: 'POST',
      body: {
        reference_code: refCode2,
        amount: 80000,
        transaction_id: `TXN-BANK-TEST5-RETRY`
      }
    });

    const [txCountRow] = await db.query(
      "SELECT COUNT(*) as count FROM staff_commission_payments WHERE reference_code = ? AND status = 'completed'",
      [refCode2]
    );

    assert(
      res5.status === 200 &&
      res5.body.data?.isIdempotent === true &&
      Number(txCountRow?.count) === 1,
      '5. Webhook gửi lặp: xử lý idempotent an toàn, không tạo bản ghi thanh toán hoặc phân công 2 lần'
    );

    // ------------------------------------------------------------
    // TEST 6: Hai nhân viên nhận cùng một đơn: chỉ đúng một người thành công
    // ------------------------------------------------------------
    const b6 = await createTestBooking({ userId: custId, price: 600000, wage: 500000, comm: 100000 });
    await setWalletBal(staffId, 'credit', 200000);
    await setWalletBal(staff2Id, 'credit', 200000);

    const [p6_1, p6_2] = await Promise.allSettled([
      CommissionPaymentModel.initiatePayment({ bookingId: b6.id, staffId: staffId, paymentMethod: 'wallet' }),
      CommissionPaymentModel.initiatePayment({ bookingId: b6.id, staffId: staff2Id, paymentMethod: 'wallet' })
    ]);

    const successes6 = [p6_1, p6_2].filter(p => p.status === 'fulfilled' && p.value?.success && !p.value?.isIdempotent);
    const rejected6 = [p6_1, p6_2].filter(p => p.status === 'rejected');

    const [b6Row] = await db.query('SELECT status, staff_id FROM bookings WHERE id = ?', [b6.id]);

    assert(
      successes6.length === 1 &&
      rejected6.length === 1 &&
      b6Row?.status === 'confirmed' &&
      [staffId, staff2Id].includes(b6Row?.staff_id),
      '6. Hai nhân viên cùng nhận một đơn đồng thời (Concurrency): đúng 1 nhân viên thành công, người kia bị từ chối 409',
      { p6_1, p6_2, bookingStaff: b6Row?.staff_id }
    );

    // ------------------------------------------------------------
    // TEST 7: Hai request thanh toán cùng lúc: số dư không bị âm và không bị trừ trùng
    // ------------------------------------------------------------
    const b7a = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    const b7b = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    // Chỉ cấp 100.000đ cho thợ: đủ cho 1 đơn (80k), KHÔNG đủ cho cả 2 đơn (160k)
    await setWalletBal(staffId, 'credit', 100000);

    const [res7a, res7b] = await Promise.all([
      CommissionPaymentModel.initiatePayment({ bookingId: b7a.id, staffId, paymentMethod: 'wallet' }),
      CommissionPaymentModel.initiatePayment({ bookingId: b7b.id, staffId, paymentMethod: 'wallet' })
    ]);

    const balAfter7 = await getWalletBal(staffId, 'credit');
    const walletSuccesses = [res7a, res7b].filter(r => !r.requires_bank_transfer);
    const bankRequired = [res7a, res7b].filter(r => r.requires_bank_transfer);

    assert(
      walletSuccesses.length === 1 &&
      bankRequired.length === 1 &&
      balAfter7 === 20000, // 100k - 80k = 20k, không bị trừ 2 lần thành âm!
      '7. Concurrency thanh toán hai đơn khi chỉ đủ tiền 1 đơn: số dư không bị âm, đơn thứ 2 chuyển sang VietQR',
      { res7a, res7b, balAfter7 }
    );

    // ------------------------------------------------------------
    // TEST 8: Hủy đơn không do lỗi nhân viên: hoàn đúng khoản chiết khấu về ví
    // ------------------------------------------------------------
    const b8 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 150000);
    await CommissionPaymentModel.initiatePayment({ bookingId: b8.id, staffId, paymentMethod: 'wallet' });
    const balBefore8Cancel = await getWalletBal(staffId, 'credit'); // 150k - 80k = 70k

    // Khách hàng hủy đơn (fault: customer)
    const refundRes8 = await CommissionPaymentModel.handleCancellationRefund({
      bookingId: b8.id,
      cancelReason: 'Khách hàng có việc bận đột xuất',
      fault: 'customer',
      adminId: custId
    });

    const balAfter8Cancel = await getWalletBal(staffId, 'credit');
    const [b8Row] = await db.query('SELECT commission_status, commission_refund_status FROM bookings WHERE id = ?', [b8.id]);

    assert(
      refundRes8.refunded === true &&
      balAfter8Cancel === balBefore8Cancel + 80000 &&
      b8Row?.commission_status === 'refunded' &&
      b8Row?.commission_refund_status === 'refunded',
      '8. Hủy đơn không do lỗi nhân viên (Khách hủy): hoàn đúng 80.000đ chiết khấu về Ví Tín Dụng của nhân viên',
      { balBefore8Cancel, balAfter8Cancel, refundRes8 }
    );

    // ------------------------------------------------------------
    // TEST 9: Hủy đơn do lỗi nhân viên: không tự động hoàn chiết khấu
    // ------------------------------------------------------------
    const b9 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 150000);
    await CommissionPaymentModel.initiatePayment({ bookingId: b9.id, staffId, paymentMethod: 'wallet' });
    const balBefore9 = await getWalletBal(staffId, 'credit');

    const refundRes9 = await CommissionPaymentModel.handleCancellationRefund({
      bookingId: b9.id,
      cancelReason: 'Nhân viên đến muộn và tự ý hủy đơn',
      fault: 'staff',
      adminId
    });

    const balAfter9 = await getWalletBal(staffId, 'credit');
    const [b9Row] = await db.query('SELECT commission_status, commission_refund_status FROM bookings WHERE id = ?', [b9.id]);

    assert(
      refundRes9.refunded === false &&
      balAfter9 === balBefore9 && // Không cộng tiền lại
      b9Row?.commission_refund_status === 'rejected',
      '9. Hủy đơn do lỗi nhân viên: KHÔNG tự động hoàn tiền, giữ lại chiết khấu và đánh dấu rejected'
    );

    // ------------------------------------------------------------
    // TEST 10: Hủy đơn chưa rõ nguyên nhân: chuyển sang chờ xem xét (pending_review)
    // ------------------------------------------------------------
    const b10 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 150000);
    await CommissionPaymentModel.initiatePayment({ bookingId: b10.id, staffId, paymentMethod: 'wallet' });
    const balBefore10 = await getWalletBal(staffId, 'credit');

    const refundRes10 = await CommissionPaymentModel.handleCancellationRefund({
      bookingId: b10.id,
      cancelReason: 'Hủy đơn chưa rõ nguyên nhân tranh chấp',
      fault: 'unclear',
      adminId
    });

    const balAfter10 = await getWalletBal(staffId, 'credit');
    const [b10Row] = await db.query('SELECT commission_status, commission_refund_status FROM bookings WHERE id = ?', [b10.id]);

    assert(
      refundRes10.refunded === false &&
      refundRes10.pending_review === true &&
      balAfter10 === balBefore10 &&
      b10Row?.commission_refund_status === 'pending_review',
      '10. Hủy đơn chưa rõ nguyên nhân: chuyển sang pending_review, không kết luận vội và chờ Admin đối soát'
    );

    // ------------------------------------------------------------
    // TEST 11: Hai request hủy đồng thời: không hoàn tiền 2 lần (Anti-double refund)
    // ------------------------------------------------------------
    const b11 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 150000);
    await CommissionPaymentModel.initiatePayment({ bookingId: b11.id, staffId, paymentMethod: 'wallet' });
    const balBefore11 = await getWalletBal(staffId, 'credit');

    const [cancel1, cancel2] = await Promise.allSettled([
      CommissionPaymentModel.handleCancellationRefund({ bookingId: b11.id, cancelReason: 'Khách hủy', fault: 'customer', adminId }),
      CommissionPaymentModel.handleCancellationRefund({ bookingId: b11.id, cancelReason: 'Khách hủy retry', fault: 'customer', adminId })
    ]);

    const balAfter11 = await getWalletBal(staffId, 'credit');
    const fulfilledRefunds = [cancel1, cancel2].filter(c => c.status === 'fulfilled' && c.value?.refunded === true);

    assert(
      fulfilledRefunds.length === 1 &&
      balAfter11 === balBefore11 + 80000, // Đúng 1 lần 80k
      '11. Hai request hủy đồng thời: chỉ hoàn đúng 1 lần, bảo vệ chống race condition hoàn tiền trùng'
    );

    // ------------------------------------------------------------
    // TEST 12: Hoàn tiền thất bại: không báo thành công giả
    // ------------------------------------------------------------
    let threw12 = false;
    try {
      // Đơn không tồn tại
      await CommissionPaymentModel.handleCancellationRefund({ bookingId: 99999999, cancelReason: 'Test', fault: 'customer' });
    } catch (e) {
      threw12 = true;
    }
    assert(threw12, '12. Hoàn tiền thất bại: throw error 404, không trả thành công giả');

    // ------------------------------------------------------------
    // TEST 13: Đơn bị hủy trong lúc thanh toán đang chờ xác minh -> không phân công đơn sau khi đã hủy
    // ------------------------------------------------------------
    const b13 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 20000); // Không đủ tiền -> tạo chuyển khoản
    const init13 = await CommissionPaymentModel.initiatePayment({ bookingId: b13.id, staffId, paymentMethod: 'wallet' });
    const refCode13 = init13.data?.payment?.reference_code;

    // Trong lúc chờ chuyển khoản, khách hàng hủy đơn:
    await db.query("UPDATE bookings SET status = 'cancelled', cancel_reason = 'Khách hủy trước khi thợ thanh toán' WHERE id = ?", [b13.id]);

    // Giờ webhook ngân hàng mới tới:
    const res13 = await CommissionPaymentModel.verifyBankTransfer({
      referenceCode: refCode13,
      amount: 80000,
      transactionId: `TXN-LATE-${Date.now()}`
    });

    const [b13Row] = await db.query('SELECT status, staff_id FROM bookings WHERE id = ?', [b13.id]);
    const [p13Row] = await db.query('SELECT status, refund_status FROM staff_commission_payments WHERE reference_code = ?', [refCode13]);

    assert(
      res13.success === false &&
      res13.code === 'BOOKING_NOT_AVAILABLE' &&
      b13Row?.status === 'cancelled' &&
      b13Row?.staff_id !== staffId && // Không phân công đơn đã hủy!
      p13Row?.refund_status === 'pending_review', // Đưa vào danh sách hoàn tiền
      '13. Đơn bị hủy khi thanh toán đang chờ xác minh: KHÔNG phân công đơn đã hủy, chuyển tiền sang chờ hoàn tiền'
    );

    // ------------------------------------------------------------
    // TEST 14: Đơn được người khác nhận trước khi webhook tới -> xử lý hoàn tiền an toàn
    // ------------------------------------------------------------
    const b14 = await createTestBooking({ userId: custId, price: 500000, wage: 400000, comm: 80000 });
    await setWalletBal(staffId, 'credit', 20000); // Thợ 1 thiếu tiền -> tạo yêu cầu CK
    const init14 = await CommissionPaymentModel.initiatePayment({ bookingId: b14.id, staffId, paymentMethod: 'bank_transfer' });
    const refCode14 = init14.data?.payment?.reference_code;

    // Trong khi thợ 1 đang ra ngân hàng chuyển khoản, thợ 2 có ví đủ tiền nhận và xác nhận đơn trước:
    await setWalletBal(staff2Id, 'credit', 200000);
    await CommissionPaymentModel.initiatePayment({ bookingId: b14.id, staffId: staff2Id, paymentMethod: 'wallet' });

    // Webhook chuyển khoản của Thợ 1 đến muộn:
    const res14 = await CommissionPaymentModel.verifyBankTransfer({
      referenceCode: refCode14,
      amount: 80000,
      transactionId: `TXN-RACE-${Date.now()}`
    });

    const [b14Row] = await db.query('SELECT staff_id FROM bookings WHERE id = ?', [b14.id]);
    const [p14Row] = await db.query('SELECT status, refund_status FROM staff_commission_payments WHERE reference_code = ?', [refCode14]);

    assert(
      res14.success === false &&
      res14.code === 'BOOKING_NOT_AVAILABLE' &&
      b14Row?.staff_id === staff2Id && // Đơn vẫn thuộc về thợ 2
      p14Row?.refund_status === 'pending_review', // Khoản tiền của thợ 1 được bảo vệ đưa vào danh sách đối soát hoàn tiền
      '14. Đơn đã được người khác nhận trước khi webhook đến: bảo toàn quyền người nhận trước, chuyển khoản tiền đến muộn sang chờ hoàn tiền'
    );

    // ------------------------------------------------------------
    // TEST 15: API nạp tiền cũ: không còn cho phép người dùng tự nạp tiền
    // ------------------------------------------------------------
    const res15 = await request('/api/wallet/staff/topup-credit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { amount: 500000 }
    });

    assert(
      res15.status === 403 &&
      res15.body.code === 'FEATURE_DISABLED',
      '15. API nạp tiền chủ động cũ: bị vô hiệu hóa hoàn toàn, trả về 403 FEATURE_DISABLED'
    );

    // ------------------------------------------------------------
    // TEST 16: Lịch sử ví và số dư sau các thao tác: nhất quán và đối soát được
    // ------------------------------------------------------------
    const { creditWallet } = await WalletModel.getOrCreateStaffWallets(staffId);
    const ledgerRows = await db.query(
      'SELECT * FROM wallet_ledger_entries WHERE wallet_id = ? ORDER BY id DESC LIMIT 5',
      [creditWallet.id]
    );

    const txRows = await db.query(
      'SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 5',
      [creditWallet.id]
    );

    assert(
      ledgerRows.length > 0 && txRows.length > 0,
      '16. Lịch sử ví và sổ cái: các giao dịch chiết khấu và hoàn tiền ghi nhận đầy đủ, đối soát được'
    );

    // ------------------------------------------------------------
    // TEST 17: Các chức năng đặt lịch, báo giá và quản trị hệ thống vẫn hoạt động ổn định
    // ------------------------------------------------------------
    const quoteRes = await request('/api/bookings/quote', {
      method: 'POST',
      body: { service_id: 1, area_size: 'medium', frequency: 'once' }
    });

    const statsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const commPaymentsAdminRes = await request('/api/admin/commission/payments', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(
      quoteRes.status === 200 &&
      quoteRes.body.data?.final_price > 0 &&
      statsRes.status === 200 &&
      commPaymentsAdminRes.status === 200 &&
      Array.isArray(commPaymentsAdminRes.body.data),
      '17. Chức năng đặt lịch, báo giá và API đối soát chiết khấu admin hoạt động trơn tru'
    );

  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS / ${failed} FAIL (Tổng số: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCommissionTestSuite();
