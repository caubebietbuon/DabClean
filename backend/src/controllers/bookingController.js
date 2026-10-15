// ============================================================
// CLEANOVA BACKEND - Booking Controller (Xử lý đặt lịch & đơn cá nhân)
// ============================================================
const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');

// Bảng hệ số tính giá theo quy mô diện tích
const areaMultipliers = {
  small: 1.0,    // < 50m2
  medium: 1.5,   // 50 - 100m2
  large: 2.2     // > 100m2
};

// Bảng chiết khấu theo tần suất
const frequencyDiscounts = {
  once: 0.0,     // 1 lần
  weekly: 0.15,  // Giảm 15%
  monthly: 0.10  // Giảm 10%
};

const bookingController = {
  // 1. Tạo đơn đặt dịch vụ mới (POST /api/bookings)
  async createBooking(req, res, next) {
    try {
      const {
        service_id,
        booking_date,
        booking_time,
        area_size = 'medium',
        frequency = 'once',
        address,
        phone,
        notes = '',
        discount_code,
        payment_method = 'cash'
      } = req.body;

      // Xác thực các trường bắt buộc
      if (!service_id) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn dịch vụ muốn đặt.' });
      }
      if (!booking_date || !booking_time) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ thực hiện dịch vụ.' });
      }
      if (!address || !address.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ nhà thực hiện dịch vụ.' });
      }
      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại liên hệ.' });
      }

      // Kiểm tra dịch vụ có tồn tại không
      const service = await ServiceModel.getById(parseInt(service_id, 10));
      if (!service) {
        return res.status(404).json({ success: false, message: 'Dịch vụ được chọn không tồn tại.' });
      }

      // Tính toán giá tiền thực tế
      const basePrice = parseFloat(service.base_price) || 200000;
      const areaMultiplier = areaMultipliers[area_size] || 1.0;
      const freqDiscount = frequencyDiscounts[frequency] || 0.0;

      let subtotal = basePrice * areaMultiplier;
      let discountAmount = subtotal * freqDiscount;

      // Ưu đãi mã CLEANOVA20 (Giảm thêm 20%)
      if (discount_code && discount_code.toUpperCase() === 'CLEANOVA20') {
        discountAmount += subtotal * 0.20;
      }

      const totalPrice = Math.max(subtotal - discountAmount, 50000);

      // Tạo mã đơn ngẫu nhiên chuyên nghiệp: CNV-YYYYMM-XXXX
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const booking_code = `CNV-2026-${randomSuffix}`;

      const bookingId = await BookingModel.create({
        booking_code,
        user_id: req.user.id,
        service_id: service.id,
        booking_date,
        booking_time,
        area_size,
        frequency,
        address,
        phone,
        notes,
        total_price: totalPrice,
        discount_code: discount_code ? discount_code.toUpperCase() : null,
        payment_method
      });

      const newBooking = await BookingModel.getById(bookingId);

      res.status(201).json({
        success: true,
        message: 'Đặt lịch dịch vụ thành công! Đội ngũ Cleanova sẽ liên hệ xác nhận trong ít phút.',
        data: newBooking
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Lấy danh sách đơn của người dùng hiện tại (GET /api/bookings/my-bookings)
  async getMyBookings(req, res, next) {
    try {
      const bookings = await BookingModel.getByUserId(req.user.id);
      res.json({
        success: true,
        count: bookings.length,
        data: bookings
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Xem chi tiết đơn đặt (GET /api/bookings/:id)
  async getBookingDetail(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const booking = await BookingModel.getById(id);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      // Kiểm tra quyền sở hữu đơn (Người đặt hoặc Admin)
      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn đặt này.' });
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Khách hàng hủy đơn (PUT /api/bookings/:id/cancel)
  async cancelBooking(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const booking = await BookingModel.getById(id);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      // Kiểm tra quyền sở hữu
      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn này.' });
      }

      // Chỉ cho phép hủy khi đơn còn ở trạng thái chờ duyệt (pending) hoặc đã nhận (confirmed)
      if (booking.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Đơn dịch vụ đã hoàn thành, không thể hủy.' });
      }
      if (booking.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Đơn này đã được hủy trước đó.' });
      }

      await BookingModel.updateStatus(id, 'cancelled');

      res.json({
        success: true,
        message: 'Hủy đơn đặt lịch thành công.'
      });
    } catch (err) {
      next(err);
    }
  },

  // 5. Khách hàng yêu cầu đổi lịch đơn đặt dịch vụ (PUT /api/bookings/:id/reschedule)
  async rescheduleBooking(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { booking_date, booking_time, notes } = req.body;

      if (!booking_date || !booking_time) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày và giờ mới cần đổi lịch.' });
      }

      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn này.' });
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return res.status(400).json({ success: false, message: 'Đơn đã hoàn thành hoặc đã hủy, không thể đổi lịch.' });
      }

      await BookingModel.reschedule(id, { booking_date, booking_time, notes });
      const updated = await BookingModel.getById(id);

      res.json({
        success: true,
        message: 'Đổi lịch thực hiện dịch vụ thành công! Đội ngũ Cleanova đã ghi nhận lịch hẹn mới.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Gửi đánh giá dịch vụ cho đơn đã hoàn thành (POST /api/bookings/:id/review)
  async createReview(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { rating = 5, comment = '' } = req.body;

      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền đánh giá đơn này.' });
      }

      if (booking.status !== 'completed') {
        return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá dịch vụ sau khi đơn đã hoàn thành.' });
      }

      const existingReview = await BookingModel.getReviewByBookingId(id);
      if (existingReview) {
        return res.status(400).json({ success: false, message: 'Bạn đã gửi đánh giá cho đơn này rồi. Cảm ơn bạn!' });
      }

      const reviewId = await BookingModel.createReview({
        booking_id: id,
        user_id: req.user.id,
        service_id: booking.service_id,
        rating: Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
        comment
      });

      res.status(201).json({
        success: true,
        message: 'Cảm ơn bạn đã gửi đánh giá chất lượng dịch vụ cho Cleanova!',
        data: { id: reviewId, rating, comment }
      });
    } catch (err) {
      next(err);
    }
  },

  // 7. Lấy đánh giá của một đơn (GET /api/bookings/:id/review)
  async getBookingReview(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const review = await BookingModel.getReviewByBookingId(id);
      res.json({
        success: true,
        data: review
      });
    } catch (err) {
      next(err);
    }
  },

  // 8. Lấy toàn bộ đánh giá công khai (GET /api/bookings/reviews/all)
  async getAllReviews(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 10;
      const reviews = await BookingModel.getAllReviews(limit);
      res.json({
        success: true,
        data: reviews
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = bookingController;
