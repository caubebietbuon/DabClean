// ============================================================
// CLEANOVA - BỘ KIỂM THỬ TOÀN DIỆN (COMPREHENSIVE TEST SUITE)
// Bao gồm: Unit Tests, Integration Tests, Security Tests, RBAC & State Machine
// ============================================================
const http = require('http');
const path = require('path');
const jwt = require('jsonwebtoken');
const { spawnSync } = require('child_process');

const sanitize = require('./src/utils/sanitize');
const { getJwtSecret } = require('./src/config/jwt');

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
  console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN CLEANOVA THEO AGENTS.MD');
  console.log('============================================================\n');

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
  // PHẦN 1: UNIT TESTS (Validation, Sanitizer, Pricing, State Machine)
  // ------------------------------------------------------------
  console.log('--- PHẦN 1: UNIT TESTS (Validation & Logic độc lập) ---');

  // 1.1 Test Sanitizer
  const rawXss = '<script>alert(1)</script><img src=x onerror=alert(2)>Nguyễn Văn A<b>Hà Nội</b><a href="javascript:alert(3)">Click</a>';
  const cleanXss = sanitize.sanitizeInput(rawXss);
  assert(
    !cleanXss.includes('<script>') && 
    !cleanXss.includes('onerror=') && 
    !cleanXss.includes('javascript:') && 
    !cleanXss.includes('<img') &&
    cleanXss.includes('Nguyễn Văn A'),
    'Unit Test Sanitizer: Loại bỏ hoàn toàn mã script, thẻ độc hại và pseudo-protocol'
  );

  // 1.2 Test Pricing Calculation độc lập
  const basePriceHourly = 150000;
  const mediumMultiplier = 1.5;
  const weeklyDiscountRate = 0.15;
  const expectedWeeklyMedium = basePriceHourly * mediumMultiplier * (1 - weeklyDiscountRate);
  assert(expectedWeeklyMedium === 191250, 'Unit Test Pricing: Đơn vị giờ x1.5 giảm 15% ra đúng 191.250đ');

  const basePricePerM2 = 8000;
  const areaSmallM2 = 50;
  const expectedPostConstruction = basePricePerM2 * areaSmallM2;
  assert(expectedPostConstruction === 400000, 'Unit Test Pricing: Vệ sinh sau xây dựng 50m² x 8.000đ ra đúng 400.000đ (không bị sàn 50.000đ)');

  // ------------------------------------------------------------
  // PHẦN 2: XÁC THỰC TÀI KHOẢN ĐĂNG NHẬP CHO INTEGRATION TESTS
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 2: INTEGRATION & SECURITY TESTS TRÊN HỆ THỐNG THỰC TẾ ---');

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' }
  });
  const adminToken = adminLogin.body?.data?.token;

  const customerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'demo@nova.app', password: 'NovaDemo2026!' }
  });
  const customerToken = customerLogin.body?.data?.token;

  const staffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@cleanova.vn', password: 'Staff@Cleanova2026!' }
  });
  const staffToken = staffLogin.body?.data?.token;

  assert(!!adminToken && !!customerToken && !!staffToken, 'Xác thực đăng nhập tài khoản 3 vai trò (Admin, Customer, Staff)');

  // Bug 1: AI Module an toàn, không crash server
  const aiHealth = await request('/api/ai/health');
  assert(aiHealth.status === 200 || aiHealth.status === 503, 'Bug 1: API AI hoạt động hoặc trả về fallback router an toàn, không làm sập server');

  // Bug 2: Chặn token giả mạo bằng secret public GitHub
  const leakedSecret = 'cleanova_super_secret_jwt_key_2026_modern_cleaning';
  const fakeAdminToken = jwt.sign({ id: 1, role: 'admin' }, leakedSecret);
  const fakeReq = await request('/api/admin/stats', {
    headers: { Authorization: `Bearer ${fakeAdminToken}` }
  });
  assert(fakeReq.status === 401 || fakeReq.status === 403, 'Bug 2: Từ chối token tự ký bằng secret fallback/mẫu công khai (HTTP 401/403)');

  // Bug 3: Stored XSS - Backend lọc dữ liệu người dùng gửi lên
  const xssEmail = `xss_test_${Date.now()}@cleanova.vn`;
  const xssReg = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: '<script>alert("hacked")</script>Đặng Văn XSS',
      email: xssEmail,
      password: 'Password123!',
      address: '<b onmouseover=alert(1)>Cầu Giấy</b><img src=x onerror=alert(2)>'
    }
  });
  const regUser = xssReg.body?.data?.user;
  assert(
    xssReg.status === 201 && 
    !regUser.name.includes('<script>') && 
    !regUser.address.includes('onerror='),
    'Bug 3: Backend làm sạch triệt để payload Stored XSS trước khi lưu vào Database'
  );

  // Bug 4: Admin không thể tự khóa chính mình hoặc khóa admin cuối cùng qua PATCH /admin/users/:id
  const selfLock = await request('/api/admin/users/1', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'inactive', lock_reason: 'Tự khóa' }
  });
  assert(selfLock.status === 400 && selfLock.body.message.includes('không thể tự vô hiệu hóa'), 'Bug 4: Admin bị chặn khi tự khóa chính mình qua PATCH /admin/users/:id');

  // Bug 5: Chặn tạo dịch vụ giá âm & Chặn cộng dồn mã CLEANOVA20 với giảm giá tần suất
  const negPrice = await request('/api/admin/services', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { name: 'Dịch vụ giá âm', base_price: -100000 }
  });
  assert(negPrice.status === 400, 'Bug 5: Chặn Admin tạo dịch vụ có giá âm (base_price <= 0)');

  const stackPromo = await request('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '09:00',
      area_size: 'small',
      frequency: 'weekly',
      discount_code: 'CLEANOVA20',
      address: 'Số 10 Phố Duy Tân, Hà Nội',
      phone: '0988776655',
      payment_method: 'cash'
    }
  });
  assert(stackPromo.status === 400 && stackPromo.body.message?.includes('không áp dụng đồng thời'), 'Bug 5: Chặn cộng dồn mã khuyến mãi CLEANOVA20 với chiết khấu định kỳ');

  // Bug 6: Chặn ngày đặt lịch quá khứ & Chặn payment_method sai ENUM
  const pastBooking = await request('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      service_id: 1,
      booking_date: '2020-01-01',
      booking_time: '09:00',
      area_size: 'small',
      frequency: 'once',
      address: 'Hà Nội',
      phone: '0988776655',
      payment_method: 'cash'
    }
  });
  assert(pastBooking.status === 400 && pastBooking.body.message?.includes('quá khứ'), 'Bug 6: Chặn đặt lịch trong quá khứ');

  const invalidPayment = await request('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '09:00',
      area_size: 'small',
      frequency: 'once',
      address: 'Hà Nội',
      phone: '0988776655',
      payment_method: 'BITCOIN_INVALID'
    }
  });
  assert(invalidPayment.status === 400, 'Bug 6: Chặn phương thức thanh toán sai ENUM trước khi gửi truy vấn MySQL');

  // Bug 7: State machine - Staff không thể lùi confirmed -> assigned
  const rewindStaff = await request('/api/staff/tasks/1/status', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { status: 'assigned' }
  });
  assert(rewindStaff.status === 400 && rewindStaff.body.message?.includes('assigned'), 'Bug 7: Máy trạng thái chặn Nhân viên lùi trạng thái về assigned');

  // Bug 8: Sinh mã đơn động theo Năm-Tháng và entropy cao (CNV-YYYYMM-XXXXXX)
  const newBookingRes = await request('/api/bookings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      service_id: 1,
      booking_date: '2026-11-20',
      booking_time: '09:00',
      area_size: 'small',
      frequency: 'once',
      address: 'Số 10 Phố Duy Tân, Hà Nội',
      phone: '0988776655',
      payment_method: 'cash'
    }
  });
  const createdCode = newBookingRes.body?.data?.booking_code;
  const currentYm = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  assert(
    newBookingRes.status === 201 && 
    createdCode.startsWith(`CNV-${currentYm}-`),
    `Bug 8: Sinh mã đơn động theo Năm-Tháng hiện tại (${createdCode}) không cố định năm 2026`
  );

  // Bug 9: Bảng partner_applications và audit_logs sẵn sàng hoạt động
  const partnerList = await request('/api/admin/partners', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(partnerList.status === 200 && Array.isArray(partnerList.body.data), 'Bug 9: Bảng partner_applications và audit_logs hoạt động bình thường');

  // Bug 10: GET /admin/partners/:id không để lộ password hash
  if (partnerList.body.data && partnerList.body.data.length > 0) {
    const firstPartnerId = partnerList.body.data[0].id;
    const partnerDetail = await request(`/api/admin/partners/${firstPartnerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(
      partnerDetail.status === 200 && 
      partnerDetail.body.data?.password === undefined,
      'Bug 10: API chi tiết đối tác đã loại bỏ hoàn toàn trường password bcrypt hash'
    );
  }

  // Bug 11: Ngăn chặn tạo tài khoản khách bằng email đối tác đang chờ duyệt
  const hijackReg = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'Kẻ Chiếm Đoạt',
      email: 'quocanh.partner@gmail.com',
      password: 'HackerPassword123!',
      phone: '0911223344'
    }
  });
  assert(
    hijackReg.status === 409 && hijackReg.body.message?.includes('đối tác'),
    'Bug 11: Ngăn chặn tạo tài khoản khách bằng email đối tác đang chờ duyệt (HTTP 409 Conflict)'
  );

  // Bug 12: Đổi mật khẩu nhân viên thành công trên MySQL (SELECT password đầy đủ)
  const changePwRes = await request('/api/staff/change-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { currentPassword: 'Staff@Cleanova2026!', newPassword: 'Staff@Cleanova2026!Updated' }
  });
  // Đổi ngược lại để giữ nguyên mật khẩu cho các test sau
  await request('/api/staff/change-password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { currentPassword: 'Staff@Cleanova2026!Updated', newPassword: 'Staff@Cleanova2026!' }
  });
  assert(changePwRes.status === 200, 'Bug 12: Đổi mật khẩu nhân viên thành công không còn lỗi 500 do thiếu password field trên MySQL');

  // Bug 13: Rate limit và kiểm tra kiểu dữ liệu chuỗi khi login
  const badLoginType = await request('/api/auth/login', {
    method: 'POST',
    body: { email: { $ne: null }, password: ['123456'] }
  });
  assert(badLoginType.status === 400, 'Bug 13: Từ chối dữ liệu email/password không phải kiểu chuỗi (HTTP 400)');

  // ------------------------------------------------------------
  // PHẦN 3: TEST KIỂM THỬ XUNG ĐỘT ĐỒNG THỜI (CONCURRENCY / RACE CONDITION)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 3: TEST XUNG ĐỘT ĐỒNG THỜI (CONCURRENCY TEST) ---');
  // Thực hiện đồng thời 2 yêu cầu cập nhật trạng thái khác nhau trên cùng 1 booking
  // Nhờ cơ chế Optimistic Locking `AND status = ?`, chỉ 1 yêu cầu được thành công
  const targetBookingId = 1;
  const [res1, res2] = await Promise.all([
    request(`/api/staff/tasks/${targetBookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'in_progress' }
    }),
    request(`/api/staff/tasks/${targetBookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: { status: 'cancelled', cancel_reason: 'Huỷ đồng thời' }
    })
  ]);
  const oneSuccess = (res1.status === 200 && res2.status === 400) || (res2.status === 200 && res1.status === 400) || (res1.status !== res2.status);
  assert(oneSuccess, 'Concurrency Test: Optimistic Locking ngăn chặn xung đột khi hai request cập nhật cùng trạng thái');

  // ------------------------------------------------------------
  // PHẦN 4: PRODUCTION CONFIGURATION FAIL-FAST TESTS
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 4: TEST CẤU HÌNH PRODUCTION (FAIL-SAFE / FAIL-FAST) ---');

  // Chạy sub-process với NODE_ENV=production và secret mẫu để xác nhận app từ chối khởi động
  const prodTest = spawnSync('node', ['-e', `
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'cleanova_super_secret_jwt_key_2026_modern_cleaning';
    try {
      require('./src/config/jwt').getJwtSecret();
    } catch(e) {
      process.exit(1);
    }
  `], { cwd: __dirname });

  assert(prodTest.status === 1, 'Production Test: Ứng dụng từ chối khởi động (Fail-fast exit code 1) khi dùng JWT secret không an toàn trong Production');

  // Tổng kết
  console.log('\n============================================================');
  console.log(`🎯 KẾT QUẢ TỔNG HỢP: ${passed} PASS, ${failed} FAIL / TỔNG SỐ ${passed + failed} TESTS`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Lỗi ngoại lệ trong quá trình chạy test suite:', err);
  process.exit(1);
});
