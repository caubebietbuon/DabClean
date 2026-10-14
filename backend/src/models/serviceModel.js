// ============================================================
// CLEANOVA BACKEND - Service Model (Thao tác bảng services)
// ============================================================
const db = require('../config/db');

const ServiceModel = {
  // Lấy tất cả dịch vụ đang hoạt động
  async getAll(search = '') {
    if (search && search.trim()) {
      const keyword = `%${search.trim().toLowerCase()}%`;
      return await db.query(
        'SELECT * FROM services WHERE is_active = 1 AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?) ORDER BY id ASC',
        [keyword, keyword]
      );
    }
    return await db.query(
      'SELECT * FROM services WHERE is_active = 1 ORDER BY id ASC'
    );
  },

  // Lấy chi tiết dịch vụ theo ID
  async getById(id) {
    const rows = await db.query(
      'SELECT * FROM services WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  // Lấy chi tiết dịch vụ theo Slug
  async getBySlug(slug) {
    const rows = await db.query(
      'SELECT * FROM services WHERE slug = ? LIMIT 1',
      [slug]
    );
    return rows[0] || null;
  },

  // Thêm dịch vụ mới (Admin)
  async create({ name, slug, description, short_description, base_price, price_unit, duration_estimate, icon }) {
    const result = await db.query(
      'INSERT INTO services (name, slug, description, short_description, base_price, price_unit, duration_estimate, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, slug, description, short_description || '', base_price, price_unit || 'lần', duration_estimate || '2-4 giờ', icon || '🧹']
    );
    return result.insertId;
  },

  // Cập nhật dịch vụ (Admin)
  async update(id, { name, description, short_description, base_price, price_unit, duration_estimate, icon }) {
    const result = await db.query(
      'UPDATE services SET name = ?, description = ?, short_description = ?, base_price = ?, price_unit = ?, duration_estimate = ?, icon = ? WHERE id = ?',
      [name, description, short_description, base_price, price_unit, duration_estimate, icon, id]
    );
    return result.affectedRows > 0;
  },

  // Xóa dịch vụ (Admin)
  async delete(id) {
    const result = await db.query('DELETE FROM services WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
};

module.exports = ServiceModel;
