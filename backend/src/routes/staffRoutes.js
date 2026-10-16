// ============================================================
// CLEANOVA BACKEND - Staff Routes (/api/staff)
// ============================================================
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { verifyToken, staffRequired } = require('../middleware/authMiddleware');
const { uploadJobPhoto } = require('../middleware/jobPhotoUpload');
const { errorHandler } = require('../middleware/errorHandler');

// Tất cả các route nhân viên đều yêu cầu đăng nhập và có quyền role = 'staff' (hoặc 'admin')
router.use(verifyToken, staffRequired);

// 1. Quản lý công việc được giao
router.get('/photos/:filename', staffController.getTaskPhoto);
router.get('/tasks', staffController.getMyTasks);
router.get('/tasks/:id', staffController.getTaskDetail);
router.get('/tasks/:id/checklist', staffController.getTaskChecklist);
router.post('/tasks/:id/photos', (req, res, next) => {
  uploadJobPhoto(req, res, err => {
    if (err) {
      err.statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.statusCode || 400);
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Ảnh vượt quá giới hạn tải lên 8 MB.';
      return errorHandler(err, req, res, next);
    }
    next();
  });
}, staffController.uploadTaskPhoto);
router.post('/tasks/:id/cash-payment', staffController.confirmCashPayment);
router.patch('/tasks/:id/status', staffController.updateTaskStatus);
router.put('/tasks/:id/status', staffController.updateTaskStatus);

// 2. Hồ sơ cá nhân nhân viên
router.get('/profile', staffController.getProfile);
router.patch('/profile', staffController.updateProfile);
router.put('/profile', staffController.updateProfile);
router.put('/change-password', staffController.changePassword);

module.exports = router;
