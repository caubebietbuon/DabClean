// ============================================================
// CLEANOVA BACKEND - Booking Model (Thao tác bảng bookings & Staff tasks)
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

  // Lấy danh sách đơn của một khách hàng
  async getByUserId(userId) {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.price_unit,
              st.name AS staff_name, st.phone AS staff_phone
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users st ON b.staff_id = st.id
       WHERE b.user_id = ?
       ORDER BY b.id DESC`,
      [userId]
    );
  },

  // Lấy danh sách công việc được phân công cho một nhân viên (Staff Portal)
  async getByStaffId(staffId) {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.duration_estimate,
              u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.staff_id = ?
       ORDER BY b.booking_date ASC, b.booking_time ASC`,
      [staffId]
    );
  },

  // Lấy chi tiết một đơn theo ID
  async getById(id) {
    const rows = await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.duration_estimate,
              u.name AS customer_name, u.email AS customer_email, u.name AS user_name, u.email AS user_email,
              st.name AS staff_name, st.phone AS staff_phone, st.email AS staff_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users st ON b.staff_id = st.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // Phân công nhân viên thực hiện đơn đặt lịch (Admin)
  async assignStaff(bookingId, staffId) {
    const result = await db.query(
      'UPDATE bookings SET staff_id = ?, assigned_at = NOW() WHERE id = ?',
      [staffId, bookingId]
    );
    return result.affectedRows > 0;
  },

  // Nhân viên cập nhật trạng thái công việc được giao
  async updateStaffTaskStatus(bookingId, staffId, status, staff_notes = '') {
    const result = await db.query(
      'UPDATE bookings SET status = ?, staff_notes = ? WHERE id = ? AND staff_id = ?',
      [status, staff_notes, bookingId, staffId]
    );
    return result.affectedRows > 0;
  },

  // Cập nhật trạng thái đơn (User hủy đơn hoặc Admin đổi trạng thái)
  async updateStatus(id, status) {
    const result = await db.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, id]
    );
    return result.affectedRows > 0;
  },

  // Khách hàng yêu cầu đổi lịch đơn đặt dịch vụ
  async reschedule(id, { booking_date, booking_time, notes }) {
    const result = await db.query(
      'UPDATE bookings SET booking_date = ?, booking_time = ?, notes = ? WHERE id = ?',
      [booking_date, booking_time, notes || '', id]
    );
    return result.affectedRows > 0;
  },

  // Tạo đánh giá chất lượng dịch vụ cho đơn đã hoàn thành
  async createReview({ booking_id, user_id, service_id, rating, comment }) {
    const result = await db.query(
      'INSERT INTO reviews (booking_id, user_id, service_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [booking_id, user_id, service_id, rating, comment || '']
    );
    return result.insertId;
  },

  // Lấy đánh giá của một đơn
  async getReviewByBookingId(bookingId) {
    const rows = await db.query(
      'SELECT r.*, u.name AS user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.booking_id = ? LIMIT 1',
      [bookingId]
    );
    return rows[0] || null;
  },

  // Lấy danh sách đánh giá mới nhất
  async getAllReviews(limit = 10) {
    return await db.query(
      `SELECT r.*, u.name AS user_name, s.name AS service_name, s.icon AS service_icon
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN services s ON r.service_id = s.id
       ORDER BY r.id DESC LIMIT ?`,
      [limit]
    );
  },

  // Lấy toàn bộ đơn hàng (Dành cho Admin)
  async getAll() {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon,
              u.name AS customer_name, u.email AS customer_email, u.name AS user_name, u.email AS user_email,
              st.name AS staff_name, st.phone AS staff_phone
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users st ON b.staff_id = st.id
       ORDER BY b.id DESC`
    );
  },

  // Lấy thống kê tổng quan (Dashboard Admin)
  async getStats() {
    const rows = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'customer' OR role = 'user') AS total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'staff') AS total_staff,
        (SELECT COUNT(*) FROM services WHERE is_active = 1) AS total_services,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pending_bookings,
        (SELECT IFNULL(SUM(total_price), 0) FROM bookings WHERE status = 'completed') AS total_revenue`
    );
    const stats = rows[0] || {};
    return {
      total_users: stats.total_users || 0,
      total_staff: stats.total_staff || 0,
      total_services: stats.total_services || 0,
      total_bookings: stats.total_bookings || 0,
      pending_bookings: stats.pending_bookings || 0,
      total_revenue: stats.total_revenue || 0,
      totalUsers: stats.totalUsers || stats.total_users || 0,
      totalStaff: stats.totalStaff || stats.total_staff || 0,
      activeServices: stats.activeServices || stats.total_services || 0,
      totalBookings: stats.totalBookings || stats.total_bookings || 0,
      totalRevenue: stats.totalRevenue || stats.total_revenue || 0
    };
  }
};

module.exports = BookingModel;
