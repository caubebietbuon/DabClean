// ============================================================
// DABCLEAN BACKEND - Pricing Service (Thống nhất tính giá dịch vụ)
// Hỗ trợ Dịch vụ Vệ sinh tiêu chuẩn, Chăm sóc tại nhà & Vệ sinh sau xây dựng
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

// Bảng giá cấu hình tham khảo mặc định cho Dịch vụ Vệ sinh sau xây dựng
const defaultPostConstructionRates = {
  m2: {
    factory: { name: 'Công trình lớn, mặt bằng thoáng, nhà xưởng', min: 7000, max: 12000, light: 8000, medium: 10000, heavy: 12000 },
    standard: { name: 'Nhà phố, căn hộ chung cư thông thường', min: 12000, max: 20000, light: 13000, medium: 15000, heavy: 18000 },
    luxury: { name: 'Biệt thự, công trình phức tạp, vết bẩn nặng', min: 20000, max: 35000, light: 22000, medium: 26000, heavy: 32000 }
  },
  package: {
    apartment: { name: 'Căn hộ chung cư 60–100 m²', min_area: 60, max_area: 100, min_price: 1500000, max_price: 3000000, standard_price: 2200000 },
    townhouse: { name: 'Nhà phố 2–4 tầng (150–300 m²)', min_area: 150, max_area: 300, min_floors: 2, max_floors: 4, min_price: 3000000, max_price: 6000000, standard_price: 4500000 },
    luxury: { name: 'Biệt thự hoặc căn hộ cao cấp trên 300 m²', min_area: 300, min_price: 6000000, max_price: 12000000, standard_price: 8500000 }
  },
  labor_daily: {
    min_price: 400000,
    max_price: 500000,
    standard_price: 450000,
    staff_daily_wage: 320000,
    includes_equipment: true,
    description: 'Mức giá tham khảo bao gồm máy móc và hóa chất cơ bản theo chính sách CleanNova'
  },
  surcharges: {
    severe_stains: { rate: 0.10, label: 'Vết sơn, xi măng, keo bám nặng (+10%)' },
    extensive_glass: { rate: 0.10, label: 'Vệ sinh nhiều kính / vách kính lớn (+10%)' },
    furnished: { rate: 0.10, label: 'Công trình nhiều đồ đạc cần bảo quản (+10%)' }
  }
};

// Danh mục tiện ích gia tăng (Add-ons) cho dịch vụ dọn dẹp
const standardAddons = {
  disinfect: { id: 'disinfect', name: 'Khử khuẩn Nano Bạc', price: 100000 },
  sofa_steam: { id: 'sofa_steam', name: 'Giặt đệm / Sofa hơi nóng', price: 200000 },
  calcium_remove: { id: 'calcium_remove', name: 'Tẩy cặn canxi kính & vách tắm', price: 120000 },
  fridge_deep: { id: 'fridge_deep', name: 'Vệ sinh tủ lạnh / Lò vi sóng', price: 80000 }
};

