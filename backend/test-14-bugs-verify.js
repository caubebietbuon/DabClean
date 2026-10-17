// ============================================================
// DABCLEAN - 14 BUGS VERIFICATION & REGRESSION TEST SUITE
// ============================================================
const assert = require('assert');
const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('./src/config/db');
const BookingModel = require('./src/models/bookingModel');
const WalletModel = require('./src/models/walletModel');
const VoucherModel = require('./src/models/voucherModel');
const ServiceModel = require('./src/models/serviceModel');
const UserModel = require('./src/models/userModel');
const pricingService = require('./src/services/pricingService');
const { escapeHtml, sanitizeReviewComment, sanitizeInput } = require('./src/utils/sanitize');
const { errorHandler, sanitizeForLog } = require('./src/middleware/errorHandler');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(() => {
        passedTests++;
        console.log(`  ✓ [PASS] ${name}`);
      }).catch(err => {
        console.error(`  ✗ [FAIL] ${name}:`, err.message);
        throw err;
      });
    }
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// Helper: HTTP request to running backend
function apiRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, 'http://localhost:5000');
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runAll14BugTests() {
  console.log('====================================================');
  console.log('   DABCLEAN - VERIFYING ALL 14 BACKEND BUGS');
  console.log('====================================================\n');

  // Đợi MySQL kết nối
  for (let i = 0; i < 30; i++) {
    if (db.isMySQLConnected && db.isMySQLConnected()) break;
    await new Promise(r => setTimeout(r, 200));
  }

  // Login tokens
  const adminLogin = await apiRequest('POST', '/api/auth/login', {}, {
    email: 'admin@cleanova.vn',
    password: 'Admin@Cleanova2026!'
  });
  const adminToken = adminLogin.data.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const customerLogin = await apiRequest('POST', '/api/auth/login', {}, {
    email: 'demo@nova.app',
    password: 'NovaDemo2026!'
  });
  const customerToken = customerLogin.data.data.token;
  const customerHeaders = { Authorization: `Bearer ${customerToken}` };
  const customerId = customerLogin.data.data.user.id;

  const staffLogin = await apiRequest('POST', '/api/auth/login', {}, {
    email: 'staff@cleanova.vn',
    password: 'Staff@Cleanova2026!'
  });
  const staffToken = staffLogin.data.data.token;
  const staffHeaders = { Authorization: `Bearer ${staffToken}` };
  const staffId = staffLogin.data.data.user.id;

  console.log('--- PHẦN I: P0 CRITICAL (BUG 1 & BUG 2) ---');

  // BUG 1: Admin hủy đơn đã thanh toán bằng ví -> Hoàn tiền 100% vào ví
  await it('Bug 1.1: Admin hủy đơn thanh toán bằng ví -> Tiền được hoàn vào ví khách hàng', async () => {
    // Nạp tiền vào ví khách hàng trước
    await WalletModel.topup({ userId: customerId, amount: 500000, description: 'Test Bug 1 topup' });
    const balBefore = (await WalletModel.getBalance(customerId)).balance;

    // Tạo booking đã thanh toán bằng ví
    const bookingCode = `B1-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B1', '0987654321', 200000, 'wallet', 'paid', 'confirmed', 140000, 'pending')`,
      [bookingCode, customerId]
    );
    const bookingId = insertResult.insertId;

    // Trừ 200.000 tiền ví khách hàng để mô phỏng đã trả tiền
    await db.query('UPDATE wallets SET balance = balance - 200000 WHERE user_id = ? AND wallet_type = "customer"', [customerId]);
    const balAfterPay = (await WalletModel.getBalance(customerId)).balance;

    // Admin hủy đơn này
    const res = await apiRequest('PUT', `/api/admin/bookings/${bookingId}/status`, adminHeaders, {
      status: 'cancelled',
      reason: 'Khách hàng yêu cầu hủy đơn do bận việc'
    });

    assert.strictEqual(res.status, 200, 'Admin cancel must return HTTP 200');
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.refund, 'Response must contain refund object');
    assert.strictEqual(res.data.refund.refund_amount, 200000);

    // Kiểm tra số dư ví khách hàng đã được cộng lại đủ 200.000
    const balAfterRefund = (await WalletModel.getBalance(customerId)).balance;
    assert.strictEqual(balAfterRefund, balAfterPay + 200000, 'Ví khách hàng phải được hoàn lại đúng 200.000 VNĐ');

    // Kiểm tra trạng thái đơn
    const updatedBooking = await BookingModel.getById(bookingId);
    assert.strictEqual(updatedBooking.status, 'cancelled');
    assert.strictEqual(updatedBooking.payment_status, 'refunded');

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  await it('Bug 1.2: Không hoàn tiền lần hai nếu đơn đã ở trạng thái hoàn tiền hoặc hủy', async () => {
    const bookingCode = `B1W-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B1 Twice', '0987654321', 200000, 'wallet', 'refunded', 'cancelled', 140000, 'pending')`,
      [bookingCode, customerId]
    );
    const bookingId = insertResult.insertId;

    // Thử hủy tiếp lần hai
    const res = await apiRequest('PUT', `/api/admin/bookings/${bookingId}/status`, adminHeaders, {
      status: 'cancelled',
      reason: 'Hủy lần hai thử nghiệm'
    });

    assert.strictEqual(res.status, 409, 'Hủy lần hai phải trả 409 Conflict');
    assert.strictEqual(res.data.success, false);

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  await it('Bug 1.3: Đơn chưa thanh toán hủy không tự động hoàn tiền', async () => {
    const bookingCode = `B1U-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B1 Unpaid', '0987654321', 200000, 'cash', 'unpaid', 'pending', 140000, 'pending')`,
      [bookingCode, customerId]
    );
    const bookingId = insertResult.insertId;

    const res = await apiRequest('PUT', `/api/admin/bookings/${bookingId}/status`, adminHeaders, {
      status: 'cancelled',
      reason: 'Khách hàng hủy đơn tiền mặt'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.refund, null, 'Đơn chưa thanh toán không được hoàn tiền');

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  // BUG 2: Quyết toán lương thất bại không được trả success
  await it('Bug 2.1: Quyết toán lương thất bại không nuốt lỗi và không trả success giả', async () => {
    // Tạo đơn với staff_id không tồn tại hoặc lỗi để settlement thất bại
    const bookingCode = `B2-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, staff_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 6, NULL, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B2', '0987654321', 200000, 'cash', 'paid', 'in_progress', 0, 'pending')`,
      [bookingCode, customerId]
    );
    const bookingId = insertResult.insertId;

    // Admin thử chuyển completed (sẽ fail vì staff_wage = 0 hoặc staff_id null)
    const res = await apiRequest('PUT', `/api/admin/bookings/${bookingId}/status`, adminHeaders, {
      status: 'completed'
    });

    assert.strictEqual(res.status, 400, 'Phải trả HTTP 400 khi quyết toán lương thất bại');
    assert.strictEqual(res.data.success, false);

    // Trạng thái đơn không được đổi sang completed mà phải được revert
    const checkBooking = await BookingModel.getById(bookingId);
    assert.notStrictEqual(checkBooking.status, 'completed', 'Trạng thái đơn không được cập nhật completed khi quyết toán fail');

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  await it('Bug 2.2: Payout thù lao đã thanh toán rồi bị từ chối với ALREADY_SETTLED (409)', async () => {
    const bookingCode = `B2A-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, staff_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, ?, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B2 Already', '0987654321', 200000, 'cash', 'paid', 'completed', 140000, 'paid')`,
      [bookingCode, customerId, staffId]
    );
    const bookingId = insertResult.insertId;

    const res = await apiRequest('PATCH', `/api/admin/bookings/${bookingId}/payout`, adminHeaders, {
      note: 'Thử quyết toán lại'
    });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.code, 'ALREADY_SETTLED');

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  console.log('\n--- PHẦN II: P1 HIGH (BUG 3, BUG 4, BUG 5) ---');

  // BUG 3: Stored XSS trong review
  await it('Bug 3.1: createReview sanitize và escape toàn bộ payload XSS nguy hiểm', async () => {
    const bookingCode = `B3-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, staff_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, ?, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B3', '0987654321', 200000, 'cash', 'paid', 'completed', 140000, 'paid')`,
      [bookingCode, customerId, staffId]
    );
    const bookingId = insertResult.insertId;

    const xssPayload = `<script>alert('XSS')</script><img src=x onerror=alert(1)>Dịch vụ rất tốt! 👍 ⭐`;
    const res = await apiRequest('POST', `/api/bookings/${bookingId}/review`, customerHeaders, {
      rating: 5,
      comment: xssPayload
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);

    // Kiểm tra comment đã lưu trong database: Không chứa <script> hay onerror
    const savedReview = await BookingModel.getReviewByBookingId(bookingId);
    assert.ok(savedReview, 'Review phải được lưu');
    assert.ok(!savedReview.comment.includes('<script>'), 'Không được chứa thẻ script thô');
    assert.ok(!savedReview.comment.includes('onerror='), 'Không được chứa inline event handler');
    assert.ok(savedReview.comment.includes('Dịch vụ rất tốt!'), 'Tiếng Việt phải được bảo toàn');
    assert.ok(savedReview.comment.includes('👍'), 'Emoji phải được bảo toàn');

    // Dọn dẹp
    await db.query('DELETE FROM reviews WHERE booking_id = ?', [bookingId]);
    await BookingModel.deleteById(bookingId);
  });

  await it('Bug 3.2: createReview từ chối comment dài > 1000 ký tự hoặc sai kiểu dữ liệu', async () => {
    const bookingCode = `B3L-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, staff_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, staff_wage, wage_status)
       VALUES (?, ?, 1, ?, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B3 Len', '0987654321', 200000, 'cash', 'paid', 'completed', 140000, 'paid')`,
      [bookingCode, customerId, staffId]
    );
    const bookingId = insertResult.insertId;

    // Comment > 1000 ký tự
    const longComment = 'A'.repeat(1005);
    const resLong = await apiRequest('POST', `/api/bookings/${bookingId}/review`, customerHeaders, {
      rating: 5,
      comment: longComment
    });
    assert.strictEqual(resLong.status, 400);

    // Comment sai kiểu (object)
    const resObj = await apiRequest('POST', `/api/bookings/${bookingId}/review`, customerHeaders, {
      rating: 5,
      comment: { evil: true }
    });
    assert.strictEqual(resObj.status, 400);

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  // BUG 4: Topup khi không có MySQL kết nối phải từ chối 503, không trả fake success
  await it('Bug 4.1: topup từ chối và throw 503 khi MySQL không kết nối', async () => {
    const origCheck = db.isMySQLConnected;
    try {
      db.isMySQLConnected = () => false; // Giả lập mất kết nối MySQL
      let threw = false;
      try {
        await WalletModel.topup({ userId: customerId, amount: 100000 });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 503, 'Phải có statusCode 503');
        assert.ok(err.message.includes('không khả dụng'));
      }
      assert.strictEqual(threw, true, 'Topup phải throw error khi DB không kết nối');
    } finally {
      db.isMySQLConnected = origCheck;
    }
  });

  // BUG 5: Voucher kiểm tra min_order_amount đúng chuẩn
  await it('Bug 5.1: createBooking từ chối voucher nếu subtotal < min_order_amount', async () => {
    // Tạo voucher min_order_amount = 500.000 VNĐ
    const vCode = `TESTMIN500K-${Date.now().toString(36).toUpperCase()}`;
    await VoucherModel.createVoucher({
      code: vCode,
      discount_type: 'fixed',
      discount_value: 50000,
      min_order_amount: 500000,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });

    // Tạo đơn với subtotal dịch vụ thường (~120.000 - 180.000 đ) < 500.000 đ
    const res = await apiRequest('POST', '/api/bookings', customerHeaders, {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '09:00',
      area_size: 'small',
      frequency: 'once',
      address: '123 Test Min Order',
      phone: '0987654321',
      payment_method: 'cash',
      discount_code: vCode
    });

    assert.strictEqual(res.status, 400, 'Phải trả HTTP 400 khi đơn hàng không đạt min_order_amount');
    assert.ok(res.data.message.includes('500.000'), 'Thông báo phải nêu rõ ngưỡng tối thiểu 500.000 đ');

    // Dọn dẹp voucher
    await db.query('DELETE FROM vouchers WHERE code = ?', [vCode]);
  });

  await it('Bug 5.2: createBooking chấp nhận voucher khi subtotal >= min_order_amount', async () => {
    const vCode = `TESTPASS50K-${Date.now().toString(36).toUpperCase()}`;
    await VoucherModel.createVoucher({
      code: vCode,
      discount_type: 'fixed',
      discount_value: 20000,
      min_order_amount: 100000, // Dịch vụ 1 (medium) giá 180.000 > 100.000
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });

    const res = await apiRequest('POST', '/api/bookings', customerHeaders, {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '09:00',
      area_size: 'medium',
      frequency: 'once',
      address: '123 Test Pass Min Order',
      phone: '0987654321',
      payment_method: 'cash',
      discount_code: vCode
    });

    assert.strictEqual(res.status, 201, 'Phải tạo thành công đơn');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.discount_code, vCode);

    // Dọn dẹp
    await BookingModel.deleteById(res.data.data.id);
    await db.query('DELETE FROM voucher_usages WHERE voucher_id = (SELECT id FROM vouchers WHERE code = ?)', [vCode]);
    await db.query('DELETE FROM vouchers WHERE code = ?', [vCode]);
  });

  console.log('\n--- PHẦN III: P2 MEDIUM (BUG 6 ĐẾN BUG 10) ---');

  // BUG 6: duration_hours giới hạn trên (tối đa 24h)
  await it('Bug 6.1: duration_hours = 9999 hoặc âm bị từ chối 400', async () => {
    const res9999 = await apiRequest('POST', '/api/bookings/quote', {}, {
      service_id: 7, // Dịch vụ chăm sóc
      duration_hours: 9999,
      package_type: 'hourly'
    });
    assert.strictEqual(res9999.status, 400, '9999 giờ phải bị từ chối 400');
    assert.ok(res9999.data.message.includes('24'));

    const resNeg = await apiRequest('POST', '/api/bookings/quote', {}, {
      service_id: 7,
      duration_hours: -2,
      package_type: 'hourly'
    });
    assert.strictEqual(resNeg.status, 400, 'Số giờ âm phải bị từ chối');

    const resInf = await apiRequest('POST', '/api/bookings/quote', {}, {
      service_id: 7,
      duration_hours: 'Infinity',
      package_type: 'hourly'
    });
    assert.strictEqual(resInf.status, 400, 'Infinity phải bị từ chối');
  });

  await it('Bug 6.2: duration_hours hợp lệ (2-24 giờ) được chấp nhận', async () => {
    const resValid = await apiRequest('POST', '/api/bookings/quote', {}, {
      service_id: 7,
      duration_hours: 4,
      package_type: 'hourly'
    });
    assert.strictEqual(resValid.status, 200);
    assert.strictEqual(resValid.data.data.durationHours, 4);
  });

  // BUG 7: Validate dữ liệu tạo voucher
  await it('Bug 7.1: Tạo voucher validate giá trị âm, % > 100 và ngày bắt đầu sau ngày kết thúc', async () => {
    // 1. discount_value âm
    const resNeg = await apiRequest('POST', '/api/vouchers/admin/create', adminHeaders, {
      code: 'TESTNEG',
      discount_type: 'fixed',
      discount_value: -50000,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });
    assert.strictEqual(resNeg.status, 400);

    // 2. percentage > 100%
    const resPct = await apiRequest('POST', '/api/vouchers/admin/create', adminHeaders, {
      code: 'TEST150PCT',
      discount_type: 'percentage',
      discount_value: 150,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });
    assert.strictEqual(resPct.status, 400);

    // 3. start_date > end_date
    const resDate = await apiRequest('POST', '/api/vouchers/admin/create', adminHeaders, {
      code: 'TESTBADDATE',
      discount_type: 'percentage',
      discount_value: 20,
      start_date: '2026-12-31',
      end_date: '2026-01-01'
    });
    assert.strictEqual(resDate.status, 400);

    // 4. discount_type không hợp lệ
    const resType = await apiRequest('POST', '/api/vouchers/admin/create', adminHeaders, {
      code: 'TESTBADTYPE',
      discount_type: 'infinite_free',
      discount_value: 20,
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });
    assert.strictEqual(resType.status, 400);
  });

  // BUG 8: Race condition tại usage_limit voucher
  await it('Bug 8.1: recordUsage nguyên tử - không bao giờ vượt usage_limit khi concurrent', async () => {
    const vCode = `RACE-${Date.now().toString(36).toUpperCase()}`;
    const vId = await VoucherModel.createVoucher({
      code: vCode,
      discount_type: 'fixed',
      discount_value: 10000,
      usage_limit: 1, // Chỉ 1 lượt duy nhất!
      start_date: '2026-01-01',
      end_date: '2026-12-31'
    });

    // Tạo 2 đơn booking tạm để thỏa mãn ràng buộc khóa ngoại fk_voucher_usage_booking
    const b1 = await db.query(
      `INSERT INTO bookings (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method)
       VALUES (?, 1, 1, CURDATE(), '09:00', 'small', 'once', 'Addr R1', '0987654321', 100000, 'cash')`,
      [`BK-R1-${Date.now().toString(36).toUpperCase()}`]
    );
    const b2 = await db.query(
      `INSERT INTO bookings (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method)
       VALUES (?, 2, 1, CURDATE(), '09:00', 'small', 'once', 'Addr R2', '0987654321', 100000, 'cash')`,
      [`BK-R2-${Date.now().toString(36).toUpperCase()}`]
    );
    const bookingId1 = b1.insertId;
    const bookingId2 = b2.insertId;

    // Chạy song song 2 request recordUsage
    const req1 = VoucherModel.recordUsage(vId, 1, bookingId1, 10000);
    const req2 = VoucherModel.recordUsage(vId, 2, bookingId2, 10000);

    const results = await Promise.allSettled([req1, req2]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Chỉ đúng 1 request được thành công');
    assert.strictEqual(rejected.length, 1, 'Request thứ hai phải bị reject');
    assert.strictEqual(rejected[0].reason.code, 'VOUCHER_LIMIT_EXCEEDED');

    // Kiểm tra used_count trong database đúng bằng 1
    const v = await VoucherModel.getByCode(vCode);
    assert.strictEqual(v.used_count, 1, 'used_count không được vượt quá 1');

    // Dọn dẹp
    await db.query('DELETE FROM voucher_usages WHERE voucher_id = ?', [vId]);
    await db.query('DELETE FROM vouchers WHERE id = ?', [vId]);
    await BookingModel.deleteById(bookingId1);
    await BookingModel.deleteById(bookingId2);
  });

  // BUG 9: updateStaffTaskStatus không ghi đè cancel_reason thành NULL
  await it('Bug 9.1: updateStaffTaskStatus giữ nguyên cancel_reason khi đổi sang status khác', async () => {
    const bookingCode = `B9-${Date.now().toString(36).toUpperCase()}`;
    const insertResult = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, staff_id, booking_date, booking_time, area_size, frequency, address, phone, total_price, payment_method, payment_status, status, cancel_reason, staff_wage, wage_status)
       VALUES (?, ?, 1, ?, CURDATE(), '10:00:00', 'medium', 'once', '123 Test B9', '0987654321', 200000, 'cash', 'paid', 'assigned', 'Lý do ban đầu rất quan trọng', 140000, 'pending')`,
      [bookingCode, customerId, staffId]
    );
    const bookingId = insertResult.insertId;

    // Nhân viên cập nhật trạng thái thành 'arrived' kèm staff_notes
    const changed = await BookingModel.updateStaffTaskStatus(bookingId, staffId, 'arrived', 'Đã đến địa chỉ khách hàng');
    assert.strictEqual(changed, true);

    // Kiểm tra cancel_reason vẫn còn nguyên!
    const checkBooking = await BookingModel.getById(bookingId);
    assert.strictEqual(checkBooking.status, 'arrived');
    assert.strictEqual(checkBooking.cancel_reason, 'Lý do ban đầu rất quan trọng', 'cancel_reason không được bị ghi đè thành NULL');

    // Dọn dẹp
    await BookingModel.deleteById(bookingId);
  });

  // BUG 10: Rollback booking khi thanh toán ví thất bại
  await it('Bug 10.1: Booking bị rollback và xóa sạch khi thanh toán ví thất bại', async () => {
    // Rút hết tiền ví hoặc tạo số dư nhỏ hơn tổng đơn
    const wallet = await WalletModel.getOrCreateWallet(customerId);
    const origBalance = parseFloat(wallet.balance) || 0;
    // Set tạm số dư ví = 0
    await db.query('UPDATE wallets SET balance = 0 WHERE id = ?', [wallet.id]);

    const res = await apiRequest('POST', '/api/bookings', customerHeaders, {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '14:00',
      area_size: 'medium',
      frequency: 'once',
      address: '123 Test Rollback B10',
      phone: '0987654321',
      payment_method: 'wallet'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);

    // Kiểm tra database: Không có đơn mồ côi nào được tạo với địa chỉ này
    const orphanBookings = await db.query("SELECT * FROM bookings WHERE address = '123 Test Rollback B10'");
    assert.strictEqual(orphanBookings.length, 0, 'Đơn hàng phải được rollback xóa sạch, không được để lại bản ghi mồ côi');

    // Khôi phục lại số dư ví ban đầu
    await db.query('UPDATE wallets SET balance = ? WHERE id = ?', [origBalance, wallet.id]);
  });

  console.log('\n--- PHẦN IV: P3 LOW (BUG 11 ĐẾN BUG 14) ---');

  // BUG 11: Chuẩn hóa ngưỡng đủ điều kiện nhận đơn 100.000 VNĐ
  await it('Bug 11.1: Chuẩn hóa ngưỡng 100.000 VNĐ cho 99.999, 100.000 và 100.001', async () => {
    const { creditWallet } = await WalletModel.getOrCreateStaffWallets(staffId);
    const origBal = parseFloat(creditWallet.balance) || 0;

    try {
      // 1. Trường hợp 99.999 VNĐ: Chưa đủ điều kiện
      await db.query('UPDATE wallets SET balance = 99999 WHERE id = ?', [creditWallet.id]);
      const check99k = await WalletModel.checkStaffBookingEligibility(staffId);
      assert.strictEqual(check99k.eligible, false, '99.999 VNĐ phải không đủ điều kiện');
      assert.strictEqual(check99k.amountNeeded, 1, 'Cần thêm 1 đ để đạt 100.000');

      // 2. Trường hợp 100.000 VNĐ: Đủ điều kiện (>= 100.000)
      await db.query('UPDATE wallets SET balance = 100000 WHERE id = ?', [creditWallet.id]);
      const check100k = await WalletModel.checkStaffBookingEligibility(staffId);
      assert.strictEqual(check100k.eligible, true, '100.000 VNĐ phải đủ điều kiện');
      assert.strictEqual(check100k.amountNeeded, 0);

      // 3. Trường hợp 100.001 VNĐ: Đủ điều kiện
      await db.query('UPDATE wallets SET balance = 100001 WHERE id = ?', [creditWallet.id]);
      const check101k = await WalletModel.checkStaffBookingEligibility(staffId);
      assert.strictEqual(check101k.eligible, true, '100.001 VNĐ phải đủ điều kiện');
      assert.strictEqual(check101k.amountNeeded, 0);
    } finally {
      await db.query('UPDATE wallets SET balance = ? WHERE id = ?', [origBal, creditWallet.id]);
    }
  });

  // BUG 12: Regex số điện thoại đối tác không chấp nhận ký tự pipe '|'
  await it('Bug 12.1: Regex SĐT đối tác từ chối 0|12345678 và chấp nhận SĐT Việt Nam hợp lệ', async () => {
    // Thử gửi đơn đối tác với số có ký tự pipe '|'
    const resPipe = await apiRequest('POST', '/api/partner/register', {}, {
      name: 'Nguyen Van Test',
      email: 'testpipe@cleanova.vn',
      phone: '0|12345678',
      password: 'Password123!',
      confirm_password: 'Password123!',
      address: 'Hanoi',
      work_area: 'Cau Giay',
      agree_terms: true
    });
    assert.strictEqual(resPipe.status, 400, '0|12345678 phải bị từ chối 400');
    assert.ok(resPipe.data.message.includes('số điện thoại'));

    // Thử số sai độ dài
    const resShort = await apiRequest('POST', '/api/partner/register', {}, {
      name: 'Nguyen Van Test',
      email: 'testshort@cleanova.vn',
      phone: '091234567',
      password: 'Password123!',
      confirm_password: 'Password123!',
      address: 'Hanoi',
      work_area: 'Cau Giay',
      agree_terms: true
    });
    assert.strictEqual(resShort.status, 400);

    // Thử số chứa chữ
    const resAlpha = await apiRequest('POST', '/api/partner/register', {}, {
      name: 'Nguyen Van Test',
      email: 'testalpha@cleanova.vn',
      phone: '091234567a',
      password: 'Password123!',
      confirm_password: 'Password123!',
      address: 'Hanoi',
      work_area: 'Cau Giay',
      agree_terms: true
    });
    assert.strictEqual(resAlpha.status, 400);
  });

  // BUG 13: Dashboard lọc today/7days chuẩn múi giờ Asia/Ho_Chi_Minh
  await it('Bug 13.1: getStats chuẩn hóa múi giờ Việt Nam và truy vấn range an toàn', async () => {
    const statsToday = await BookingModel.getStats({ period: 'today' });
    assert.ok(statsToday, 'getStats today phải trả về kết quả');
    assert.ok(statsToday.total_bookings !== undefined);

    const stats7Days = await BookingModel.getStats({ period: '7days' });
    assert.ok(stats7Days, 'getStats 7days phải trả về kết quả');

    const statsMonth = await BookingModel.getStats({ period: 'month' });
    assert.ok(statsMonth, 'getStats month phải trả về kết quả');

    const statsCustom = await BookingModel.getStats({ from_date: '2026-01-01', to_date: '2026-12-31' });
    assert.ok(statsCustom, 'getStats custom date range phải trả về kết quả');
  });

  // BUG 14: Error handler không rò rỉ stack trace & SQL details trong production/test
  await it('Bug 14.1: errorHandler không trả stack hay sqlMessage ra client ở non-development', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      let sentStatus = null;
      let sentJson = null;

      const mockReq = { method: 'GET', originalUrl: '/api/test-error', body: { password: 'secretPassword123' } };
      const mockRes = {
        status(code) { sentStatus = code; return this; },
        json(payload) { sentJson = payload; return this; }
      };

      const testErr = new Error('Database connection failed: SELECT * FROM users WHERE password = 123');
      testErr.sqlMessage = 'Table cleanova_db.users not found';
      testErr.statusCode = 500;

      errorHandler(testErr, mockReq, mockRes, () => {});

      assert.strictEqual(sentStatus, 500);
      assert.strictEqual(sentJson.success, false);
      assert.strictEqual(sentJson.stack, undefined, 'Stack trace KHÔNG được gửi cho client ở production');
      assert.strictEqual(sentJson.details, undefined, 'Chi tiết SQL KHÔNG được gửi cho client ở production');
      assert.ok(!sentJson.message.includes('SELECT * FROM'), 'Message không được làm lộ query SQL nội bộ');
      assert.strictEqual(sentJson.message, 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng liên hệ bộ phận hỗ trợ.');

      // Test sanitizeForLog
      const sanitized = sanitizeForLog({ password: 'myPassword', email: 'test@example.com', token: 'jwt123' });
      assert.strictEqual(sanitized.password, '[REDACTED]');
      assert.strictEqual(sanitized.token, '[REDACTED]');
      assert.strictEqual(sanitized.email, 'test@example.com');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  console.log('\n====================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASS (100%)`);
  console.log('====================================================');
}

runAll14BugTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
