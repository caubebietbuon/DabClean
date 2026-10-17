// ============================================================
// DABCLEAN BACKEND - Auth Routes (/api/auth)
// ============================================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Đăng ký tài khoản mới
router.post('/register', authController.register);

// Đăng nhập
router.post('/login', authController.login);

// Lấy thông tin tài khoản hiện tại (hỗ trợ cả /me và /profile)
router.get('/me', verifyToken, authController.getMe);
router.get('/profile', verifyToken, authController.getMe);

// Cập nhật hồ sơ cá nhân
router.put('/profile', verifyToken, authController.updateProfile);

// Đổi mật khẩu
router.put('/change-password', verifyToken, authController.changePassword);

module.exports = router;
