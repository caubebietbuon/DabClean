// ============================================================
// DABCLEAN BACKEND - Real-time Socket.IO Notification Service
// Quản lý kết nối WebSocket, phân luồng phòng (User, Staff, Admin)
// và phát thông báo tức thì (Push Notifications & Live Updates)
// ============================================================
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

let io = null;

/**
 * Khởi tạo Socket.IO server gắn vào HTTP server
 * @param {import('http').Server} server 
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Hỗ trợ kết nối từ mọi frontend origin (localhost:5500, LAN, mobile web)
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // Middleware xác thực token khi client kết nối qua socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token 
        || socket.handshake.query?.token 
        || (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

      if (!token) {
        // Cho phép kết nối dưới tư cách khách (guest) để nhận thông báo công khai
        socket.user = null;
        return next();
      }

      const secret = getJwtSecret();
      const decoded = jwt.verify(token, secret);
      socket.user = decoded;
      return next();
    } catch (err) {
      // Nếu token hết hạn hoặc không hợp lệ, vẫn cho kết nối tư cách guest
      socket.user = null;
      return next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;

    if (user && user.id) {
      // 1. Gia nhập phòng riêng của User: user_{id}
      socket.join(`user_${user.id}`);

      // 2. Gia nhập phòng theo Role: role_{role}
      if (user.role) {
        socket.join(`role_${user.role}`);
      }

      console.log(`[Socket.io] 🟢 Người dùng #${user.id} (${user.role}) đã kết nối (Socket ID: ${socket.id})`);
    } else {
      console.log(`[Socket.io] ⚪ Khách chưa đăng nhập đã kết nối (Socket ID: ${socket.id})`);
    }

    // Lắng nghe sự kiện xác thực sau khi kết nối (khi user vừa login trên frontend)
    socket.on('authenticate', (token) => {
      try {
        if (!token) return;
        const secret = getJwtSecret();
        const decoded = jwt.verify(token, secret);
        socket.user = decoded;
        socket.join(`user_${decoded.id}`);
        if (decoded.role) {
          socket.join(`role_${decoded.role}`);
        }
        socket.emit('authenticated', { success: true, user: { id: decoded.id, role: decoded.role } });
        console.log(`[Socket.io] 🔑 Xác thực thành công Socket #${socket.id} cho User #${decoded.id} (${decoded.role})`);
      } catch (err) {
        socket.emit('authenticated', { success: false, message: 'Token xác thực không hợp lệ.' });
      }
    });

    // Lắng nghe sự kiện tham gia theo dõi đơn hàng cụ thể
    socket.on('join_booking', (bookingId) => {
      if (bookingId) {
        socket.join(`booking_${bookingId}`);
      }
    });

    // Rời phòng đơn hàng
    socket.on('leave_booking', (bookingId) => {
      if (bookingId) {
        socket.leave(`booking_${bookingId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      if (user && user.id) {
        console.log(`[Socket.io] 🔴 Người dùng #${user.id} đã ngắt kết nối (${reason})`);
      }
    });
  });

  console.log('[Socket.io] ✅ Socket.IO Real-time Engine đã khởi động thành công!');
  return io;
}

/**
 * Lấy instance của Socket.IO
 */
function getIO() {
  return io;
}

/**
 * Gửi thông báo đến 1 người dùng cụ thể
 * @param {number|string} userId 
 * @param {object} notification 
 */
function notifyUser(userId, notification) {
  if (!io || !userId) return;
  const payload = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: notification.type || 'info',
    title: notification.title || 'Thông báo mới',
    message: notification.message || '',
    data: notification.data || null,
    sound: notification.sound || 'chime',
    created_at: new Date().toISOString()
  };
  io.to(`user_${userId}`).emit('notification', payload);
}

/**
 * Gửi thông báo đến tất cả người dùng thuộc một Role (e.g. 'staff', 'admin', 'customer')
 * @param {string} role 
 * @param {object} notification 
 */
function notifyRole(role, notification) {
  if (!io || !role) return;
  const payload = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: notification.type || 'info',
    title: notification.title || 'Thông báo hệ thống',
    message: notification.message || '',
    data: notification.data || null,
    sound: notification.sound || (role === 'staff' ? 'new_order' : 'chime'),
    created_at: new Date().toISOString()
  };
  io.to(`role_${role}`).emit('notification', payload);
}

/**
 * Gửi thông báo đến tất cả mọi người đang online
 * @param {object} notification 
 */
function notifyAll(notification) {
  if (!io) return;
  const payload = {
    id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: notification.type || 'broadcast',
    title: notification.title || 'Thông báo chung',
    message: notification.message || '',
    data: notification.data || null,
    sound: notification.sound || 'chime',
    created_at: new Date().toISOString()
  };
  io.emit('notification', payload);
}

/**
 * Bắn cập nhật trạng thái đơn hàng theo thời gian thực
 * @param {number|string} bookingId 
 * @param {string} eventName 
 * @param {object} data 
 */
function notifyBooking(bookingId, eventName, data) {
  if (!io || !bookingId) return;
  io.to(`booking_${bookingId}`).emit(eventName, data);
  // Bắn đồng thời sự kiện chung cho toàn hệ thống để các trang cập nhật danh sách
  io.emit('booking_event', { bookingId, eventName, data, timestamp: new Date().toISOString() });
}

module.exports = {
  initSocket,
  getIO,
  notifyUser,
  notifyRole,
  notifyAll,
  notifyBooking
};
