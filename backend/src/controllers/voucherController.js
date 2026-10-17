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

      if (!code || !discount_value || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ các thông tin bắt buộc: code, discount_value, start_date, end_date.'
        });
      }

      const id = await VoucherModel.createVoucher({
        code: sanitizeInput(code),
        discount_type: discount_type === 'fixed' ? 'fixed' : 'percentage',
        discount_value: parseFloat(discount_value),
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
      next(err);
    }
  }
};

module.exports = voucherController;
