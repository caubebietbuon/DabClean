// ============================================================
// CLEANOVA BACKEND - User Model (Thao tác bảng users)
// ============================================================
const db = require('../config/db');

const UserModel = {
  // Tìm người dùng theo email
  async findByEmail(email) {
    const rows = await db.query(
      'SELECT id, name, email, password, phone, address, role, created_at FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  },

  // Tìm người dùng theo ID
  async findById(id) {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  // Tạo người dùng mới
  async create({ name, email, password, phone = '', address = '', role = 'user' }) {
    const result = await db.query(
      'INSERT INTO users (name, email, password, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), password, phone, address, role]
    );
    return result.insertId;
  },

  // Cập nhật thông tin cá nhân
  async updateProfile(id, { name, phone, address }) {
    const result = await db.query(
      'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
      [name.trim(), phone || '', address || '', id]
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

  // Lấy toàn bộ danh sách người dùng (Admin)
  async getAll() {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, role, created_at FROM users ORDER BY id DESC'
    );
    return rows;
  }
};

module.exports = UserModel;
