// ============================================================
// CLEANOVA BACKEND - Booking Routes (/api/bookings)
// ============================================================
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { verifyToken } = require('../middleware/authMiddleware');

// Lấy danh sách đánh giá công khai (không bắt buộc token)
router.get('/reviews/all', bookingController.getAllReviews);

// Tất cả các route đặt lịch bên dưới đều yêu cầu đăng nhập
router.use(verifyToken);

// Tạo đơn đặt lịch dịch vụ mới
router.post('/', bookingController.createBooking);

// Lấy danh sách đơn của người dùng hiện tại (hỗ trợ cả /my và /my-bookings)
router.get('/my-bookings', bookingController.getMyBookings);
router.get('/my', bookingController.getMyBookings);
router.get('/notifications', bookingController.getMyNotifications);
router.patch('/notifications/:notificationId/read', bookingController.markNotificationRead);

// Xem chi tiết một đơn
router.get('/:id', bookingController.getBookingDetail);

// Hủy đơn đặt lịch
router.put('/:id/cancel', bookingController.cancelBooking);

// Khách hàng đổi lịch thực hiện dịch vụ
router.put('/:id/reschedule', bookingController.rescheduleBooking);

// Gửi đánh giá cho đơn hoàn thành
router.post('/:id/review', bookingController.createReview);
router.post('/:id/tip', bookingController.addTip);

// Xem đánh giá của một đơn
router.get('/:id/review', bookingController.getBookingReview);

module.exports = router;
