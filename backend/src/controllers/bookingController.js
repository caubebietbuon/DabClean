// ============================================================
// CLEANOVA BACKEND - Booking Controller (Xử lý đặt lịch & đơn cá nhân)
// ============================================================
const crypto = require('crypto');
const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const { sanitizeInput } = require('../utils/sanitize');

// Bảng hệ số tính giá theo quy mô diện tích
const areaMultipliers = {
  small: 1.0,    // < 50m2
  medium: 1.5,   // 50 - 100m2
  large: 2.2     // > 100m2
};

// Diện tích m² danh nghĩa cho các gói tính theo m²
const areaM2Mapping = {
  small: 50,     // < 50m² (mặc định lấy 50m²)
  medium: 80,    // 50 - 100m² (mặc định lấy 80m²)
  large: 150     // > 100m² (mặc định lấy 150m²)
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

      // Bảo vệ Bug 6: Xác thực định dạng ngày và chặn ngày quá khứ
      if (typeof booking_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
        return res.status(400).json({ success: false, message: 'Định dạng ngày đặt lịch không hợp lệ (YYYY-MM-DD).' });
      }
      const parsedDate = new Date(`${booking_date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(parsedDate.getTime()) || parsedDate < today) {
        return res.status(400).json({ success: false, message: 'Ngày đặt lịch không được ở trong quá khứ.' });
      }

      // Xác thực định dạng giờ
      if (typeof booking_time !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(booking_time)) {
        return res.status(400).json({ success: false, message: 'Định dạng giờ thực hiện không hợp lệ (HH:mm).' });
      }

      if (!address || typeof address !== 'string' || !address.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ nhà thực hiện dịch vụ.' });
      }
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại liên hệ.' });
      }

      // Bảo vệ Bug 6: Kiểm tra payment_method trước khi ghi vào MySQL ENUM
      const validPaymentMethods = ['cash', 'bank_transfer', 'momo', 'vnpay'];
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({
          success: false,
          message: `Phương thức thanh toán không hợp lệ. Cho phép: ${validPaymentMethods.join(', ')}.`
        });
      }

      // Bảo vệ Bug 6: Kiểm tra quy mô diện tích
      const validAreaSizes = ['small', 'medium', 'large'];
      const isNumericArea = typeof area_size === 'number' && area_size > 0;
      if (!validAreaSizes.includes(area_size) && !isNumericArea) {
        return res.status(400).json({
          success: false,
          message: 'Quy mô diện tích không hợp lệ. Cho phép: small, medium, large hoặc số m² dương.'
        });
      }

      // Bảo vệ Bug 6: Kiểm tra tần suất thực hiện
      const validFrequencies = ['once', 'weekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: 'Tần suất thực hiện không hợp lệ. Cho phép: once, weekly, monthly.'
        });
      }

      // Kiểm tra dịch vụ có tồn tại không
      const service = await ServiceModel.getById(parseInt(service_id, 10));
      if (!service) {
        return res.status(404).json({ success: false, message: 'Dịch vụ được chọn không tồn tại.' });
      }

      // Bảo vệ Bug 5: Tính toán giá tiền thực tế chính xác
      const basePrice = parseFloat(service.base_price) || 200000;
      const isUnitPerM2 = service.price_unit === 'm²' || service.price_unit === 'm2' || service.slug === 've-sinh-sau-xay-dung';

      let subtotal = 0;
      if (isUnitPerM2) {
        // Dịch vụ tính theo m² (VD: Vệ sinh sau xây dựng 8.000đ/m²)
        const m2 = isNumericArea ? area_size : (areaM2Mapping[area_size] || 50);
        subtotal = basePrice * m2;
      } else {
        const areaMultiplier = areaMultipliers[area_size] || 1.0;
        subtotal = basePrice * areaMultiplier;
      }

      const freqDiscount = frequencyDiscounts[frequency] || 0.0;
      let discountAmount = subtotal * freqDiscount;

      // Bảo vệ Bug 5: Xử lý ưu đãi mã CLEANOVA20 (Giảm 20%, giới hạn 1 lần/khách, không cộng dồn 35%)
      const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;
      if (normalizedPromo === 'CLEANOVA20') {
        const alreadyUsed = await BookingModel.hasUsedPromoCode(req.user.id, 'CLEANOVA20');
        if (alreadyUsed) {
          return res.status(400).json({
            success: false,
            message: 'Mã ưu đãi CLEANOVA20 chỉ được áp dụng 1 lần duy nhất cho mỗi tài khoản khách hàng.'
          });
        }
        if (freqDiscount > 0) {
          return res.status(400).json({
            success: false,
            message: 'Mã ưu đãi CLEANOVA20 chỉ áp dụng cho đơn đặt dịch vụ 1 lần và không áp dụng đồng thời với gói chiết khấu định kỳ.'
          });
        }
        discountAmount = subtotal * 0.20;
      } else if (normalizedPromo) {
        return res.status(400).json({
          success: false,
          message: 'Mã ưu đãi không hợp lệ hoặc đã hết hạn.'
        });
      }

      const totalPrice = Math.max(subtotal - discountAmount, 50000);

      // Bảo vệ Bug 8: Sinh mã đơn động theo Năm-Tháng hiện tại + 6 ký tự hex ngẫu nhiên (16.7 triệu mã/tháng)
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      let booking_code = '';
      let bookingId = null;

      // Vòng lặp thử lại nếu trùng mã (chống lỗi 500 va chạm UNIQUE)
      for (let attempt = 0; attempt < 5; attempt++) {
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        booking_code = `CNV-${yearMonth}-${randomHex}`; // Độ dài 17 ký tự, an toàn với VARCHAR(20)
        try {
          bookingId = await BookingModel.create({
            booking_code,
            user_id: req.user.id,
            service_id: service.id,
            booking_date,
            booking_time,
            area_size: String(area_size),
            frequency,
            address: sanitizeInput(address),
            phone: sanitizeInput(phone),
            notes: notes ? sanitizeInput(notes) : '',
            total_price: totalPrice,
            discount_code: normalizedPromo,
            payment_method
          });
          break;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY' && attempt < 4) {
            continue;
          }
          throw err;
        }
      }

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

  async getMyNotifications(req, res, next) {
    try {
      const notifications = await BookingModel.getNotificationsByUserId(req.user.id);
      res.json({ success: true, data: notifications });
    } catch (err) {
      next(err);
    }
  },

  async markNotificationRead(req, res, next) {
    try {
      const notificationId = Number(req.params.notificationId);
      if (!Number.isSafeInteger(notificationId) || notificationId < 1) {
        return res.status(400).json({ success: false, message: 'Mã thông báo không hợp lệ.' });
      }
      const updated = await BookingModel.markNotificationRead(notificationId, req.user.id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo của tài khoản này.' });
      }
      res.json({ success: true, message: 'Đã đánh dấu thông báo đã đọc.' });
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
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
      const booking = await BookingModel.getById(id);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      // Kiểm tra quyền sở hữu
      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn này.' });
      }

      if (!['pending', 'assigned', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn trước khi nhân viên đến và bắt đầu công việc.' });
      }

      if (reason.length < 5 || reason.length > 500) {
        return res.status(400).json({ success: false, message: 'Lý do hủy đơn phải dài từ 5 đến 500 ký tự.' });
      }

      // Bảo vệ Bug 7: Cập nhật nguyên tử có kiểm tra status hiện tại (chống race condition)
      const sanitizedReason = sanitizeInput(reason);
      const cancelled = await BookingModel.updateStatus(id, 'cancelled', sanitizedReason, booking.status);
      if (!cancelled) {
        return res.status(409).json({ success: false, message: 'Trạng thái đơn hàng vừa bị thay đổi. Vui lòng tải lại trang.' });
      }

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

      // Bảo vệ Bug 6: Xác thực ngày hẹn mới không ở quá khứ
      if (typeof booking_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
        return res.status(400).json({ success: false, message: 'Định dạng ngày mới không hợp lệ (YYYY-MM-DD).' });
      }
      const newDateObj = new Date(`${booking_date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(newDateObj.getTime()) || newDateObj < today) {
        return res.status(400).json({ success: false, message: 'Ngày hẹn mới không được ở trong quá khứ.' });
      }

      if (typeof booking_time !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(booking_time)) {
        return res.status(400).json({ success: false, message: 'Định dạng giờ mới không hợp lệ (HH:mm).' });
      }

      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn này.' });
      }

      // Bảo vệ Bug 7: Chỉ cho phép đổi lịch khi nhân viên chưa tới nhà làm việc (pending, assigned, confirmed)
      if (!['pending', 'assigned', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Không thể đổi lịch khi nhân viên đã đến hoặc công việc đang diễn ra / đã kết thúc.'
        });
      }

      const updated = await BookingModel.reschedule(id, {
        booking_date,
        booking_time,
        notes: notes ? sanitizeInput(notes) : ''
      }, booking.status);
      if (!updated) {
        return res.status(409).json({ success: false, message: 'Trạng thái đơn hàng vừa bị thay đổi. Vui lòng tải lại trang.' });
      }

      const refreshed = await BookingModel.getById(id);

      res.json({
        success: true,
        message: 'Đổi lịch thực hiện dịch vụ thành công! Đội ngũ Cleanova đã ghi nhận lịch hẹn mới.',
        data: refreshed
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Gửi đánh giá dịch vụ cho đơn đã hoàn thành (POST /api/bookings/:id/review)
  async createReview(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { rating = 5, staff_rating = 5, comment = '' } = req.body;

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
        staff_rating: booking.staff_id
          ? Math.min(5, Math.max(1, parseInt(staff_rating, 10) || 5))
          : null,
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
      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }
      if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đánh giá của đơn này.' });
      }
      const review = await BookingModel.getReviewByBookingId(id);
      res.json({
        success: true,
        data: review
      });
    } catch (err) {
      next(err);
    }
  },

  async addTip(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const amount = Number(req.body.amount);
      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }
      if (booking.user_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền gửi tip cho đơn này.' });
      }
      if (booking.status !== 'completed' || !booking.staff_id) {
        return res.status(409).json({ success: false, message: 'Chỉ có thể tip cho nhân viên sau khi hoàn thành đơn.' });
      }
      if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 1000000) {
        return res.status(400).json({ success: false, message: 'Tiền tip phải từ 1.000 đến 1.000.000 đồng.' });
      }
      if (Number(booking.tip_amount || 0) > 0) {
        return res.status(409).json({ success: false, message: 'Bạn đã gửi tip cho nhân viên của đơn này.' });
      }

      const saved = await BookingModel.addTip({ booking_id: id, user_id: req.user.id, amount });
      if (!saved) {
        return res.status(409).json({ success: false, message: 'Không thể lưu tip; đơn có thể vừa được cập nhật.' });
      }
      res.status(201).json({
        success: true,
        message: 'Đã ghi nhận tip tự nguyện của bạn dành cho nhân viên.',
        data: { amount }
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
