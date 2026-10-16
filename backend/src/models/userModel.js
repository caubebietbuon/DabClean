// ============================================================
// CLEANOVA BACKEND - User Model (Thao tác bảng users & audit_logs)
// ============================================================
const db = require('../config/db');

const UserModel = {
  // Tìm người dùng theo email
  async findByEmail(email) {
    const rows = await db.query(
      'SELECT id, name, email, password, phone, address, role, status, lock_reason, created_at FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  },

  // Tìm người dùng theo ID
  async findById(id) {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, role, status, lock_reason, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  // Tạo người dùng mới
  async create({ name, email, password, phone = '', address = '', role = 'customer', status = 'active' }) {
    const result = await db.query(
      'INSERT INTO users (name, email, password, phone, address, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), password, phone, address, role, status]
    );
    return result.insertId;
  },

  // Cập nhật thông tin cá nhân (Profile)
  async updateProfile(id, { name, phone, address }) {
    const result = await db.query(
      'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
      [name.trim(), phone || '', address || '', id]
    );
    return result.affectedRows > 0;
  },

  // Quản trị viên cập nhật tài khoản
  async updateAdminUser(id, { name, phone, address, role, status, lock_reason = null }) {
    const finalReason = status === 'inactive' ? (lock_reason || null) : null;
    const result = await db.query(
      'UPDATE users SET name = ?, phone = ?, address = ?, role = ?, status = ?, lock_reason = ? WHERE id = ?',
      [name.trim(), phone || '', address || '', role, status, finalReason, id]
    );
    return result.affectedRows > 0;
  },

  // Cập nhật mật khẩu
  async updatePassword(id, hashedPassword) {
    const result = await db.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
    return result.affectedRows > 0;
  },

  // Cập nhật trạng thái tài khoản (Hoạt động / Vô hiệu hóa) kèm lý do
  async updateStatus(id, status, lock_reason = null) {
    const finalReason = status === 'inactive' ? (lock_reason || null) : null;
    const result = await db.query(
      'UPDATE users SET status = ?, lock_reason = ? WHERE id = ?',
      [status, finalReason, id]
    );
    return result.affectedRows > 0;
  },

  // Cập nhật vai trò người dùng (customer, staff, admin)
  async updateRole(id, role) {
    const result = await db.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );
    return result.affectedRows > 0;
  },

  // Đếm số lượng Admin đang hoạt động (Để bảo vệ không xóa nhầm admin duy nhất)
  async countActiveAdmins() {
    const rows = await db.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'"
    );
    const countVal = rows[0] ? (rows[0].count !== undefined ? rows[0].count : rows[0].total) : 0;
    return parseInt(countVal, 10) || 0;
  },

  // Kiểm tra người dùng có đơn đặt lịch nào liên kết không
  async hasBookings(userId) {
    const rows = await db.query(
      'SELECT COUNT(*) AS count FROM bookings WHERE user_id = ?',
      [userId]
    );
    const countVal = rows[0] ? (rows[0].count !== undefined ? rows[0].count : rows[0].total) : 0;
    return (parseInt(countVal, 10) || 0) > 0;
  },

  // Xóa tài khoản vĩnh viễn (Chỉ thực hiện khi thỏa mãn mọi điều kiện an toàn)
  async delete(id) {
    const result = await db.query(
      'DELETE FROM users WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  // Lấy toàn bộ danh sách người dùng cho Admin
  async getAll() {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, role, status, lock_reason, created_at FROM users ORDER BY id DESC'
    );
    return rows;
  },

  // Lấy danh sách nhân viên Cleanova (Staff)
  async getStaffList() {
    const rows = await db.query(
      "SELECT id, name, email, phone, address, role, status, lock_reason, created_at FROM users WHERE role = 'staff' ORDER BY id DESC"
    );
    return rows;
  },

  // Ghi nhật ký thao tác quản trị an toàn (Không lưu mật khẩu hoặc token)
  async logAudit(adminId, action, targetId, targetType = 'user', details = '') {
    try {
      await db.query(
        'INSERT INTO audit_logs (admin_id, action, target_id, target_type, details) VALUES (?, ?, ?, ?, ?)',
        [adminId, action, targetId, targetType, details]
      );
    } catch (err) {
      console.warn('[Audit Log Error]', err.message);
    }
  }
};

module.exports = UserModel;
