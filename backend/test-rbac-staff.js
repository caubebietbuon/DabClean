/**
 * ============================================================
 * CLEANOVA RBAC & STAFF SUITE TEST (10 Kiểm Thử Bắt Buộc)
 * ============================================================
 */
const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:5000${path}`);
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
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Bắt đầu chạy bộ kiểm thử toàn diện RBAC, Admin & Staff Cleanova...\n');
  let passed = 0;
  let total = 10;

  // 1. Đăng nhập 3 tài khoản mẫu
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' }
  });
  const adminToken = adminLogin.body?.data?.token;

  const staffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'staff@cleanova.vn', password: 'Staff@Cleanova2026!' }
  });
  const staffToken = staffLogin.body?.data?.token;

  const customerLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'demo@nova.app', password: 'NovaDemo2026!' }
  });
  const customerToken = customerLogin.body?.data?.token;

  if (!adminToken || !staffToken || !customerToken) {
    console.error('❌ Lỗi đăng nhập tài khoản mẫu!');
    process.exit(1);
  }

  // TEST 1: Admin xem danh sách tài khoản
  try {
    const res = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (res.status === 200 && res.body.success && Array.isArray(res.body.data) && res.body.data.length > 0) {
      console.log('✅ TEST 1: Admin xem danh sách tài khoản thành công (Số lượng: ' + res.body.data.length + ')');
      passed++;
    } else {
      console.log('❌ TEST 1 FAILED:', res.body);
    }
  } catch (e) { console.log('❌ TEST 1 ERROR:', e.message); }

  // TEST 2: Admin vô hiệu hóa và kích hoạt lại tài khoản
  try {
    // Vô hiệu hóa tài khoản user ID 5
    const deactivateRes = await request('/api/admin/users/5/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'inactive' }
    });
    // Kích hoạt lại
    const activateRes = await request('/api/admin/users/5/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'active' }
    });
    if (deactivateRes.status === 200 && deactivateRes.body.success && activateRes.status === 200 && activateRes.body.success) {
      console.log('✅ TEST 2: Admin vô hiệu hóa và kích hoạt lại tài khoản thành công.');
      passed++;
    } else {
      console.log('❌ TEST 2 FAILED:', deactivateRes.body, activateRes.body);
    }
  } catch (e) { console.log('❌ TEST 2 ERROR:', e.message); }

  // TEST 3: Admin xóa tài khoản theo đúng quy tắc
  try {
    // Tạo 1 tài khoản tạm không có booking
    const regTemp = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Tài Khoản Tạm',
        email: `temp_${Date.now()}@example.com`,
        password: 'Password123!',
        phone: '0988776655'
      }
    });
    const tempUserId = regTemp.body?.data?.user?.id;
    if (tempUserId) {
      const delRes = await request(`/api/admin/users/${tempUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (delRes.status === 200 && delRes.body.success) {
        console.log(`✅ TEST 3: Admin xóa tài khoản tạm #${tempUserId} hợp lệ thành công.`);
        passed++;
      } else {
        console.log('❌ TEST 3 FAILED:', delRes.body);
      }
    } else {
      console.log('❌ TEST 3 FAILED: Không tạo được user tạm');
    }
  } catch (e) { console.log('❌ TEST 3 ERROR:', e.message); }

  // TEST 4: Admin không thể tự xóa mình hoặc xóa Admin cuối cùng còn hoạt động
  try {
    // Thử tự xóa tài khoản Admin (ID 1)
    const selfDel = await request('/api/admin/users/1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    // Thử xóa tài khoản có booking liên kết (ID 2 có booking)
    const linkedDel = await request('/api/admin/users/2', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (selfDel.status === 400 && !selfDel.body.success && linkedDel.status === 400 && !linkedDel.body.success) {
      console.log('✅ TEST 4: Admin bị chặn khi tự xóa chính mình hoặc xóa tài khoản có đơn booking thành công.');
      passed++;
    } else {
      console.log('❌ TEST 4 FAILED:', selfDel.body, linkedDel.body);
    }
  } catch (e) { console.log('❌ TEST 4 ERROR:', e.message); }

  // TEST 5: Customer không thể gọi API quản trị
  try {
    const custAdminReq = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    if (custAdminReq.status === 403 && !custAdminReq.body.success) {
      console.log('✅ TEST 5: Customer bị chặn 403 khi gọi API quản trị /api/admin/users.');
      passed++;
    } else {
      console.log('❌ TEST 5 FAILED:', custAdminReq.status, custAdminReq.body);
    }
  } catch (e) { console.log('❌ TEST 5 ERROR:', e.message); }

  // TEST 6: Staff không thể truy cập API quản trị
  try {
    const staffAdminReq = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (staffAdminReq.status === 403 && !staffAdminReq.body.success) {
      console.log('✅ TEST 6: Staff bị chặn 403 khi cố truy cập API Admin.');
      passed++;
    } else {
      console.log('❌ TEST 6 FAILED:', staffAdminReq.status, staffAdminReq.body);
    }
  } catch (e) { console.log('❌ TEST 6 ERROR:', e.message); }

  // TEST 7: Staff chỉ xem công việc được phân công
  try {
    const tasksRes = await request('/api/staff/tasks', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    const myTasks = tasksRes.body?.data || [];
    // Thử truy cập công việc không phải của mình (task 3 được giao cho staff ID 4 Mai, trong khi token là của Bảo ID 3)
    const unauthorizedTask = await request('/api/staff/tasks/3', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });

    if (tasksRes.status === 200 && tasksRes.body.success && unauthorizedTask.status === 403) {
      console.log(`✅ TEST 7: Staff xem công việc được giao (${myTasks.length} việc) và bị chặn 403 khi truy cập việc của người khác.`);
      passed++;
    } else {
      console.log('❌ TEST 7 FAILED:', tasksRes.status, unauthorizedTask.status, unauthorizedTask.body);
    }
  } catch (e) { console.log('❌ TEST 7 ERROR:', e.message); }

  // TEST 8: Thay đổi trạng thái công việc được lưu vào Database
  try {
    const updateTaskRes = await request('/api/staff/tasks/1/status', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: {
        status: 'in_progress',
        staff_notes: 'Đã có mặt tại địa chỉ khách và bắt đầu lau dọn phòng khách.'
      }
    });
    // Kiểm tra lại chi tiết
    const verifyTask = await request('/api/staff/tasks/1', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    if (updateTaskRes.status === 200 && updateTaskRes.body.success && verifyTask.body?.data?.status === 'in_progress') {
      console.log('✅ TEST 8: Nhân viên cập nhật trạng thái công việc thành "in_progress" được lưu chính xác.');
      passed++;
    } else {
      console.log('❌ TEST 8 FAILED:', updateTaskRes.body, verifyTask.body);
    }
  } catch (e) { console.log('❌ TEST 8 ERROR:', e.message); }

  // TEST 9: Tài khoản bị vô hiệu hóa không thể tiếp tục sử dụng phiên đăng nhập
  try {
    // Đăng nhập bằng tài khoản bị khóa locked@cleanova.vn
    const lockedLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'locked@cleanova.vn', password: 'NovaDemo2026!' }
    });
    // Hoặc vô hiệu hóa tài khoản tạm đang có token
    const testUser = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Khách Test Khóa', email: `locked_${Date.now()}@test.vn`, password: 'Password123!' }
    });
    const testToken = testUser.body?.data?.token;
    const testId = testUser.body?.data?.user?.id;

    // Vô hiệu hóa tài khoản này
    await request(`/api/admin/users/${testId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'inactive' }
    });

    // Thử dùng testToken gọi API yêu cầu đăng nhập
    const revokeCheck = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${testToken}` }
    });

    if (lockedLogin.status === 403 && revokeCheck.status === 403 && revokeCheck.body?.code === 'ACCOUNT_DEACTIVATED') {
      console.log('✅ TEST 9: Tài khoản bị vô hiệu hóa bị từ chối đăng nhập và token đang hoạt động bị thu hồi ngay lập tức (403 ACCOUNT_DEACTIVATED).');
      passed++;
    } else {
      console.log('❌ TEST 9 FAILED:', lockedLogin.status, revokeCheck.status, revokeCheck.body);
    }
  } catch (e) { console.log('❌ TEST 9 ERROR:', e.message); }

  // TEST 10: Các chức năng Login, Home Page, Services và Bookings hiện có vẫn hoạt động
  try {
    const health = await request('/api/health');
    const services = await request('/api/services');
    const customerBookings = await request('/api/bookings/my-bookings', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });

    if (health.status === 200 && services.status === 200 && Array.isArray(services.body?.data) && customerBookings.status === 200) {
      console.log(`✅ TEST 10: Các API cốt lõi (/health, /services [${services.body.data.length} dịch vụ], /bookings/my-bookings) hoạt động trơn tru.`);
      passed++;
    } else {
      console.log('❌ TEST 10 FAILED:', health.status, services.status, customerBookings.status);
    }
  } catch (e) { console.log('❌ TEST 10 ERROR:', e.message); }

  console.log(`\n============================================================`);
  console.log(`🎯 KẾT QUẢ KIỂM THỬ: ${passed}/${total} TESTS PASSED`);
  console.log(`============================================================`);
  if (passed === total) {
    console.log('🎉 TẤT CẢ 10 TRƯỜNG HỢP KIỂM THỬ ĐÃ ĐẠT 100% YÊU CẦU!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Lỗi chạy suite kiểm thử:', err);
  process.exit(1);
});
