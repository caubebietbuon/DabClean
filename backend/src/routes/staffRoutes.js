// ============================================================
// CLEANOVA BACKEND - Staff Routes (/api/staff)
// ============================================================
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { verifyToken, staffRequired } = require('../middleware/authMiddleware');

// Tất cả các route nhân viên đều yêu cầu đăng nhập và có quyền role = 'staff' (hoặc 'admin')
router.use(verifyToken, staffRequired);

// 1. Quản lý công việc được giao
router.get('/tasks', staffController.getMyTasks);
router.get('/tasks/:id', staffController.getTaskDetail);
router.patch('/tasks/:id/status', staffController.updateTaskStatus);

// 2. Hồ sơ cá nhân nhân viên
router.get('/profile', staffController.getProfile);
router.patch('/profile', staffController.updateProfile);
router.put('/change-password', staffController.changePassword);

module.exports = router;
