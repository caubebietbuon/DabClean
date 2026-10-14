// ============================================================
// CLEANOVA BACKEND - Admin Routes (/api/admin)
// ============================================================
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, adminRequired } = require('../middleware/authMiddleware');

// Tất cả các route admin đều yêu cầu đăng nhập và có quyền role = 'admin'
router.use(verifyToken, adminRequired);

// Thống kê Dashboard
router.get('/stats', adminController.getStats);

// Quản lý đơn đặt lịch
router.get('/bookings', adminController.getAllBookings);
router.put('/bookings/:id/status', adminController.updateBookingStatus);

const serviceController = require('../controllers/serviceController');

// Quản lý dịch vụ
router.get('/services', serviceController.getAllServices);
router.post('/services', adminController.createService);
router.put('/services/:id', adminController.updateService);
router.delete('/services/:id', adminController.deleteService);

// Quản lý người dùng
router.get('/users', adminController.getAllUsers);

module.exports = router;
