// ============================================================
// CLEANOVA BACKEND - Pricing Service (Thống nhất tính giá dịch vụ)
// Hỗ trợ cả Dịch vụ Vệ sinh & Dịch vụ Chăm sóc tại nhà
// ============================================================

// Bảng hệ số tính giá theo quy mô diện tích (Dành cho dịch vụ vệ sinh tiêu chuẩn)
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
  once: 0.0,     // 1 lần (không chiết khấu)
  weekly: 0.15,  // Giảm 15%
  monthly: 0.10  // Giảm 10%
};

const pricingService = {
  areaMultipliers,
  areaM2Mapping,
  frequencyDiscounts,

  /**
   * Tính toán báo giá và tiền công nhân viên cho đơn đặt dịch vụ
   * @param {Object} service - Dữ liệu dịch vụ từ DB
   * @param {Object} options - { area_size, frequency, duration_hours, package_type, discount_code, hasUsedPromo }
   * @returns {Object} { subtotal, discountAmount, totalPrice, staffWage, durationHours, packageType }
   */
  calculatePrice(service, { area_size = 'medium', frequency = 'once', duration_hours = null, package_type = 'hourly', discount_code = null, hasUsedPromo = false } = {}) {
    const basePrice = parseFloat(service.base_price) || 0;
    const isCareService = service.category === 'care' || (service.min_duration_hours && service.min_duration_hours >= 2);
    const isUnitPerM2 = service.price_unit === 'm²' || service.price_unit === 'm2' || service.slug === 've-sinh-sau-xay-dung';

    let subtotal = 0;
    let actualDurationHours = null;
    let staffWage = 0;

    if (isCareService) {
      const normalizedPackage = package_type || 'hourly';

      if (normalizedPackage === 'shift') {
        if (service.is_shift_active === 0 || service.is_shift_active === false) {
          const error = new Error(`Hình thức đặt theo buổi hiện đang tạm dừng cho dịch vụ ${service.name}.`);
          error.statusCode = 400;
          throw error;
        }
        const shiftHours = parseInt(service.shift_hours, 10) || 4;
        actualDurationHours = shiftHours;
        subtotal = service.shift_price ? parseFloat(service.shift_price) : (basePrice * shiftHours);
        staffWage = service.staff_shift_wage ? parseFloat(service.staff_shift_wage) : Math.round(subtotal * 0.72);
      } else if (normalizedPackage === 'daily') {
        if (service.is_daily_active === 0 || service.is_daily_active === false) {
          const error = new Error(`Hình thức đặt theo ngày hiện đang tạm dừng cho dịch vụ ${service.name}.`);
          error.statusCode = 400;
          throw error;
        }
        const dailyHours = parseInt(service.daily_hours, 10) || 8;
        actualDurationHours = dailyHours;
        subtotal = service.daily_price ? parseFloat(service.daily_price) : (basePrice * dailyHours);
        staffWage = service.staff_daily_wage ? parseFloat(service.staff_daily_wage) : Math.round(subtotal * 0.73);
      } else if (normalizedPackage === 'monthly') {
        if (service.is_monthly_active === 0 || service.is_monthly_active === false) {
          const error = new Error(`Hình thức đặt theo tháng hiện đang tạm dừng cho dịch vụ ${service.name}.`);
          error.statusCode = 400;
          throw error;
        }
        const monthlyDays = parseInt(service.monthly_days, 10) || 26;
        const dailyHours = parseInt(service.daily_hours, 10) || 8;
        actualDurationHours = monthlyDays * dailyHours;
        subtotal = service.monthly_price ? parseFloat(service.monthly_price) : (basePrice * actualDurationHours * 0.85);
        staffWage = service.staff_monthly_wage ? parseFloat(service.staff_monthly_wage) : Math.round(subtotal * 0.75);
      } else {
        // Mặc định: Gói theo giờ (hourly)
        const minHours = service.min_duration_hours || 2;
        const parsedHours = parseFloat(duration_hours);
        if (isNaN(parsedHours) || parsedHours < minHours) {
          const error = new Error(`Dịch vụ ${service.name} yêu cầu thời lượng tối thiểu là ${minHours} giờ.`);
          error.statusCode = 400;
          throw error;
        }
        actualDurationHours = parsedHours;
        subtotal = basePrice * actualDurationHours;

        const wageRate = service.staff_wage_rate ? parseFloat(service.staff_wage_rate) : (basePrice * 0.70);
        staffWage = Math.round(wageRate * actualDurationHours);
      }
    } else if (isUnitPerM2) {
      // Dịch vụ vệ sinh tính theo m² (VD: Vệ sinh sau xây dựng)
      const isNumericArea = typeof area_size === 'number' && area_size > 0;
      const m2 = isNumericArea ? area_size : (areaM2Mapping[area_size] || 50);
      subtotal = basePrice * m2;
      const wageRate = service.staff_wage_rate ? parseFloat(service.staff_wage_rate) : (basePrice * 0.70);
      staffWage = Math.round(wageRate * m2);
    } else {
      // Dịch vụ vệ sinh thông thường: Tính theo quy mô diện tích
      const multiplier = areaMultipliers[area_size] || 1.0;
      subtotal = basePrice * multiplier;
      const wageRate = service.staff_wage_rate ? parseFloat(service.staff_wage_rate) : (basePrice * 0.70);
      staffWage = Math.round(wageRate * multiplier);
    }

    // Chiết khấu theo tần suất
    const freqDiscount = frequencyDiscounts[frequency] || 0.0;
    let discountAmount = subtotal * freqDiscount;

    // Ưu đãi mã CLEANOVA20
    const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;
    if (normalizedPromo === 'CLEANOVA20') {
      if (freqDiscount > 0) {
        const error = new Error('Mã ưu đãi CLEANOVA20 chỉ áp dụng cho đơn đặt dịch vụ 1 lần và không áp dụng đồng thời với gói chiết khấu định kỳ.');
        error.statusCode = 400;
        throw error;
      }
      if (hasUsedPromo) {
        const error = new Error('Mã ưu đãi CLEANOVA20 chỉ được áp dụng 1 lần duy nhất cho mỗi tài khoản khách hàng.');
        error.statusCode = 400;
        throw error;
      }
      discountAmount = subtotal * 0.20;
    } else if (normalizedPromo) {
      const error = new Error('Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
      error.statusCode = 400;
      throw error;
    }

    const minFloor = isCareService ? (subtotal * 0.5) : 50000;
    const totalPrice = Math.max(subtotal - discountAmount, minFloor);

    return {
      subtotal: Math.round(subtotal),
      discountAmount: Math.round(discountAmount),
      totalPrice: Math.round(totalPrice),
      staffWage: Math.round(staffWage),
      durationHours: actualDurationHours,
      packageType: isCareService ? (package_type || 'hourly') : 'standard',
      promoCode: normalizedPromo
    };
  }
};

module.exports = pricingService;
