// ============================================================
// DABCLEAN BACKEND - Partner Model (Hồ sơ đăng ký đối tác & nhân viên)
// ============================================================
const db = require('../config/db');

const PartnerModel = {
  // Tìm hồ sơ theo Email
  async findByEmail(email) {
    const rows = await db.query(
      'SELECT id, name, email, phone, password, address, work_area, experience, available_hours, bio, status, rejection_reason, reviewed_by, reviewed_at, user_id, created_at FROM partner_applications WHERE email = ? LIMIT 1',
      [(email || '').trim().toLowerCase()]
    );
    return rows[0] || null;
  },

  // Tìm hồ sơ theo Số điện thoại
  async findByPhone(phone) {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, work_area, experience, available_hours, bio, status, created_at FROM partner_applications WHERE phone = ? LIMIT 1',
      [(phone || '').trim()]
    );
    return rows[0] || null;
  },

  // Tìm hồ sơ theo ID (Không chọn trường password)
  async findById(id) {
    const rows = await db.query(
      'SELECT id, name, email, phone, address, work_area, experience, available_hours, bio, status, rejection_reason, reviewed_by, reviewed_at, user_id, created_at FROM partner_applications WHERE id = ? LIMIT 1',
      [parseInt(id, 10)]
    );
    return rows[0] || null;
  },

  // Tìm hồ sơ theo ID kèm mật khẩu (Dùng riêng cho luồng phê duyệt cấp quyền)
  async findByIdWithPassword(id) {
    const rows = await db.query(
      'SELECT id, name, email, phone, password, address, work_area, experience, available_hours, bio, status, rejection_reason, reviewed_by, reviewed_at, user_id, created_at FROM partner_applications WHERE id = ? LIMIT 1',
      [parseInt(id, 10)]
    );
    return rows[0] || null;
  },

  // Tạo hồ sơ đối tác mới (Mặc định status: pending)
  async create({ name, email, phone, password, address, work_area, experience, available_hours, bio, status = 'pending' }) {
    const result = await db.query(
      'INSERT INTO partner_applications (name, email, phone, password, address, work_area, experience, available_hours, bio, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        (name || '').trim(),
        (email || '').trim().toLowerCase(),
        (phone || '').trim(),
        password,
        (address || '').trim(),
        (work_area || '').trim(),
        experience || '',
        available_hours || '',
        bio || '',
        status
      ]
    );
    return result.insertId;
  },

  // Lấy toàn bộ danh sách hồ sơ cho Admin (Có lọc theo status nếu có)
  async getAll(status = '') {
    if (status && status !== 'all') {
      const rows = await db.query(
        'SELECT id, name, email, phone, address, work_area, experience, available_hours, bio, status, rejection_reason, reviewed_by, reviewed_at, user_id, created_at FROM partner_applications WHERE status = ? ORDER BY id DESC',
        [status]
      );
      return rows;
    }
    const rows = await db.query(
      'SELECT id, name, email, phone, address, work_area, experience, available_hours, bio, status, rejection_reason, reviewed_by, reviewed_at, user_id, created_at FROM partner_applications ORDER BY id DESC'
    );
    return rows;
  },

  // Phê duyệt hồ sơ đối tác và gắn với tài khoản Staff được tạo
  async approve(id, { user_id, reviewed_by }) {
    const result = await db.query(
      'UPDATE partner_applications SET status = ?, user_id = ?, reviewed_by = ? WHERE id = ?',
      ['approved', user_id, reviewed_by, parseInt(id, 10)]
    );
    return result.affectedRows > 0;
  },

  // Từ chối hồ sơ đối tác
  async reject(id, { rejection_reason, reviewed_by }) {
    const result = await db.query(
      'UPDATE partner_applications SET status = ?, rejection_reason = ?, reviewed_by = ? WHERE id = ?',
      ['rejected', rejection_reason || '', reviewed_by, parseInt(id, 10)]
    );
    return result.affectedRows > 0;
  },

  // Đếm số lượng hồ sơ đang chờ xét duyệt
  async countPending() {
    const rows = await db.query(
      "SELECT COUNT(*) AS count FROM partner_applications WHERE status = 'pending'"
    );
    const countVal = rows[0] ? (rows[0].count !== undefined ? rows[0].count : rows[0].total) : 0;
    return parseInt(countVal, 10) || 0;
  }
};

module.exports = PartnerModel;
