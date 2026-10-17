// ============================================================
// DABCLEAN BACKEND - Voucher Model (Quản lý mã giảm giá & Khuyến mãi động)
// ============================================================
const db = require('../config/db');

const VoucherModel = {
  // Lấy danh sách voucher công khai đang hoạt động
  async getActiveVouchers() {
    const now = new Date();
    const rows = await db.query(
      `SELECT id, code, discount_type, discount_value, max_discount_amount, min_order_amount,
              applicable_services, start_date, end_date, usage_limit, used_count, per_user_limit, description
       FROM vouchers
       WHERE is_active = 1 AND start_date <= ? AND end_date >= ? AND used_count < usage_limit
       ORDER BY id DESC`,
      [now, now]
    );
    return rows;
  },

  // Lấy chi tiết voucher theo code
  async getByCode(code) {
    if (!code || typeof code !== 'string') return null;
    const cleanCode = code.trim().toUpperCase();
    const rows = await db.query(
      `SELECT * FROM vouchers WHERE code = ? LIMIT 1`,
      [cleanCode]
    );
    return rows[0] || null;
  },

  // Đếm số lần một user đã sử dụng voucher này
  async getUserUsageCount(voucherId, userId) {
    const rows = await db.query(
      `SELECT COUNT(*) AS count FROM voucher_usages WHERE voucher_id = ? AND user_id = ?`,
      [voucherId, userId]
    );
    return rows[0] ? parseInt(rows[0].count, 10) : 0;
  },

  /**
   * Xác thực và tính toán chiết khấu voucher
   * @param {string} code - Mã voucher
   * @param {number} userId - ID người dùng
   * @param {number} serviceId - ID dịch vụ
   * @param {number} subtotal - Tổng tiền trước giảm giá
   * @param {string} frequency - Tần suất (once, weekly, monthly)
   */
  async validateAndCalculateDiscount({ code, userId, serviceId, subtotal, frequency = 'once' }) {
    if (!code) return { valid: false, discountAmount: 0, reason: 'Chưa nhập mã ưu đãi.' };

    const cleanCode = code.trim().toUpperCase();
    const voucher = await this.getByCode(cleanCode);

    if (!voucher) {
      return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi không tồn tại hoặc đã bị xóa.' };
    }

    if (voucher.is_active !== 1 && voucher.is_active !== true) {
      return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi hiện đang tạm dừng áp dụng.' };
    }

    const now = new Date();
    if (new Date(voucher.start_date) > now) {
      return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi chưa đến thời gian áp dụng.' };
    }
    if (new Date(voucher.end_date) < now) {
      return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi đã hết hạn sử dụng.' };
    }

    if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
      return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi đã hết lượt sử dụng.' };
    }

    const orderSubtotal = parseFloat(subtotal) || 0;
    const minOrder = parseFloat(voucher.min_order_amount) || 0;
    if (orderSubtotal < minOrder) {
      return {
        valid: false,
        discountAmount: 0,
        reason: `Mã ưu đãi chỉ áp dụng cho đơn từ ${Math.round(minOrder).toLocaleString('vi-VN')} đ trở lên.`
      };
    }

    // Quy tắc riêng cho DABCLEAN20 / CLEANOVA20: không áp dụng cho đơn định kỳ
    if ((cleanCode === 'CLEANOVA20' || cleanCode === 'DABCLEAN20') && frequency !== 'once') {
      return {
        valid: false,
        discountAmount: 0,
        reason: `Mã ưu đãi ${cleanCode} chỉ áp dụng cho đơn đặt dịch vụ 1 lần và không áp dụng đồng thời với gói chiết khấu định kỳ.`
      };
    }

    // Kiểm tra giới hạn số lần dùng của từng người dùng
    if (userId) {
      const userUsage = await this.getUserUsageCount(voucher.id, userId);
      const perUserLimit = voucher.per_user_limit || 1;
      if (userUsage >= perUserLimit) {
        return {
          valid: false,
          discountAmount: 0,
          reason: `Bạn đã sử dụng hết số lần quy định cho mã ưu đãi này (tối đa ${perUserLimit} lần).`
        };
      }
    }

    // Kiểm tra phạm vi dịch vụ áp dụng nếu có chỉ định JSON
    if (voucher.applicable_services) {
      let allowedServices = [];
      try {
        allowedServices = typeof voucher.applicable_services === 'string'
          ? JSON.parse(voucher.applicable_services)
          : voucher.applicable_services;
      } catch (e) {
        allowedServices = [];
      }
      if (Array.isArray(allowedServices) && allowedServices.length > 0 && serviceId) {
        if (!allowedServices.includes(parseInt(serviceId, 10))) {
          return { valid: false, discountAmount: 0, reason: 'Mã ưu đãi không áp dụng cho dịch vụ này.' };
        }
      }
    }

    // Tính số tiền giảm
    let discount = 0;
    const discVal = parseFloat(voucher.discount_value);
    if (voucher.discount_type === 'percentage') {
      discount = orderSubtotal * (discVal / 100);
      if (voucher.max_discount_amount) {
        const maxDisc = parseFloat(voucher.max_discount_amount);
        if (discount > maxDisc) discount = maxDisc;
      }
    } else {
      discount = Math.min(discVal, orderSubtotal);
    }

    return {
      valid: true,
      voucher,
      code: cleanCode,
      discountAmount: Math.round(discount),
      reason: null
    };
  },

  // Ghi nhận lượt sử dụng voucher nguyên tử chống race condition (Bug 8)
  async recordUsage(voucherId, userId, bookingId, discountApplied) {
    // 1. Chống ghi nhận trùng cho cùng một đơn (Idempotency)
    if (bookingId) {
      const existing = await db.query(
        'SELECT id FROM voucher_usages WHERE booking_id = ? AND voucher_id = ? LIMIT 1',
        [bookingId, voucherId]
      );
      if (existing && existing.length > 0) {
        return { success: true, isIdempotent: true };
      }
    }

    // 2. Cập nhật nguyên tử used_count có kiểm tra usage_limit chống Race Condition
    const updateResult = await db.query(
      `UPDATE vouchers 
       SET used_count = used_count + 1 
       WHERE id = ? 
         AND is_active = 1
         AND (usage_limit IS NULL OR usage_limit = 0 OR used_count < usage_limit)`,
      [voucherId]
    );

    if (!updateResult || updateResult.affectedRows === 0) {
      const error = new Error('Mã ưu đãi đã hết lượt sử dụng do có khách hàng khác vừa áp dụng thành công.');
      error.statusCode = 400;
      error.code = 'VOUCHER_LIMIT_EXCEEDED';
      throw error;
    }

    // 3. Ghi log lịch sử sử dụng voucher
    await db.query(
      `INSERT INTO voucher_usages (voucher_id, user_id, booking_id, discount_applied) VALUES (?, ?, ?, ?)`,
      [voucherId, userId, bookingId, discountApplied]
    );

    return { success: true, isIdempotent: false };
  },

  // Bù trừ / Hoàn trả lượt sử dụng voucher nếu thanh toán hoặc tạo đơn thất bại (Bug 8 & Bug 10)
  async rollbackUsage(voucherId, bookingId) {
    if (!voucherId || !bookingId) return;
    const deleteResult = await db.query(
      'DELETE FROM voucher_usages WHERE voucher_id = ? AND booking_id = ?',
      [voucherId, bookingId]
    );
    if (deleteResult && deleteResult.affectedRows > 0) {
      await db.query(
        'UPDATE vouchers SET used_count = GREATEST(0, used_count - ?) WHERE id = ?',
        [deleteResult.affectedRows, voucherId]
      );
    }
  },

  // Admin: Lấy danh sách tất cả voucher
  async getAllForAdmin() {
    return await db.query(`SELECT * FROM vouchers ORDER BY id DESC`);
  },

  // Admin: Tạo voucher mới - Bảo vệ các invariant nghiệp vụ (Bug 7)
  async createVoucher(data) {
    const {
      code,
      discount_type = 'percentage',
      discount_value,
      max_discount_amount = null,
      min_order_amount = 0,
      applicable_services = null,
      start_date,
      end_date,
      usage_limit = 100,
      per_user_limit = 1,
      is_active = 1,
      description = ''
    } = data;

    if (!code || typeof code !== 'string' || !code.trim()) {
      const err = new Error('Mã voucher không được để trống.');
      err.statusCode = 400;
      throw err;
    }

    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,50}$/.test(cleanCode)) {
      const err = new Error('Mã voucher chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới (từ 2 đến 50 ký tự).');
      err.statusCode = 400;
      throw err;
    }

    const validTypes = ['percentage', 'fixed'];
    if (!validTypes.includes(discount_type)) {
      const err = new Error('Loại giảm giá không hợp lệ. Chỉ chấp nhận "percentage" hoặc "fixed".');
      err.statusCode = 400;
      throw err;
    }

    const numVal = parseFloat(discount_value);
    if (!Number.isFinite(numVal) || numVal <= 0) {
      const err = new Error('Giá trị giảm giá phải là số dương lớn hơn 0.');
      err.statusCode = 400;
      throw err;
    }

    if (discount_type === 'percentage' && numVal > 100) {
      const err = new Error('Voucher giảm theo phần trăm không được vượt quá 100%.');
      err.statusCode = 400;
      throw err;
    }

    if (discount_type === 'fixed' && numVal > 100000000) {
      const err = new Error('Giá trị giảm cố định không được vượt quá 100.000.000 VNĐ.');
      err.statusCode = 400;
      throw err;
    }

    if (!start_date || isNaN(Date.parse(start_date))) {
      const err = new Error('Ngày bắt đầu không hợp lệ.');
      err.statusCode = 400;
      throw err;
    }

    if (!end_date || isNaN(Date.parse(end_date))) {
      const err = new Error('Ngày kết thúc không hợp lệ.');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(start_date) > new Date(end_date)) {
      const err = new Error('Ngày bắt đầu không được sau ngày kết thúc.');
      err.statusCode = 400;
      throw err;
    }

    const parsedMinOrder = parseFloat(min_order_amount) || 0;
    if (parsedMinOrder < 0) {
      const err = new Error('Giá trị đơn hàng tối thiểu không được âm.');
      err.statusCode = 400;
      throw err;
    }

    const parsedMaxDisc = max_discount_amount ? parseFloat(max_discount_amount) : null;
    if (parsedMaxDisc !== null && (isNaN(parsedMaxDisc) || parsedMaxDisc <= 0)) {
      const err = new Error('Mức giảm tối đa phải là số dương lớn hơn 0.');
      err.statusCode = 400;
      throw err;
    }

    const parsedUsageLimit = usage_limit !== null && usage_limit !== undefined ? parseInt(usage_limit, 10) : 100;
    if (isNaN(parsedUsageLimit) || parsedUsageLimit < 1) {
      const err = new Error('Giới hạn lượt sử dụng phải là số nguyên >= 1.');
      err.statusCode = 400;
      throw err;
    }

    const parsedPerUserLimit = per_user_limit !== null && per_user_limit !== undefined ? parseInt(per_user_limit, 10) : 1;
    if (isNaN(parsedPerUserLimit) || parsedPerUserLimit < 1) {
      const err = new Error('Giới hạn số lần dùng mỗi khách hàng phải là số nguyên >= 1.');
      err.statusCode = 400;
      throw err;
    }

    const result = await db.query(
      `INSERT INTO vouchers 
       (code, discount_type, discount_value, max_discount_amount, min_order_amount, applicable_services, start_date, end_date, usage_limit, per_user_limit, is_active, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanCode,
        discount_type,
        numVal,
        parsedMaxDisc,
        parsedMinOrder,
        applicable_services ? JSON.stringify(applicable_services) : null,
        start_date,
        end_date,
        parsedUsageLimit,
        parsedPerUserLimit,
        is_active ? 1 : 0,
        description
      ]
    );
    return result.insertId;
  }
};

module.exports = VoucherModel;
