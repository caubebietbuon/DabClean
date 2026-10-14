// ============================================================
// CLEANOVA BACKEND - Booking Model (Thao tác bảng bookings)
// ============================================================
const db = require('../config/db');

const BookingModel = {
  // Tạo đơn đặt dịch vụ mới
  async create({ booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes, total_price, discount_code, payment_method }) {
    const result = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes, total_price, discount_code, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes || '', total_price, discount_code || null, payment_method || 'cash']
    );
    return result.insertId;
  },

  // Lấy danh sách đơn của một người dùng
  async getByUserId(userId) {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.price_unit
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.user_id = ?
       ORDER BY b.id DESC`,
      [userId]
    );
  },

  // Lấy chi tiết một đơn theo ID
  async getById(id) {
    const rows = await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, u.name AS user_name, u.email AS user_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // Cập nhật trạng thái đơn (User hủy đơn hoặc Admin đổi trạng thái)
  async updateStatus(id, status) {
    const result = await db.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  },

  // Lấy toàn bộ đơn hàng (Dành cho Admin)
  async getAll() {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, u.name AS user_name, u.email AS user_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       ORDER BY b.id DESC`
    );
  },

  // Lấy thống kê tổng quan (Dashboard Admin)
  async getStats() {
    const rows = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'user') AS total_users,
        (SELECT COUNT(*) FROM services WHERE is_active = 1) AS total_services,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
        (SELECT IFNULL(SUM(total_price), 0) FROM bookings WHERE status = 'completed') AS total_revenue`
    );
    const stats = rows[0] || {};
    return {
      total_users: stats.total_users || 0,
      total_services: stats.total_services || 0,
      total_bookings: stats.total_bookings || 0,
      pending_bookings: stats.pending_bookings || 0,
      total_revenue: stats.total_revenue || 0,
      totalUsers: stats.totalUsers || stats.total_users || 0,
      activeServices: stats.activeServices || stats.total_services || 0,
      totalBookings: stats.totalBookings || stats.total_bookings || 0,
      totalRevenue: stats.totalRevenue || stats.total_revenue || 0
    };
  }
};

module.exports = BookingModel;
