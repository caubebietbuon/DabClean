// ============================================================
// CLEANOVA BACKEND - Voucher Routes (/api/vouchers)
// ============================================================
const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// 1. Công khai: Lấy danh sách voucher đang hoạt động
router.get('/active', voucherController.getActiveVouchers);

// 2. Kiểm tra tính hợp lệ của voucher (cho phép kiểm tra kể cả khi chưa đăng nhập hoặc đã đăng nhập)
router.post('/check', (req, res, next) => {
  // Thử parse token nếu có header Authorization để kiểm tra per_user_limit
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyToken(req, res, next);
  }
  next();
}, voucherController.checkVoucher);

// 3. Admin: Lấy danh sách tất cả voucher
router.get('/admin/all', verifyToken, requireRole(['admin']), voucherController.getAllForAdmin);

// 4. Admin: Tạo voucher mới
router.post('/admin/create', verifyToken, requireRole(['admin']), voucherController.createVoucher);

module.exports = router;
