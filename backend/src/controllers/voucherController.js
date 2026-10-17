// ============================================================
// DABCLEAN BACKEND - Voucher Controller (Quản lý Voucher & Khuyến mãi)
// ============================================================
const VoucherModel = require('../models/voucherModel');
const { sanitizeInput } = require('../utils/sanitize');

const voucherController = {
  // 1. Lấy danh sách voucher công khai đang hoạt động (GET /api/vouchers/active)
  async getActiveVouchers(req, res, next) {
    try {
      const vouchers = await VoucherModel.getActiveVouchers();
      res.json({
        success: true,
        data: vouchers
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Kiểm tra tính hợp lệ của mã voucher (POST /api/vouchers/check)
  async checkVoucher(req, res, next) {
    try {
      const { code, service_id, subtotal, frequency = 'once' } = req.body;
      const userId = req.user ? req.user.id : null;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mã ưu đãi cần kiểm tra.'
        });
      }

      const result = await VoucherModel.validateAndCalculateDiscount({
        code,
        userId,
        serviceId: service_id ? parseInt(service_id, 10) : null,
        subtotal: parseFloat(subtotal) || 0,
        frequency
      });

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.reason
        });
      }

      res.json({
        success: true,
        message: 'Mã ưu đãi hợp lệ!',
        data: {
          code: result.code,
          discount_amount: result.discountAmount,
          description: result.voucher.description,
          discount_type: result.voucher.discount_type,
          discount_value: result.voucher.discount_value
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Admin: Lấy danh sách toàn bộ voucher (GET /api/vouchers/admin/all)
  async getAllForAdmin(req, res, next) {
    try {
      const vouchers = await VoucherModel.getAllForAdmin();
      res.json({
        success: true,
        data: vouchers
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Admin: Tạo mới voucher (POST /api/vouchers/admin/create)
  async createVoucher(req, res, next) {
    try {
      const {
        code,
        discount_type,
        discount_value,
        max_discount_amount,
        min_order_amount,
        applicable_services,
        start_date,
        end_date,
        usage_limit,
        per_user_limit,
        description
      } = req.body;

      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ success: false, message: 'Mã voucher không được để trống.' });
      }

      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,50}$/.test(cleanCode)) {
        return res.status(400).json({ success: false, message: 'Mã voucher chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới (từ 2 đến 50 ký tự).' });
      }

      const validTypes = ['percentage', 'fixed'];
      const effectiveType = discount_type || 'percentage';
      if (!validTypes.includes(effectiveType)) {
        return res.status(400).json({ success: false, message: 'Loại giảm giá không hợp lệ. Chỉ chấp nhận "percentage" hoặc "fixed".' });
      }

      const numVal = parseFloat(discount_value);
      if (!Number.isFinite(numVal) || numVal <= 0) {
        return res.status(400).json({ success: false, message: 'Giá trị giảm giá phải là số dương lớn hơn 0.' });
      }

      if (effectiveType === 'percentage' && numVal > 100) {
        return res.status(400).json({ success: false, message: 'Voucher giảm theo phần trăm không được vượt quá 100%.' });
      }

      if (effectiveType === 'fixed' && numVal > 100000000) {
        return res.status(400).json({ success: false, message: 'Giá trị giảm cố định không được vượt quá 100.000.000 VNĐ.' });
      }

      if (!start_date || isNaN(Date.parse(start_date))) {
        return res.status(400).json({ success: false, message: 'Ngày bắt đầu không hợp lệ.' });
      }

      if (!end_date || isNaN(Date.parse(end_date))) {
        return res.status(400).json({ success: false, message: 'Ngày kết thúc không hợp lệ.' });
      }

      if (new Date(start_date) > new Date(end_date)) {
        return res.status(400).json({ success: false, message: 'Ngày bắt đầu không được sau ngày kết thúc.' });
      }

      if (min_order_amount !== undefined && min_order_amount !== null && min_order_amount !== '') {
        const minOrder = parseFloat(min_order_amount);
        if (!Number.isFinite(minOrder) || minOrder < 0) {
          return res.status(400).json({ success: false, message: 'Giá trị đơn hàng tối thiểu không được âm.' });
        }
      }

      if (max_discount_amount !== undefined && max_discount_amount !== null && max_discount_amount !== '') {
        const maxDisc = parseFloat(max_discount_amount);
        if (!Number.isFinite(maxDisc) || maxDisc <= 0) {
          return res.status(400).json({ success: false, message: 'Mức giảm tối đa phải là số dương lớn hơn 0.' });
        }
      }

      if (usage_limit !== undefined && usage_limit !== null && usage_limit !== '') {
        const uLimit = parseInt(usage_limit, 10);
        if (!Number.isInteger(uLimit) || uLimit < 1) {
          return res.status(400).json({ success: false, message: 'Giới hạn lượt sử dụng phải là số nguyên lớn hơn hoặc bằng 1.' });
        }
      }

      if (per_user_limit !== undefined && per_user_limit !== null && per_user_limit !== '') {
        const pLimit = parseInt(per_user_limit, 10);
        if (!Number.isInteger(pLimit) || pLimit < 1) {
          return res.status(400).json({ success: false, message: 'Giới hạn số lần dùng mỗi khách hàng phải là số nguyên lớn hơn hoặc bằng 1.' });
        }
      }

      const id = await VoucherModel.createVoucher({
        code: cleanCode,
        discount_type: effectiveType,
        discount_value: numVal,
        max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
        min_order_amount: min_order_amount ? parseFloat(min_order_amount) : 0,
        applicable_services: applicable_services || null,
        start_date,
        end_date,
        usage_limit: usage_limit ? parseInt(usage_limit, 10) : 100,
        per_user_limit: per_user_limit ? parseInt(per_user_limit, 10) : 1,
        description: description ? sanitizeInput(description) : ''
      });

      res.status(201).json({
        success: true,
        message: 'Tạo mã voucher mới thành công!',
        data: { id }
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: 'Mã voucher này đã tồn tại trong hệ thống.'
        });
      }
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          success: false,
          message: err.message
        });
      }
      next(err);
    }
  }
};

module.exports = voucherController;
