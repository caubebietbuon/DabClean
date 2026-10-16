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
  async update(id, {
    name, description, short_description, base_price, price_unit, duration_estimate, icon,
    category, min_duration_hours, staff_wage_rate,
    shift_price, daily_price, monthly_price,
    shift_hours, daily_hours, monthly_days,
    is_shift_active, is_daily_active, is_monthly_active,
    staff_shift_wage, staff_daily_wage, staff_monthly_wage
  }) {
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (short_description !== undefined) { fields.push('short_description = ?'); values.push(short_description); }
    if (base_price !== undefined) { fields.push('base_price = ?'); values.push(base_price); }
    if (price_unit !== undefined) { fields.push('price_unit = ?'); values.push(price_unit); }
    if (duration_estimate !== undefined) { fields.push('duration_estimate = ?'); values.push(duration_estimate); }
    if (icon !== undefined) { fields.push('icon = ?'); values.push(icon); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (min_duration_hours !== undefined) { fields.push('min_duration_hours = ?'); values.push(min_duration_hours); }
    if (staff_wage_rate !== undefined) { fields.push('staff_wage_rate = ?'); values.push(staff_wage_rate); }
    if (shift_price !== undefined) { fields.push('shift_price = ?'); values.push(shift_price); }
    if (daily_price !== undefined) { fields.push('daily_price = ?'); values.push(daily_price); }
    if (monthly_price !== undefined) { fields.push('monthly_price = ?'); values.push(monthly_price); }
    if (shift_hours !== undefined) { fields.push('shift_hours = ?'); values.push(shift_hours); }
    if (daily_hours !== undefined) { fields.push('daily_hours = ?'); values.push(daily_hours); }
    if (monthly_days !== undefined) { fields.push('monthly_days = ?'); values.push(monthly_days); }
    if (is_shift_active !== undefined) { fields.push('is_shift_active = ?'); values.push(is_shift_active); }
    if (is_daily_active !== undefined) { fields.push('is_daily_active = ?'); values.push(is_daily_active); }
    if (is_monthly_active !== undefined) { fields.push('is_monthly_active = ?'); values.push(is_monthly_active); }
    if (staff_shift_wage !== undefined) { fields.push('staff_shift_wage = ?'); values.push(staff_shift_wage); }
    if (staff_daily_wage !== undefined) { fields.push('staff_daily_wage = ?'); values.push(staff_daily_wage); }
    if (staff_monthly_wage !== undefined) { fields.push('staff_monthly_wage = ?'); values.push(staff_monthly_wage); }

    if (fields.length === 0) return true;

    values.push(id);
    const result = await db.query(
      `UPDATE services SET ${fields.join(', ')} WHERE id = ?`,
      values
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
