// ============================================================
// CLEANOVA BACKEND - Auth & Role Middleware (Xác thực JWT & Phân quyền)
// ============================================================
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

const authMiddleware = {
  // Xác thực token đăng nhập
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Bạn chưa đăng nhập hoặc phiên đăng nhập không hợp lệ (Missing token).'
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cleanova_super_secret_jwt_key_2026_modern_cleaning');

      // Tải thông tin người dùng từ Database
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
        });
      }

      // Kiểm tra trạng thái tài khoản: Nếu đã bị vô hiệu hóa bởi Admin, thu hồi quyền ngay lập tức
      if (user.status === 'inactive' || user.status === 'deactivated') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Tài khoản của bạn đã bị vô hiệu hóa bởi Quản trị viên. Phiên làm việc đã bị thu hồi.'
        });
      }

      // Gắn thông tin người dùng vào request để các controller sử dụng
      req.user = user;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Mã xác thực không hợp lệ.'
      });
    }
  },

  // Kiểm tra quyền Quản trị viên (Admin)
  adminRequired(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Truy cập bị từ chối: Bạn không có quyền quản trị viên (Admin only).'
      });
    }
    next();
  },

  // Kiểm tra quyền Nhân viên (Staff hoặc Admin)
  staffRequired(req, res, next) {
    if (!req.user || (req.user.role !== 'staff' && req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Truy cập bị từ chối: Khu vực này chỉ dành riêng cho Nhân viên Cleanova.'
      });
    }
    next();
  }
};

module.exports = authMiddleware;
