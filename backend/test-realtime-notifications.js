// ============================================================
// DABCLEAN - Test Suite: Real-time Notification Engine (Socket.IO)
// Kiểm tra kết nối, xác thực phòng, phát thông báo & sự kiện đơn hàng
// ============================================================
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: Client } = require('socket.io-client');
const app = require('./src/app');
const { initSocket, notifyUser, notifyRole, notifyBooking } = require('./src/services/socketService');
const { getJwtSecret } = require('./src/config/jwt');

async function runTests() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ: HỆ THỐNG THÔNG BÁO REAL-TIME (SOCKET.IO)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Tạo server tạm trên port ngẫu nhiên
  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;
  console.log(`[Test Server] Đã khởi động tại ${serverUrl}\n`);

  const secret = getJwtSecret();

  // Tạo mock JWT token cho 3 đối tượng
  const customerToken = jwt.sign({ id: 101, email: 'customer@dabclean.vn', role: 'customer' }, secret);
  const staffToken = jwt.sign({ id: 202, email: 'staff@dabclean.vn', role: 'staff' }, secret);
  const adminToken = jwt.sign({ id: 303, email: 'admin@dabclean.vn', role: 'admin' }, secret);

  // 2. Khởi tạo 3 client kết nối
  const customerSocket = Client(serverUrl, { auth: { token: customerToken }, transports: ['websocket'] });
  const staffSocket = Client(serverUrl, { auth: { token: staffToken }, transports: ['websocket'] });
  const adminSocket = Client(serverUrl, { auth: { token: adminToken }, transports: ['websocket'] });

  try {
    // Đợi cả 3 socket kết nối thành công
    await Promise.all([
      new Promise((res) => customerSocket.on('connect', res)),
      new Promise((res) => staffSocket.on('connect', res)),
      new Promise((res) => adminSocket.on('connect', res))
    ]);

    assert(customerSocket.connected, 'Khách hàng (Customer #101) kết nối Socket.IO thành công');
    assert(staffSocket.connected, 'Nhân viên (Staff #202) kết nối Socket.IO thành công');
    assert(adminSocket.connected, 'Quản trị viên (Admin #303) kết nối Socket.IO thành công');

    // Test 1: Bắn thông báo đến Staff khi có đơn hàng mới (notifyRole 'staff')
    console.log('\n--- Test 1: Bắn thông báo đơn mới đến Nhân viên ---');
    const staffNotifPromise = new Promise((resolve) => {
      staffSocket.once('notification', (payload) => resolve(payload));
    });

    notifyRole('staff', {
      type: 'new_booking',
      title: '🔔 Có đơn dịch vụ mới trên sàn!',
      message: 'Dọn dẹp nhà tại 123 Cầu Giấy, Hà Nội',
      sound: 'new_order',
      data: { bookingId: 999, totalPrice: 350000 }
    });

    const staffReceived = await staffNotifPromise;
    assert(staffReceived.type === 'new_booking', 'Staff nhận được sự kiện type = new_booking');
    assert(staffReceived.sound === 'new_order', 'Staff nhận được âm thanh chuông new_order');
    assert(staffReceived.data.bookingId === 999, 'Payload bookingId chính xác');

    // Test 2: Bắn thông báo đích danh tới Khách hàng (notifyUser 101)
    console.log('\n--- Test 2: Bắn thông báo đích danh tới Khách hàng ---');
    const customerNotifPromise = new Promise((resolve) => {
      customerSocket.once('notification', (payload) => resolve(payload));
    });

    notifyUser(101, {
      type: 'staff_accepted',
      title: '👨‍🔧 Thợ đã nhận đơn của bạn',
      message: 'Nguyễn Văn Thợ đang trên đường đến',
      sound: 'chime',
      data: { bookingId: 999, staffName: 'Nguyễn Văn Thợ' }
    });

    const customerReceived = await customerNotifPromise;
    assert(customerReceived.type === 'staff_accepted', 'Khách hàng nhận đúng thông báo thợ đã nhận đơn');
    assert(customerReceived.data.staffName === 'Nguyễn Văn Thợ', 'Khách hàng nhận đúng thông tin thợ');

    // Test 3: Bắn thông báo đến Admin khi có đơn hàng hoặc nạp ví
    console.log('\n--- Test 3: Bắn thông báo đến Quản trị viên ---');
    const adminNotifPromise = new Promise((resolve) => {
      adminSocket.once('notification', (payload) => resolve(payload));
    });

    notifyRole('admin', {
      type: 'withdrawal_request',
      title: '💸 Yêu cầu rút tiền mới',
      message: 'Nhân viên yêu cầu rút 500.000 đ',
      data: { amount: 500000 }
    });

    const adminReceived = await adminNotifPromise;
    assert(adminReceived.type === 'withdrawal_request', 'Admin nhận đúng loại thông báo withdrawal_request');
    assert(adminReceived.data.amount === 500000, 'Admin nhận đúng số tiền rút');

    // Test 4: Khách hàng theo dõi phòng đơn hàng (join_booking & booking_status_updated)
    console.log('\n--- Test 4: Theo dõi thời gian thực theo phòng đơn hàng ---');
    customerSocket.emit('join_booking', 999);
    await new Promise((r) => setTimeout(r, 100)); // Đợi join room hoàn tất

    const bookingStatusPromise = new Promise((resolve) => {
      customerSocket.once('booking_status_updated', (data) => resolve(data));
    });

    notifyBooking(999, 'booking_status_updated', {
      bookingId: 999,
      status: 'in_progress',
      message: 'Thợ đã check-in và bắt đầu dọn dẹp'
    });

    const bookingStatusReceived = await bookingStatusPromise;
    assert(bookingStatusReceived.status === 'in_progress', 'Khách hàng nhận được cập nhật trạng thái đơn: in_progress');
    assert(bookingStatusReceived.bookingId === 999, 'Đúng mã đơn hàng trong phòng');

  } finally {
    customerSocket.disconnect();
    staffSocket.disconnect();
    adminSocket.disconnect();
    server.close();
  }

  console.log('\n====================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ REAL-TIME: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử:', err);
  process.exit(1);
});
