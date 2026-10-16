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

  async createBookingNotification({ user_id, booking_id, notification_type, title, message, data }) {
    return await db.query(
      `INSERT IGNORE INTO booking_notifications
       (user_id, booking_id, notification_type, title, message, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, booking_id, notification_type, title, message, JSON.stringify(data)]
    );
  },

  async getNotificationsByUserId(userId) {
    return await db.query(
      `SELECT id, booking_id, notification_type, title, message, data, is_read, created_at
       FROM booking_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
  },

  async markNotificationRead(notificationId, userId) {
    const result = await db.query(
      'UPDATE booking_notifications SET is_read = 1 WHERE user_id = ? AND id = ?',
      [userId, notificationId]
    );
    if (result.affectedRows > 0) return true;
    const rows = await db.query(
      'SELECT id FROM booking_notifications WHERE user_id = ? AND id = ? LIMIT 1',
      [userId, notificationId]
    );
    return rows.length > 0;
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
      `UPDATE bookings
       SET staff_id = ?, assigned_at = NOW(), status = ?
       WHERE id = ?`,
      [staffId, staffId ? 'assigned' : 'pending', bookingId]
    );
    return result.affectedRows > 0;
  },

  // Kiểm tra xem người dùng đã từng áp dụng mã ưu đãi này chưa (không tính đơn đã hủy)
  async hasUsedPromoCode(userId, promoCode) {
    const rows = await db.query(
      `SELECT id FROM bookings WHERE user_id = ? AND UPPER(discount_code) = ? AND status != 'cancelled' LIMIT 1`,
      [userId, promoCode.toUpperCase()]
    );
    return rows.length > 0;
  },

  // Nhân viên cập nhật trạng thái công việc được giao (Kèm điều kiện status hiện tại để chống race condition)
  async updateStaffTaskStatus(bookingId, staffId, status, staff_notes = '', cancel_reason = '', expectedCurrentStatus = null) {
    let sql = `UPDATE bookings
       SET status = ?, staff_notes = ?, cancel_reason = ?,
           arrived_at = IF(? = 'arrived', COALESCE(arrived_at, NOW()), arrived_at)
       WHERE id = ? AND staff_id = ?`;
    const params = [status, staff_notes, cancel_reason || null, status, bookingId, staffId];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async markCashPaymentReceived(bookingId, staffId) {
    const result = await db.query(
      `UPDATE bookings SET payment_status = 'paid', paid_at = NOW()
       WHERE id = ? AND staff_id = ? AND status = 'in_progress'
         AND payment_method = 'cash' AND payment_status = 'unpaid'`,
      [bookingId, staffId]
    );
    return result.affectedRows > 0;
  },

  async getJobPhotos(bookingId) {
    return await db.query(
      'SELECT * FROM booking_job_photos WHERE booking_id = ? ORDER BY created_at ASC, id ASC',
      [bookingId]
    );
  },

  async getJobPhotoByUrl(imageUrl) {
    const rows = await db.query(
      'SELECT * FROM booking_job_photos WHERE image_url = ? LIMIT 1',
      [imageUrl]
    );
    return rows[0] || null;
  },

  async addJobPhoto({ booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude }) {
    return await db.query(
      `INSERT INTO booking_job_photos
       (booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude]
    );
  },

  // Cập nhật trạng thái đơn (User hủy đơn hoặc Admin đổi trạng thái, kèm điều kiện chống race condition)
  async updateStatus(id, status, cancel_reason = '', expectedCurrentStatus = null) {
    let sql = 'UPDATE bookings SET status = ?, cancel_reason = ? WHERE id = ?';
    const params = [status, cancel_reason || null, id];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async addTip({ booking_id, user_id, amount }) {
    const result = await db.query(
      `UPDATE bookings SET tip_amount = ?, tip_created_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'completed' AND tip_amount = 0`,
      [amount, booking_id, user_id]
    );
    return result.affectedRows > 0;
  },

  // Khách hàng yêu cầu đổi lịch đơn đặt dịch vụ (Chỉ cho phép khi ở trạng thái pending, assigned, confirmed)
  async reschedule(id, { booking_date, booking_time, notes }, expectedCurrentStatus = null) {
    let sql = `UPDATE bookings SET booking_date = ?, booking_time = ?, notes = ? WHERE id = ? AND status IN ('pending', 'assigned', 'confirmed')`;
    const params = [booking_date, booking_time, notes || '', id];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  // Tạo đánh giá chất lượng dịch vụ cho đơn đã hoàn thành
  async createReview({ booking_id, user_id, service_id, rating, staff_rating, comment }) {
    const result = await db.query(
      'INSERT INTO reviews (booking_id, user_id, service_id, rating, staff_rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [booking_id, user_id, service_id, rating, staff_rating, comment || '']
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
