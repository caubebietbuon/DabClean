// ============================================================
// Test Suite: Khách vãng lai & Phân quyền bảo mật CleanNova
// ============================================================
const http = require('http');

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) { parsed = body; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- BẮT ĐẦU KIỂM THỬ TÍNH NĂNG KHÁCH VÃNG LAI & BẢO MẬT ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${extraInfo}`);
      failed++;
    }
  }

  try {
    // 1. Kiểm tra truy cập trang chủ công khai ('/')
    const resHome = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/',
      method: 'GET'
    });
    assert(resHome.statusCode === 200 && typeof resHome.data === 'string' && (resHome.data.includes('DabClean') || resHome.data.includes('Cleanova')),
      'Test 1: Mở website gốc (/) phục vụ thẳng trang chủ trangchu.html');

    // 2. Kiểm tra truy cập trang /trangchu.html
    const resTrangChu = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/trangchu.html',
      method: 'GET'
    });
    assert(resTrangChu.statusCode === 200, 'Test 2: Mở /trangchu.html trực tiếp không bị chặn hay 302 redirect');

    // 3. Khách vãng lai xem danh mục dịch vụ (GET /api/services)
    const resServices = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/services',
      method: 'GET'
    });
    assert(resServices.statusCode === 200 && resServices.data.success === true && Array.isArray(resServices.data.data),
      'Test 3: Khách vãng lai xem được danh mục dịch vụ thực tế từ backend');

    // 4. Khách vãng lai xem đánh giá công khai (GET /api/bookings/reviews/all)
    const resReviews = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings/reviews/all',
      method: 'GET'
    });
    assert(resReviews.statusCode === 200 && resReviews.data.success === true,
      'Test 4: Khách vãng lai xem được các đánh giá khách hàng công khai');

    // 5. Khách vãng lai gọi tạo đơn hàng không có token (POST /api/bookings) -> Phải từ chối 401
    const resCreateBookingNoAuth = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      service_id: 1,
      booking_date: '2026-10-20',
      booking_time: '08:00',
      address: '123 Đường Test, Quận 1',
      phone: '0901234567'
    });
    assert(resCreateBookingNoAuth.statusCode === 401 && resCreateBookingNoAuth.data.success === false,
      'Test 5: Backend từ chối khách vãng lai gọi trực tiếp API tạo đơn (HTTP 401)');

    // 6. Đăng nhập tài khoản Customer hợp lệ
    const resLoginCustomer = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'demo@nova.app',
      password: 'NovaDemo2026!'
    });
    const customerToken = resLoginCustomer.data?.data?.token;
    const customerUser = resLoginCustomer.data?.data?.user;
    assert(resLoginCustomer.statusCode === 200 && !!customerToken && customerUser?.role === 'customer',
      'Test 6: Đăng nhập tài khoản Customer trả về JWT hợp lệ');

    // 7. Customer đã đăng nhập tạo đơn dịch vụ thành công
    const resCreateBookingAuth = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      }
    }, {
      service_id: 1,
      booking_date: '2026-10-25',
      booking_time: '09:00',
      area_size: 'medium',
      frequency: 'once',
      address: '123 Test Street, HCM',
      phone: '0901234567'
    });
    const createdBookingId = resCreateBookingAuth.data?.data?.id;
    assert(resCreateBookingAuth.statusCode === 201 && !!createdBookingId,
      'Test 7: Customer đã đăng nhập tạo đơn thành công với giá tính toán an toàn từ server');

    // 8. Customer xem danh sách đơn của mình (GET /api/bookings/my-bookings)
    const resMyBookings = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings/my-bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert(resMyBookings.statusCode === 200 && Array.isArray(resMyBookings.data?.data),
      'Test 8: Customer xem được danh sách đơn đặt của chính mình');

    // 9. Customer cố tình gọi API Admin (GET /api/admin/overview) -> Phải từ chối 403
    const resAdminAttempt = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert(resAdminAttempt.statusCode === 403,
      'Test 9: Phân quyền RBAC chặn tài khoản Customer truy cập API Admin (HTTP 403)');

    // 10. Customer cố tình gọi API Staff (GET /api/staff/overview) -> Phải từ chối 403
    const resStaffAttempt = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/staff/overview',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert(resStaffAttempt.statusCode === 403,
      'Test 10: Phân quyền RBAC chặn tài khoản Customer truy cập API Nhân viên (HTTP 403)');

    // 11. Đăng nhập tài khoản Admin
    const resLoginAdmin = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'admin@cleanova.vn',
      password: 'Admin@Cleanova2026!'
    });
    const adminToken = resLoginAdmin.data?.data?.token;
    assert(resLoginAdmin.statusCode === 200 && resLoginAdmin.data?.data?.user?.role === 'admin',
      'Test 11: Đăng nhập tài khoản Admin thành công');

    // 12. Admin truy cập API Admin (GET /api/admin/stats) -> 200
    const resAdminAccess = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(resAdminAccess.statusCode === 200 && resAdminAccess.data.success === true,
      'Test 12: Admin truy cập đúng khu vực quản trị được cấp quyền');

    console.log(`\n--- TỔNG KẾT: ${passed} PASS, ${failed} FAIL ---`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Lỗi kiểm thử:', err);
    process.exit(1);
  }
}

runTests();
