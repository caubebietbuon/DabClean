// ============================================================
// CLEANOVA BACKEND - Booking Routes (/api/bookings)
// ============================================================
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verifyToken } = require('../middleware/authMiddleware');

// Tất cả các route đặt lịch đều yêu cầu đăng nhập
router.use(verifyToken);

// Tạo đơn đặt lịch dịch vụ mới
router.post('/', bookingController.createBooking);

// Lấy danh sách đơn của người dùng hiện tại (hỗ trợ cả /my và /my-bookings)
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/my', bookingController.getMyBookings);

// Xem chi tiết một đơn
router.get('/:id', bookingController.getBookingDetail);

// Hủy đơn đặt lịch
router.put('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