const pricingService = {
  areaMultipliers,
  areaM2Mapping,
  frequencyDiscounts,
  defaultPostConstructionRates,
  standardAddons,

  /**
   * Tính toán chiết khấu hoa hồng CleanNova từ tiền công nhân viên
   * platform_commission = employee_gross_earnings * commission_rate
   * employee_net_earnings = employee_gross_earnings - platform_commission
   */
  calculateCommission(grossWage, commissionRate = 0.20) {
    const gross = Math.max(0, Math.round(Number(grossWage) || 0));
    const rate = Number(commissionRate);
    const validRate = isNaN(rate) ? 0.20 : Math.max(0, Math.min(1, rate));
    const platformCommission = Math.min(gross, Math.round(gross * validRate));
    const netWage = Math.max(0, gross - platformCommission);
    return {
      grossWage: gross,
      commissionRate: validRate,
      platformCommission,
      netWage
    };
  },

  /**
   * Tính toán báo giá dịch vụ vệ sinh sau xây dựng
   * Hỗ trợ 3 hình thức: m2, package (trọn gói), labor_daily (nhân công ngày)
   */
  calculatePostConstructionPrice(service, options = {}) {
    const {
      pricing_type = 'm2',
      building_type = 'apartment',
      area_m2 = null,
      area_size = 'medium',
      floors = 1,
      construction_status = 'newly_completed',
      dirt_severity = 'medium',
      glass_cleaning = 'standard',
      stubborn_stains = 'none',
      furniture_status = 'empty',
      worker_count = null,
      work_days = null,
      frequency = 'once',
      discount_code = null,
      hasUsedPromo = false,
      customConfig = null,
      commission_rate = null
    } = options;
    const rates = customConfig || defaultPostConstructionRates;
    let subtotal = 0;
    let appliedUnitRate = 0;
    let quoteMinPrice = 0;
    let quoteMaxPrice = 0;
    let quoteStatus = 'estimated';
    let requiresSurvey = false;
    let surveyReason = '';
    const surchargesList = [];
    let staffWage = 0;
    let parsedArea = null;
    let parsedWorkers = null;
    let parsedDays = null;
    let parsedFloors = parseInt(floors, 10) || 1;

    if (pricing_type === 'm2') {
      // 1. Tính theo m2
      if (area_m2 !== null && area_m2 !== undefined && area_m2 !== '') {
        parsedArea = parseFloat(area_m2);
      } else if (typeof area_size === 'number' && area_size > 0) {
        parsedArea = area_size;
      } else {
        parsedArea = areaM2Mapping[area_size] || 50;
      }

      if (isNaN(parsedArea) || parsedArea <= 0) {
        const error = new Error('Diện tích sàn vệ sinh sau xây dựng phải là số dương lớn hơn 0 m².');
        error.statusCode = 400;
        throw error;
      }

      // Xác định nhóm công trình & đơn giá
      let groupKey = 'standard';
      let altKey = 'townhouse';
      if (['factory', 'office'].includes(building_type)) {
        groupKey = 'factory';
        altKey = 'factory';
      } else if (['villa', 'other'].includes(building_type)) {
        groupKey = 'luxury';
        altKey = 'villa';
      }

      const m2Rates = rates.m2 || rates.m2_rates || defaultPostConstructionRates.m2;
      const m2Config = m2Rates[groupKey] || m2Rates[altKey] || defaultPostConstructionRates.m2[groupKey];
      quoteMinPrice = Math.round(parsedArea * (m2Config.min || 7000));
      quoteMaxPrice = Math.round(parsedArea * (m2Config.max || 35000));

      // Đơn giá áp dụng theo mức độ bẩn hoặc cấu hình applied
      if (m2Config.applied) {
        appliedUnitRate = m2Config.applied;
      } else if (dirt_severity === 'light') {
        appliedUnitRate = m2Config.light || m2Config.min;
      } else if (dirt_severity === 'heavy') {
        appliedUnitRate = m2Config.heavy || m2Config.max;
      } else {
        appliedUnitRate = m2Config.medium || Math.round((m2Config.min + m2Config.max) / 2);
      }

      // Phụ phí cấu hình
      let surchargeRate = 0;
      if (stubborn_stains === 'severe') {
        const rateVal = rates.surcharges?.severe_stains?.rate || 0.10;
        surchargeRate += rateVal;
        surchargesList.push({ name: 'Vết sơn, xi măng, keo bám nặng (+10%)', rate: rateVal });
      }
      if (glass_cleaning === 'extensive') {
        const rateVal = rates.surcharges?.extensive_glass?.rate || 0.10;
        surchargeRate += rateVal;
        surchargesList.push({ name: 'Vệ sinh nhiều vách kính / kính khổ lớn (+10%)', rate: rateVal });
      }
      if (furniture_status === 'furnished') {
        const rateVal = rates.surcharges?.furnished?.rate || 0.10;
        surchargeRate += rateVal;
        surchargesList.push({ name: 'Nhiều đồ đạc cần bảo quản và che chắn (+10%)', rate: rateVal });
      }

      const baseSubtotal = Math.round(parsedArea * appliedUnitRate);
      const surchargeAmount = Math.round(baseSubtotal * surchargeRate);
      subtotal = baseSubtotal + surchargeAmount;
      quoteMaxPrice = Math.round(quoteMaxPrice * (1 + surchargeRate));
      staffWage = Math.round(subtotal * 0.70);

      if (parsedArea >= 500) {
        requiresSurvey = true;
        surveyReason = `Công trình có diện tích lớn (${parsedArea}m²) cần chuyên viên khảo sát thực địa để tối ưu máy chà sàn công nghiệp và số lượng nhân sự.`;
      }
    } else if (pricing_type === 'package') {
      // 2. Tính theo Trọn gói
      if (area_m2 !== null && area_m2 !== undefined && area_m2 !== '') {
        parsedArea = parseFloat(area_m2);
      } else if (typeof area_size === 'number' && area_size > 0) {
        parsedArea = area_size;
      } else {
        parsedArea = areaM2Mapping[area_size] || 80;
      }

      if (isNaN(parsedArea) || parsedArea <= 0) {
        const error = new Error('Vui lòng nhập diện tích sàn hợp lệ để ước tính giá trọn gói.');
        error.statusCode = 400;
        throw error;
      }

      const pkgConfig = rates.package || rates.package_rates || defaultPostConstructionRates.package;

      if (building_type === 'apartment') {
        const pkg = pkgConfig.apartment || pkgConfig.apartment_60_100 || defaultPostConstructionRates.package.apartment;
        quoteMinPrice = pkg.min_price || pkg.min || 1500000;
        quoteMaxPrice = pkg.max_price || pkg.max || 3000000;
        const stdPrice = pkg.standard_price || pkg.standard || 2200000;
        if (parsedArea >= (pkg.min_area || 60) && parsedArea <= (pkg.max_area || 100)) {
          subtotal = (dirt_severity === 'light') ? Math.round(stdPrice * 0.85) :
                     (dirt_severity === 'heavy') ? Math.round(stdPrice * 1.25) : stdPrice;
        } else {
          requiresSurvey = true;
          surveyReason = `Diện tích căn hộ ${parsedArea}m² nằm ngoài khoảng trọn gói tiêu chuẩn (60–100 m²). CleanNova sẽ cử kỹ thuật viên tới khảo sát trực tiếp.`;
          subtotal = parsedArea < (pkg.min_area || 60) ? quoteMinPrice : Math.round(parsedArea * 25000);
        }
      } else if (building_type === 'townhouse') {
        const pkg = pkgConfig.townhouse || pkgConfig.townhouse_150_300 || defaultPostConstructionRates.package.townhouse;
        quoteMinPrice = pkg.min_price || pkg.min || 3000000;
        quoteMaxPrice = pkg.max_price || pkg.max || 6000000;
        const stdPrice = pkg.standard_price || pkg.standard || 4500000;
        if (parsedArea >= (pkg.min_area || 150) && parsedArea <= (pkg.max_area || 300) && parsedFloors >= (pkg.min_floors || 2) && parsedFloors <= (pkg.max_floors || 4)) {
          subtotal = (dirt_severity === 'light') ? Math.round(stdPrice * 0.85) :
                     (dirt_severity === 'heavy') ? Math.round(stdPrice * 1.22) : stdPrice;
        } else {
          requiresSurvey = true;
          surveyReason = `Nhà phố ${parsedArea}m² (${parsedFloors} tầng) nằm ngoài quy chuẩn trọn gói tiêu chuẩn (150–300 m², 2–4 tầng). Cần khảo sát kết cấu và độ cao thực tế.`;
          subtotal = parsedArea < (pkg.min_area || 150) ? quoteMinPrice : Math.round(parsedArea * 22000);
        }
      } else if (building_type === 'villa') {
        const pkg = pkgConfig.luxury || pkgConfig.villa_above_300 || defaultPostConstructionRates.package.luxury;
        quoteMinPrice = pkg.min_price || pkg.min || 6000000;
        quoteMaxPrice = pkg.max_price || pkg.max || 12000000;
        const stdPrice = pkg.standard_price || pkg.standard || 8500000;
        if (parsedArea >= (pkg.min_area || 300)) {
          subtotal = (dirt_severity === 'light') ? Math.round(stdPrice * 0.85) :
                     (dirt_severity === 'heavy') ? Math.round(stdPrice * 1.25) : stdPrice;
        } else {
          subtotal = quoteMinPrice;
        }
        if (dirt_severity === 'heavy' || stubborn_stains === 'severe') {
          requiresSurvey = true;
          surveyReason = 'Biệt thự cao cấp có độ bẩn nặng hoặc nhiều vết sơn xi măng keo cần khảo sát tỉ mỉ để chuẩn bị máy móc chuyên dụng.';
        }
      } else {
        quoteMinPrice = 5000000;
        quoteMaxPrice = 20000000;
        subtotal = Math.round(parsedArea * 15000);
        requiresSurvey = true;
        surveyReason = 'Công trình đặc thù (nhà xưởng/văn phòng/khác) bắt buộc kỹ thuật viên CleanNova khảo sát mặt bằng trước khi chốt giá trọn gói.';
      }

      appliedUnitRate = subtotal;
      staffWage = Math.round(subtotal * 0.70);
      quoteStatus = requiresSurvey ? 'pending_survey' : 'estimated';
    } else if (pricing_type === 'labor_daily') {
      // 3. Tính theo Nhân công theo ngày
      parsedWorkers = parseInt(worker_count, 10);
      parsedDays = parseInt(work_days, 10);

      if (isNaN(parsedWorkers) || parsedWorkers <= 0) {
        const error = new Error('Số lượng nhân công phải là số nguyên dương lớn hơn hoặc bằng 1 người.');
        error.statusCode = 400;
        throw error;
      }
      if (isNaN(parsedDays) || parsedDays <= 0) {
        const error = new Error('Số ngày thuê nhân công phải là số nguyên dương lớn hơn hoặc bằng 1 ngày.');
        error.statusCode = 400;
        throw error;
      }

      const laborConfig = rates.labor_daily || rates.labor_daily_rates || defaultPostConstructionRates.labor_daily;
      appliedUnitRate = laborConfig.applied || laborConfig.standard_price || 450000;
      quoteMinPrice = parsedWorkers * parsedDays * (laborConfig.min_price || laborConfig.min || 400000);
      quoteMaxPrice = parsedWorkers * parsedDays * (laborConfig.max_price || laborConfig.max || 500000);
      subtotal = parsedWorkers * parsedDays * appliedUnitRate;
      staffWage = parsedWorkers * parsedDays * (laborConfig.worker_wage || laborConfig.staff_daily_wage || 320000);
      quoteStatus = 'estimated';
    } else {
      const error = new Error(`Hình thức tính giá '${pricing_type}' không hợp lệ. Vui lòng chọn 'm2', 'package' hoặc 'labor_daily'.`);
      error.statusCode = 400;
      throw error;
    }

    // Chiết khấu theo tần suất
    const freqDiscount = frequencyDiscounts[frequency] || 0.0;
    let discountAmount = Math.round(subtotal * freqDiscount);

    // Ưu đãi mã DABCLEAN20 / CLEANOVA20
    const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;
    if (normalizedPromo === 'CLEANOVA20' || normalizedPromo === 'DABCLEAN20') {
      if (freqDiscount > 0) {
        const error = new Error('Mã ưu đãi chỉ áp dụng cho đơn đặt dịch vụ 1 lần và không áp dụng đồng thời với gói chiết khấu định kỳ.');
        error.statusCode = 400;
        throw error;
      }
      if (hasUsedPromo) {
        const error = new Error('Mã ưu đãi chỉ được áp dụng 1 lần duy nhất cho mỗi tài khoản khách hàng.');
        error.statusCode = 400;
        throw error;
      }
      discountAmount = Math.round(subtotal * 0.20);
    } else if (normalizedPromo) {
      const error = new Error('Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
      error.statusCode = 400;
      throw error;
    }

    const totalPrice = Math.max(subtotal - discountAmount, 0);
    const commission = this.calculateCommission(staffWage, options.commission_rate);

    return {
      subtotal: Math.round(subtotal),
      discountAmount: Math.round(discountAmount),
      totalPrice: Math.round(totalPrice),
      staffWage: commission.grossWage,
      commissionRate: commission.commissionRate,
      platformCommission: commission.platformCommission,
      staffNetWage: commission.netWage,
      durationHours: null,
      packageType: 'post_construction',
      pricingType: pricing_type,
      buildingType: building_type,
      areaM2: parsedArea,
      floors: parsedFloors,
      workerCount: parsedWorkers,
      workDays: parsedDays,
      unitRate: appliedUnitRate,
      quoteStatus,
      quoteMinPrice,
      quoteMaxPrice,
      requiresSurvey,
      surveyReason,
      surcharges: surchargesList,
      promoCode: normalizedPromo
    };
  },

  /**
   * Tính toán báo giá và tiền công nhân viên cho đơn đặt dịch vụ
   * @param {Object} service - Dữ liệu dịch vụ từ DB
   * @param {Object} options - Các tham số tính giá
   * @returns {Object} { subtotal, discountAmount, totalPrice, staffWage, durationHours, packageType, ... }
   */
  calculatePrice(service, options = {}) {
    const {
      area_size = 'medium',
      frequency = 'once',
      duration_hours = null,
      package_type = 'hourly',
      discount_code = null,
      hasUsedPromo = false,
      pricing_type = null
    } = options;

    const isPostConstruction = service.slug === 've-sinh-sau-xay-dung' || service.id === 5;
    if (isPostConstruction && (pricing_type || options.area_m2 !== undefined || options.building_type !== undefined)) {
      return this.calculatePostConstructionPrice(service, options);
    }

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
        // Mặc định: Gói theo giờ (hourly) - Bug 6: Giới hạn trên tối đa 24 giờ / ca
        const minHours = service.min_duration_hours || 2;
        const maxHours = 24;
        const parsedHours = parseFloat(duration_hours);
        if (!Number.isFinite(parsedHours) || isNaN(parsedHours) || parsedHours < minHours || parsedHours > maxHours) {
          const error = new Error(`Dịch vụ ${service.name} yêu cầu thời lượng từ ${minHours} đến ${maxHours} giờ.`);
          error.statusCode = 400;
          throw error;
        }
        actualDurationHours = parsedHours;
        subtotal = basePrice * actualDurationHours;

        const wageRate = service.staff_wage_rate ? parseFloat(service.staff_wage_rate) : (basePrice * 0.70);
        staffWage = Math.round(wageRate * actualDurationHours);
      }
    } else if (isUnitPerM2) {
      // Dịch vụ vệ sinh tính theo m²
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

    // Tính phụ phí tiện ích gia tăng (Add-ons) nếu khách hàng chọn
    let addonAmount = 0;
    const appliedAddons = [];
    const rawAddons = options.addons || options.extras || [];
    const addonList = Array.isArray(rawAddons)
      ? rawAddons
      : (typeof rawAddons === 'string' && rawAddons.trim() ? rawAddons.split(',').map(s => s.trim()) : []);

    for (const aKey of addonList) {
      if (standardAddons[aKey]) {
        addonAmount += standardAddons[aKey].price;
        appliedAddons.push(standardAddons[aKey]);
      }
    }
    subtotal += addonAmount;

    // Chiết khấu theo tần suất
    const freqDiscount = frequencyDiscounts[frequency] || 0.0;
    let discountAmount = subtotal * freqDiscount;

    // Ưu đãi mã giảm giá voucher
    const normalizedPromo = discount_code && typeof discount_code === 'string' ? discount_code.trim().toUpperCase() : null;
    if (options.voucher_discount !== undefined && options.voucher_discount !== null) {
      discountAmount = Math.max(discountAmount, parseFloat(options.voucher_discount) || 0);
    } else if (normalizedPromo === 'CLEANOVA20' || normalizedPromo === 'DABCLEAN20') {
      if (freqDiscount > 0) {
        const error = new Error('Mã ưu đãi chỉ áp dụng cho đơn đặt dịch vụ 1 lần và không áp dụng đồng thời với gói chiết khấu định kỳ.');
        error.statusCode = 400;
        throw error;
      }
      if (hasUsedPromo) {
        const error = new Error('Mã ưu đãi chỉ được áp dụng 1 lần duy nhất cho mỗi tài khoản khách hàng.');
        error.statusCode = 400;
        throw error;
      }
      discountAmount = subtotal * 0.20;
    } else if (normalizedPromo === 'CLEAN50K') {
      if (subtotal < 200000) {
        const error = new Error('Mã ưu đãi CLEAN50K chỉ áp dụng cho đơn từ 200.000 đ trở lên.');
        error.statusCode = 400;
        throw error;
      }
      discountAmount = Math.max(discountAmount, 50000);
    } else if (normalizedPromo) {
      const error = new Error('Mã ưu đãi không hợp lệ hoặc đã hết hạn.');
      error.statusCode = 400;
      throw error;
    }

    const minFloor = isCareService ? (subtotal * 0.5) : 50000;
    const totalPrice = Math.max(subtotal - discountAmount, minFloor);
    const commission = this.calculateCommission(staffWage, options.commission_rate);

    return {
      subtotal: Math.round(subtotal),
      addonAmount: Math.round(addonAmount),
      addons: appliedAddons,
      discountAmount: Math.round(discountAmount),
      totalPrice: Math.round(totalPrice),
      staffWage: commission.grossWage,
      commissionRate: commission.commissionRate,
      platformCommission: commission.platformCommission,
      staffNetWage: commission.netWage,
      durationHours: actualDurationHours,
      packageType: isCareService ? (package_type || 'hourly') : 'standard',
      promoCode: normalizedPromo
    };
  }
};

module.exports = pricingService;
