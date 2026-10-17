// ============================================================
// DABCLEAN BACKEND - Booking Controller (Xử lý đặt lịch & đơn cá nhân)
// ============================================================
const crypto = require('crypto');
const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const WalletModel = require('../models/walletModel');
const VoucherModel = require('../models/voucherModel');
const CommissionPaymentModel = require('../models/commissionPaymentModel');
const pricingService = require('../services/pricingService');
const { sanitizeInput, sanitizeReviewComment } = require('../utils/sanitize');

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
        duration_hours = null,
        package_type = 'hourly',
        shift_choice = null,
        recipient_name = null,
        recipient_age = null,
        recipient_gender = null,
        care_scope_notes = null,
        address,
        phone,
        notes = '',
        discount_code,
        payment_method = 'cash',
        addons = null,
        extras = null,
        // Các trường dịch vụ Vệ sinh sau xây dựng:
        pricing_type = 'm2',
        building_type = 'apartment',
        area_m2 = null,
        floors = 1,
        construction_status = 'newly_completed',
        dirt_severity = 'medium',
        glass_cleaning = 'standard',
        stubborn_stains = 'none',
        furniture_status = 'empty',
        worker_count = null,
        work_days = null,
        construction_notes = null
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
      const effectivePhone = (phone || req.body.contact_phone || '').trim();
      if (!effectivePhone) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại liên hệ.' });
      }

      // Bảo vệ Bug 6: Kiểm tra payment_method trước khi ghi vào MySQL ENUM (hỗ trợ ví CleanNova)
      const validPaymentMethods = ['cash', 'bank_transfer', 'momo', 'vnpay', 'wallet'];
      if (!validPaymentMethods.includes(payment_method)) {
        return res.status(400).json({
          success: false,
          message: `Phương thức thanh toán không hợp lệ. Cho phép: ${validPaymentMethods.join(', ')}.`
        });
      }

      // Kiểm tra dịch vụ có tồn tại không
      const service = await ServiceModel.getById(parseInt(service_id, 10));
      if (!service) {
        return res.status(404).json({ success: false, message: 'Dịch vụ được chọn không tồn tại.' });
      }

      // Kiểm tra trạng thái hoạt động của dịch vụ
      if (service.is_active === 0 || service.is_active === false) {
        return res.status(400).json({ success: false, message: 'Dịch vụ này hiện đang tạm dừng tiếp nhận đơn đặt mới.' });
      }

      const isCareService = service.category === 'care' || (service.min_duration_hours && service.min_duration_hours >= 2);
      const isPostConstruction = service.slug === 've-sinh-sau-xay-dung' || service.id === 5;

      // Bảo vệ Bug 6: Kiểm tra tần suất thực hiện
      const validFrequencies = ['once', 'weekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({
          success: false,
          message: 'Tần suất thực hiện không hợp lệ. Cho phép: once, weekly, monthly.'
        });
      }

      const validAreaSizes = ['small', 'medium', 'large'];
      const isNumericArea = typeof area_size === 'number' && area_size > 0;

      if (isPostConstruction) {
        const validPricingTypes = ['m2', 'package', 'labor_daily'];
        if (pricing_type && !validPricingTypes.includes(pricing_type)) {
          return res.status(400).json({
            success: false,
            message: `Hình thức tính giá '${pricing_type}' không hợp lệ. Cho phép: m2, package, labor_daily.`
          });
        }
        if (pricing_type === 'm2' || pricing_type === 'package') {
          const checkArea = area_m2 !== null && area_m2 !== undefined ? parseFloat(area_m2) : (typeof area_size === 'number' ? area_size : null);
          if (checkArea !== null && (isNaN(checkArea) || checkArea <= 0)) {
            return res.status(400).json({ success: false, message: 'Diện tích sàn công trình phải là số dương lớn hơn 0 m².' });
          }
        }
        if (pricing_type === 'labor_daily') {
          const w = parseInt(worker_count, 10);
          const d = parseInt(work_days, 10);
          if (isNaN(w) || w <= 0) {
            return res.status(400).json({ success: false, message: 'Số lượng nhân công phải là số nguyên dương >= 1.' });
          }
          if (isNaN(d) || d <= 0) {
            return res.status(400).json({ success: false, message: 'Số ngày thi công phải là số nguyên dương >= 1.' });
          }
        }
      } else if (!isCareService && !validAreaSizes.includes(area_size) && !isNumericArea) {
        return res.status(400).json({
          success: false,
          message: 'Quy mô diện tích không hợp lệ. Cho phép: small, medium, large hoặc số m² dương.'
        });
      }

      // Kiểm tra gói dịch vụ chăm sóc nếu là dịch vụ chăm sóc
      const validPackages = ['hourly', 'shift', 'daily', 'monthly'];
      const normalizedPackage = isCareService ? (package_type || 'hourly') : 'hourly';
      if (isCareService && !validPackages.includes(normalizedPackage)) {
        return res.status(400).json({
          success: false,
          message: `Hình thức gói chăm sóc không hợp lệ. Cho phép: ${validPackages.join(', ')}.`
        });
      }

      // Bug 6: Kiểm tra nếu là dịch vụ chăm sóc tại nhà gói giờ thì bắt buộc kiểm tra thời lượng từ min đến tối đa 24 giờ
      if (isCareService && normalizedPackage === 'hourly') {
        const minHours = service.min_duration_hours || 2;
        const maxHours = 24;
        const hours = parseFloat(duration_hours);
        if (!Number.isFinite(hours) || isNaN(hours) || hours < minHours || hours > maxHours) {
          return res.status(400).json({
            success: false,
            message: `Dịch vụ ${service.name} yêu cầu thời lượng từ ${minHours} đến ${maxHours} giờ.`
          });
        }
      }

      // Bug 5: Tính subtotal sơ bộ đáng tin cậy ở backend trước khi kiểm tra min_order_amount của voucher
      let preCalculation;
      try {
        preCalculation = pricingService.calculatePrice(service, {
          area_size: isCareService ? 'care' : (isNumericArea ? area_size : String(area_size)),
          frequency,
          duration_hours: isCareService ? parseFloat(duration_hours) : null,
          package_type: normalizedPackage,
          discount_code: null,
          voucher_discount: null,
          hasUsedPromo: false,
          addons: addons || extras || null,
          pricing_type: isPostConstruction ? (pricing_type || 'm2') : null,
          building_type: isPostConstruction ? building_type : null,
          area_m2: isPostConstruction ? area_m2 : null,
          floors: isPostConstruction ? floors : 1,
          construction_status: isPostConstruction ? construction_status : null,
          dirt_severity: isPostConstruction ? dirt_severity : null,
          glass_cleaning: isPostConstruction ? glass_cleaning : null,
          stubborn_stains: isPostConstruction ? stubborn_stains : null,
          furniture_status: isPostConstruction ? furniture_status : null,
          worker_count: isPostConstruction ? worker_count : null,
          work_days: isPostConstruction ? work_days : null
        });
      } catch (calcErr) {
        return res.status(calcErr.statusCode || 400).json({
          success: false,
          message: calcErr.message
        });
      }

      const reliableSubtotal = preCalculation.subtotal;

      // Kiểm tra mã ưu đãi voucher động dựa trên subtotal tin cậy (Bug 5: Không bỏ qua min_order_amount)
      const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;
      let appliedVoucher = null;
      let voucherDiscountAmount = null;

      if (normalizedPromo) {
        const vCheck = await VoucherModel.validateAndCalculateDiscount({
          code: normalizedPromo,
          userId: req.user.id,
          serviceId: service.id,
          subtotal: reliableSubtotal,
          frequency
        });
        if (!vCheck.valid) {
          return res.status(400).json({ success: false, message: vCheck.reason });
        }
        appliedVoucher = vCheck.voucher;
        voucherDiscountAmount = vCheck.discountAmount;
      }

      // Tính giá & tiền công thống nhất chính thức qua Pricing Service (kèm phụ phí Add-ons & Voucher)
      let calculation;
      try {
        calculation = pricingService.calculatePrice(service, {
          area_size: isCareService ? 'care' : (isNumericArea ? area_size : String(area_size)),
          frequency,
          duration_hours: isCareService ? parseFloat(duration_hours) : null,
          package_type: normalizedPackage,
          discount_code: normalizedPromo,
          voucher_discount: voucherDiscountAmount,
          hasUsedPromo: false,
          addons: addons || extras || null,
          // Post construction options:
          pricing_type: isPostConstruction ? (pricing_type || 'm2') : null,
          building_type: isPostConstruction ? building_type : null,
          area_m2: isPostConstruction ? area_m2 : null,
          floors: isPostConstruction ? floors : 1,
          construction_status: isPostConstruction ? construction_status : null,
          dirt_severity: isPostConstruction ? dirt_severity : null,
          glass_cleaning: isPostConstruction ? glass_cleaning : null,
          stubborn_stains: isPostConstruction ? stubborn_stains : null,
          furniture_status: isPostConstruction ? furniture_status : null,
          worker_count: isPostConstruction ? worker_count : null,
          work_days: isPostConstruction ? work_days : null
        });
      } catch (calcErr) {
        return res.status(calcErr.statusCode || 400).json({
          success: false,
          message: calcErr.message
        });
      }

      const totalPrice = calculation.totalPrice;
      const staffWage = calculation.staffWage;
      const finalDurationHours = calculation.durationHours;

      // Nếu thanh toán bằng Ví DabClean, kiểm tra số dư trước khi tạo đơn
      if (payment_method === 'wallet') {
        const walletInfo = await WalletModel.getBalance(req.user.id);
        if (walletInfo.balance < totalPrice) {
          return res.status(400).json({
            success: false,
            code: 'INSUFFICIENT_WALLET_BALANCE',
            message: `Số dư Ví DabClean (${Math.round(walletInfo.balance).toLocaleString('vi-VN')} đ) không đủ để thanh toán ${Math.round(totalPrice).toLocaleString('vi-VN')} đ. Vui lòng nạp thêm tiền hoặc chọn phương thức khác.`
          });
        }
      }

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
            area_size: isCareService ? 'care' : (isPostConstruction && calculation.areaM2 ? `${calculation.areaM2}m2` : String(area_size)),
            frequency,
            address: sanitizeInput(address),
            phone: sanitizeInput(effectivePhone),
            notes: notes ? sanitizeInput(notes) : '',
            total_price: totalPrice,
            discount_code: calculation.promoCode,
            payment_method,
            duration_hours: finalDurationHours,
            staff_wage: staffWage,
            wage_status: 'pending',
            package_type: normalizedPackage,
            shift_choice: shift_choice ? sanitizeInput(shift_choice) : null,
            recipient_name: recipient_name ? sanitizeInput(recipient_name) : null,
            recipient_age: recipient_age ? sanitizeInput(recipient_age) : null,
            recipient_gender: recipient_gender ? sanitizeInput(recipient_gender) : null,
            care_scope_notes: care_scope_notes ? sanitizeInput(care_scope_notes) : null,
            pricing_type: isPostConstruction ? (calculation.pricingType || pricing_type || 'm2') : 'm2',
            building_type: isPostConstruction ? (calculation.buildingType || building_type) : null,
            area_m2: isPostConstruction ? calculation.areaM2 : null,
            floors: isPostConstruction ? calculation.floors : 1,
            construction_status: isPostConstruction ? sanitizeInput(construction_status) : null,
            dirt_severity: isPostConstruction ? sanitizeInput(dirt_severity) : null,
            glass_cleaning: isPostConstruction ? sanitizeInput(glass_cleaning) : null,
            stubborn_stains: isPostConstruction ? sanitizeInput(stubborn_stains) : null,
            furniture_status: isPostConstruction ? sanitizeInput(furniture_status) : null,
            worker_count: isPostConstruction ? calculation.workerCount : null,
            work_days: isPostConstruction ? calculation.workDays : null,
            quote_status: isPostConstruction ? calculation.quoteStatus : 'estimated',
            quote_min_price: isPostConstruction ? calculation.quoteMinPrice : null,
            quote_max_price: isPostConstruction ? calculation.quoteMaxPrice : null,
            quote_notes: null,
            construction_notes: construction_notes ? sanitizeInput(construction_notes) : null,
            addons: calculation.addons || null,
            addon_amount: calculation.addonAmount || 0.00
          });
          break;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY' && attempt < 4) {
            continue;
          }
          throw err;
        }
      }

      // Bug 8 & Bug 10: Xử lý ghi nhận voucher và thanh toán ví có rollback an toàn
      let voucherRecorded = false;
      try {
        // Ghi nhận lượt sử dụng voucher nguyên tử nếu có áp dụng (Bug 8: atomic update usage_limit)
        if (appliedVoucher && calculation.discountAmount > 0 && bookingId) {
          await VoucherModel.recordUsage(appliedVoucher.id, req.user.id, bookingId, calculation.discountAmount);
          voucherRecorded = true;
        }

        // Nếu thanh toán bằng Ví DabClean, tiến hành trừ tiền nguyên tử (Bug 10: rollback nếu thất bại)
        if (payment_method === 'wallet' && bookingId) {
          await WalletModel.payBooking({
            userId: req.user.id,
            bookingId
          });
        }
      } catch (txErr) {
        // Rollback hoàn toàn: Xóa booking mồ côi và hoàn lại voucher nếu thanh toán thất bại
        if (bookingId) {
          await BookingModel.deleteById(bookingId);
        }
        if (voucherRecorded && appliedVoucher) {
          await VoucherModel.rollbackUsage(appliedVoucher.id, bookingId);
        }
        return res.status(txErr.statusCode || 400).json({
          success: false,
          code: txErr.code || 'BOOKING_PAYMENT_FAILED',
          message: `Xử lý đơn đặt lịch thất bại: ${txErr.message}. Đơn hàng đã được hủy an toàn và không ghi nhận.`
        });
      }

      const newBooking = await BookingModel.getById(bookingId);

      const successMsg = isPostConstruction && calculation.quoteStatus === 'pending_survey'
        ? 'Gửi yêu cầu khảo sát & báo giá dịch vụ vệ sinh sau xây dựng thành công! DabClean sẽ liên hệ khảo sát thực tế miễn phí và gửi báo giá chính thức.'
        : (payment_method === 'wallet'
            ? 'Đặt lịch & thanh toán bằng Ví DabClean thành công! Đội ngũ DabClean sẽ liên hệ xác nhận.'
            : 'Đặt lịch dịch vụ thành công! Đội ngũ DabClean sẽ liên hệ xác nhận trong ít phút.');

      res.status(201).json({
        success: true,
        message: successMsg,
        data: newBooking
      });
    } catch (err) {
      next(err);
    }
  },

  // Lấy báo giá chi tiết trực tiếp từ backend (POST /api/bookings/quote)
  async getQuote(req, res, next) {
    try {
      const {
        service_id,
        area_size = 'medium',
        frequency = 'once',
        duration_hours = null,
        package_type = 'hourly',
        discount_code = null,
        addons = null,
        extras = null,
        // Post-construction fields:
        pricing_type = null,
        building_type = null,
        area_m2 = null,
        floors = 1,
        construction_status = 'newly_completed',
        dirt_severity = 'medium',
        glass_cleaning = 'standard',
        stubborn_stains = 'none',
        furniture_status = 'empty',
        worker_count = null,
        work_days = null
      } = req.body;

      if (!service_id) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp service_id.' });
      }

      const service = await ServiceModel.getById(parseInt(service_id, 10));
      if (!service) {
        return res.status(404).json({ success: false, message: 'Dịch vụ được chọn không tồn tại.' });
      }

      const isCareService = service.category === 'care' || (service.min_duration_hours && service.min_duration_hours >= 2);
      const isPostConstruction = service.slug === 've-sinh-sau-xay-dung' || service.id === 5;
      const isNumericArea = typeof area_size === 'number' && area_size > 0;
      const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;

      // Bug 6: Validate duration_hours trong getQuote
      if (isCareService && (package_type || 'hourly') === 'hourly') {
        const minHours = service.min_duration_hours || 2;
        const maxHours = 24;
        const hours = parseFloat(duration_hours);
        if (!Number.isFinite(hours) || isNaN(hours) || hours < minHours || hours > maxHours) {
          return res.status(400).json({
            success: false,
            message: `Dịch vụ ${service.name} yêu cầu thời lượng từ ${minHours} đến ${maxHours} giờ.`
          });
        }
      }

      let alreadyUsedPromo = false;
      if (req.user && (normalizedPromo === 'CLEANOVA20' || normalizedPromo === 'DABCLEAN20')) {
        alreadyUsedPromo = (await BookingModel.hasUsedPromoCode(req.user.id, 'CLEANOVA20')) || (await BookingModel.hasUsedPromoCode(req.user.id, 'DABCLEAN20'));
      }

      // Bug 5: Validate voucher động kiểm tra min_order_amount đồng bộ
      let voucherDiscountAmount = null;
      if (normalizedPromo && !['CLEANOVA20', 'DABCLEAN20', 'CLEAN50K'].includes(normalizedPromo)) {
        const preCalc = pricingService.calculatePrice(service, {
          area_size: isCareService ? 'care' : (isNumericArea ? area_size : String(area_size)),
          frequency,
          duration_hours: isCareService ? parseFloat(duration_hours) : null,
          package_type: isCareService ? (package_type || 'hourly') : 'hourly',
          discount_code: null,
          voucher_discount: null,
          addons: addons || extras || null,
          pricing_type: isPostConstruction ? (pricing_type || 'm2') : null,
          building_type: isPostConstruction ? (building_type || 'apartment') : null,
          area_m2: isPostConstruction ? area_m2 : null,
          floors: isPostConstruction ? floors : 1,
          construction_status: isPostConstruction ? construction_status : null,
          dirt_severity: isPostConstruction ? dirt_severity : null,
          glass_cleaning: isPostConstruction ? glass_cleaning : null,
          stubborn_stains: isPostConstruction ? stubborn_stains : null,
          furniture_status: isPostConstruction ? furniture_status : null,
          worker_count: isPostConstruction ? worker_count : null,
          work_days: isPostConstruction ? work_days : null
        });

        const vCheck = await VoucherModel.validateAndCalculateDiscount({
          code: normalizedPromo,
          userId: req.user ? req.user.id : null,
          serviceId: service.id,
          subtotal: preCalc.subtotal,
          frequency
        });
        if (!vCheck.valid) {
          return res.status(400).json({ success: false, message: vCheck.reason });
        }
        voucherDiscountAmount = vCheck.discountAmount;
      }

      const calculation = pricingService.calculatePrice(service, {
        area_size: isCareService ? 'care' : (isNumericArea ? area_size : String(area_size)),
        frequency,
        duration_hours: isCareService ? parseFloat(duration_hours) : null,
        package_type: isCareService ? (package_type || 'hourly') : 'hourly',
        discount_code: normalizedPromo,
        voucher_discount: voucherDiscountAmount,
        hasUsedPromo: alreadyUsedPromo,
        addons: addons || extras || null,
        pricing_type: isPostConstruction ? (pricing_type || 'm2') : null,
        building_type: isPostConstruction ? (building_type || 'apartment') : null,
        area_m2: isPostConstruction ? area_m2 : null,
        floors: isPostConstruction ? floors : 1,
        construction_status: isPostConstruction ? construction_status : null,
        dirt_severity: isPostConstruction ? dirt_severity : null,
        glass_cleaning: isPostConstruction ? glass_cleaning : null,
        stubborn_stains: isPostConstruction ? stubborn_stains : null,
        furniture_status: isPostConstruction ? furniture_status : null,
        worker_count: isPostConstruction ? worker_count : null,
        work_days: isPostConstruction ? work_days : null
      });

      res.json({
        success: true,
        data: {
          ...calculation,
          total_price: calculation.totalPrice,
          final_price: calculation.totalPrice,
          staff_wage: calculation.staffWage,
          service_name: service.name,
          service_category: service.category || (isCareService ? 'care' : 'cleaning'),
          base_price: parseFloat(service.base_price) || 0
        }
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

      // Bảo vệ Bug 7 & Phase 4: Nếu đơn đã thanh toán qua Ví DabClean, tự động hoàn tiền 100% vào Ví người dùng
      const sanitizedReason = sanitizeInput(reason);
      if (booking.payment_method === 'wallet' && booking.payment_status === 'paid') {
        await WalletModel.refundBooking({
          bookingId: id,
          reason: `Khách hàng hủy đơn: ${sanitizedReason}`,
          adminId: req.user.id
        });
      } else {
        const cancelled = await BookingModel.updateStatus(id, 'cancelled', sanitizedReason, booking.status);
        if (!cancelled) {
          return res.status(409).json({ success: false, message: 'Trạng thái đơn hàng vừa bị thay đổi. Vui lòng tải lại trang.' });
        }
      }

      // Hoàn trả chiết khấu cho nhân viên nếu đơn đã thanh toán chiết khấu (không do lỗi nhân viên)
      if (booking.commission_status === 'paid') {
        try {
          await CommissionPaymentModel.handleCancellationRefund({
            bookingId: id,
            cancelReason: `Khách hàng hủy đơn: ${sanitizedReason}`,
            fault: 'customer',
            adminId: req.user.id
          });
        } catch (commErr) {
          console.error('Lỗi hoàn chiết khấu cho thợ khi khách hủy đơn:', commErr.message);
        }
      }

      res.json({
        success: true,
        message: (booking.payment_method === 'wallet' && booking.payment_status === 'paid')
          ? 'Hủy đơn đặt lịch thành công và đã hoàn tiền 100% vào Ví DabClean của bạn!'
          : 'Hủy đơn đặt lịch thành công.'
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
        message: 'Đổi lịch thực hiện dịch vụ thành công! Đội ngũ DabClean đã ghi nhận lịch hẹn mới.',
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
      const { rating = 5, staff_rating = 5 } = req.body;
      const rawComment = req.body.comment;

      // Bug 3: Validate kiểu dữ liệu và giới hạn độ dài comment
      if (rawComment !== undefined && rawComment !== null && typeof rawComment !== 'string') {
        return res.status(400).json({ success: false, message: 'Nội dung nhận xét phải là chuỗi văn bản.' });
      }
      const commentStr = typeof rawComment === 'string' ? rawComment.trim() : '';
      if (commentStr.length > 1000) {
        return res.status(400).json({ success: false, message: 'Nội dung đánh giá không được vượt quá 1000 ký tự.' });
      }

      const parsedRating = parseInt(rating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, message: 'Điểm đánh giá dịch vụ phải từ 1 đến 5 sao.' });
      }

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

      let parsedStaffRating = null;
      if (booking.staff_id && staff_rating !== undefined && staff_rating !== null) {
        const sr = parseInt(staff_rating, 10);
        if (!isNaN(sr) && sr >= 1 && sr <= 5) {
          parsedStaffRating = sr;
        } else {
          parsedStaffRating = 5;
        }
      }

      // Xử lý an toàn HTML entities và loại bỏ các payload XSS trong comment
      const cleanComment = sanitizeReviewComment(commentStr);

      const reviewId = await BookingModel.createReview({
        booking_id: id,
        user_id: req.user.id,
        service_id: booking.service_id,
        rating: parsedRating,
        staff_rating: parsedStaffRating,
        comment: cleanComment
      });

      res.status(201).json({
        success: true,
        message: 'Cảm ơn bạn đã gửi đánh giá chất lượng dịch vụ cho DabClean!',
        data: { id: reviewId, rating: parsedRating, staff_rating: parsedStaffRating, comment: cleanComment }
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
