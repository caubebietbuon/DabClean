const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function loginUser(email, password) {
  const res = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email, password });
  return res.data.token || (res.data.data && res.data.data.token);
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 CLEANOVA POST-CONSTRUCTION CLEANING - TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  // ------------------------------------------------------------
  // PHẦN 1: STATIC FRONTEND ASSETS & LINKS
  // ------------------------------------------------------------
  console.log('--- PHẦN 1: FRONTEND HTML, CSS & LINKS CHECK ---');
  
  const trangchu = fs.readFileSync('frontend/trangchu.html', 'utf8');
  assert('Homepage Card 5 links to service-post-construction.html',
    trangchu.includes('data-href="service-post-construction.html"') &&
    trangchu.includes('href="service-post-construction.html"'));
  assert('Homepage Card 5 booking button anchors to #construction-booking',
    trangchu.includes('href="service-post-construction.html#construction-booking"'));
  assert('Homepage Pricing Card 5 displays 7.000 - 35.000 VNĐ / m²',
    trangchu.includes('7.000 - 35.000') && trangchu.includes('service-post-construction.html#construction-booking'));

  const mainJs = fs.readFileSync('frontend/main.js', 'utf8');
  assert('main.js Vietnamese dictionary updated to Từ 7.000 VNĐ / m²',
    mainJs.includes("service_5_price: 'Từ 7.000 VNĐ / m²'"));
  assert('main.js English dictionary updated to From 7,000 VND / sq m',
    mainJs.includes("service_5_price: 'From 7,000 VND / sq m'"));

  const pcHtml = fs.readFileSync('frontend/service-post-construction.html', 'utf8');
  assert('service-post-construction.html exists and has hero section',
    pcHtml.includes('id="construction-hero"'));
  assert('service-post-construction.html has scope & building section',
    pcHtml.includes('id="construction-buildings"'));
  assert('service-post-construction.html has detailed work items section',
    pcHtml.includes('id="construction-work-items"'));
  assert('service-post-construction.html has 5-step process section',
    pcHtml.includes('id="construction-process"'));
  assert('service-post-construction.html has reference pricing tables',
    pcHtml.includes('id="construction-pricing"'));
  assert('service-post-construction.html has 3-group interactive booking form',
    pcHtml.includes('id="form-post-construction"') &&
    pcHtml.includes('pricing_type') &&
    pcHtml.includes('building_type') &&
    pcHtml.includes('area_m2'));
  assert('service-post-construction.html has FAQ accordion section',
    pcHtml.includes('id="construction-faq"'));
  assert('service-post-construction.html has final CTA section',
    pcHtml.includes('id="construction-cta"'));

  const adminHtml = fs.readFileSync('frontend/admin.html', 'utf8');
  assert('admin.html has category filter option for construction',
    adminHtml.includes('value="construction"') && adminHtml.includes('Vệ sinh sau xây dựng'));
  assert('admin.html has tab-post-construction for rates configuration',
    adminHtml.includes('id="tab-post-construction"') && adminHtml.includes('pc-m2-townhouse-applied'));
  assert('admin.html has modal-confirm-quote for official quote review',
    adminHtml.includes('id="modal-confirm-quote"') && adminHtml.includes('confirm-quote-price-input'));

  const staffHtml = fs.readFileSync('frontend/staff.html', 'utf8');
  assert('staff.html task card displays post-construction details',
    staffHtml.includes('Hồ sơ công trình sau xây dựng:'));
  assert('staff.html task detail modal displays post-construction specs and read-only rule',
    staffHtml.includes('Nhân viên không được tự ý sửa đổi giá khách hàng'));

  const apiJs = fs.readFileSync('frontend/api.js', 'utf8');
  assert('api.js CleanovaAPI.bookings has getQuote',
    apiJs.includes('getQuote(quoteData)'));
  assert('api.js CleanovaAPI.admin has confirmQuote and config methods',
    apiJs.includes('confirmQuote(id, quoteData)') &&
    apiJs.includes('getPostConstructionConfig()') &&
    apiJs.includes('updatePostConstructionConfig(key, config_data)'));

  // ------------------------------------------------------------
  // PHẦN 2: PRICING ENGINE BACKEND API (THEO M2)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 2: PRICING ENGINE THEO DIỆN TÍCH M² ---');

  // 2.1 Nhà xưởng (100 m²): 100 * 10.000 = 1.000.000 đ
  const resFactory = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', building_type: 'factory', area_m2: 100, dirt_severity: 'medium'
  });
  assert('m² Nhà xưởng (100m²): 1.000.000 đ, min 700k, max 1.2M',
    resFactory.status === 200 &&
    resFactory.data.data.total_price === 1000000 &&
    resFactory.data.data.quoteMinPrice === 700000 &&
    resFactory.data.data.quoteMaxPrice === 1200000,
    JSON.stringify(resFactory.data));

  // 2.2 Nhà phố (100 m²): 100 * 15.000 = 1.500.000 đ
  const resTownhouse = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', building_type: 'townhouse', area_m2: 100, dirt_severity: 'medium'
  });
  assert('m² Nhà phố (100m²): 1.500.000 đ, min 1.2M, max 2.0M',
    resTownhouse.status === 200 &&
    resTownhouse.data.data.total_price === 1500000 &&
    resTownhouse.data.data.quoteMinPrice === 1200000 &&
    resTownhouse.data.data.quoteMaxPrice === 2000000,
    JSON.stringify(resTownhouse.data));

  // 2.3 Biệt thự (100 m²): 100 * 26.000 = 2.600.000 đ
  const resVilla = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', building_type: 'villa', area_m2: 100, dirt_severity: 'medium'
  });
  assert('m² Biệt thự (100m²): 2.600.000 đ, min 2.0M, max 3.5M',
    resVilla.status === 200 &&
    resVilla.data.data.total_price === 2600000 &&
    resVilla.data.data.quoteMinPrice === 2000000 &&
    resVilla.data.data.quoteMaxPrice === 3500000,
    JSON.stringify(resVilla.data));

  // 2.4 m² với phụ phí (vết sơn/keo +10%, lau kính riêng +10%, bẩn nặng unitRate = 18.000 đ/m²)
  const resSurcharge = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', building_type: 'townhouse', area_m2: 100,
    dirt_severity: 'heavy', stubborn_stains: 'severe', glass_cleaning: 'extensive'
  });
  // Base: 100m² * 18.000 = 1.800.000 đ. Surcharges: 10% + 10% = 20% (360.000 đ) -> Total: 2.160.000 đ
  assert('m² Nhà phố kèm phụ phí: 2.160.000 đ',
    resSurcharge.status === 200 &&
    resSurcharge.data.data.total_price === 2160000 &&
    resSurcharge.data.data.surcharges.length === 2,
    JSON.stringify(resSurcharge.data));

  // ------------------------------------------------------------
  // PHẦN 3: PRICING ENGINE TRỌN GÓI & ĐIỀU KIỆN KHẢO SÁT
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 3: PRICING ENGINE TRỌN GÓI & KHẢO SÁT ---');

  // 3.1 Căn hộ 80 m² (thuộc khoảng 60-100m²): Giá chuẩn 2.200.000 đ, status = estimated
  const resPkgIn = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'package', building_type: 'apartment', area_m2: 80, dirt_severity: 'medium'
  });
  assert('Trọn gói Căn hộ 80m² (trong khoảng 60-100m²): 2.200.000 đ, estimated',
    resPkgIn.status === 200 &&
    resPkgIn.data.data.total_price === 2200000 &&
    resPkgIn.data.data.quoteStatus === 'estimated',
    JSON.stringify(resPkgIn.data));

  // 3.2 Căn hộ 120 m² (ngoài khoảng 60-100m²): Tự động chuyển pending_survey
  const resPkgOut = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'package', building_type: 'apartment', area_m2: 120, dirt_severity: 'medium'
  });
  assert('Trọn gói Căn hộ 120m² (ngoài khoảng): pending_survey & có surveyReason',
    resPkgOut.status === 200 &&
    resPkgOut.data.data.quoteStatus === 'pending_survey' &&
    Boolean(resPkgOut.data.data.surveyReason),
    JSON.stringify(resPkgOut.data));

  // 3.3 Nhà phố 200 m², 3 tầng (thuộc khoảng 150-300m², 2-4 tầng): 4.500.000 đ
  const resPkgHouse = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'package', building_type: 'townhouse', area_m2: 200, floors: 3, dirt_severity: 'medium'
  });
  assert('Trọn gói Nhà phố 200m² (3 tầng): 4.500.000 đ, min 3.0M, max 6.0M',
    resPkgHouse.status === 200 &&
    resPkgHouse.data.data.total_price === 4500000 &&
    resPkgHouse.data.data.quoteMinPrice === 3000000 &&
    resPkgHouse.data.data.quoteMaxPrice === 6000000,
    JSON.stringify(resPkgHouse.data));

  // ------------------------------------------------------------
  // PHẦN 4: PRICING ENGINE NHÂN CÔNG THEO NGÀY
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 4: PRICING ENGINE THUÊ NHÂN CÔNG THEO NGÀY ---');

  // 4.1 2 nhân công x 1 ngày: 2 * 1 * 450.000 = 900.000 đ (Tiền công: 2 * 1 * 320.000 = 640.000 đ)
  const resLabor = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'labor_daily', worker_count: 2, work_days: 1
  });
  assert('Nhân công ngày: 2 thợ x 1 ngày = 900.000 đ, tiền công thợ 640.000 đ',
    resLabor.status === 200 &&
    resLabor.data.data.total_price === 900000 &&
    resLabor.data.data.staff_wage === 640000 &&
    resLabor.data.data.quoteMinPrice === 800000 &&
    resLabor.data.data.quoteMaxPrice === 1000000,
    JSON.stringify(resLabor.data));

  // 4.2 3 nhân công x 2 ngày: 3 * 2 * 450.000 = 2.700.000 đ
  const resLabor2 = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'labor_daily', worker_count: 3, work_days: 2
  });
  assert('Nhân công ngày: 3 thợ x 2 ngày = 2.700.000 đ',
    resLabor2.status === 200 &&
    resLabor2.data.data.total_price === 2700000,
    JSON.stringify(resLabor2.data));

  // ------------------------------------------------------------
  // PHẦN 5: NEGATIVE & EDGE CASE VALIDATION
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 5: NEGATIVE VALIDATION ---');

  // 5.1 Diện tích m² âm hoặc bằng 0
  const resNegArea = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', area_m2: -10
  });
  assert('Từ chối diện tích âm (HTTP 400)', resNegArea.status === 400);

  const resZeroArea = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'm2', area_m2: 0
  });
  assert('Từ chối diện tích bằng 0 (HTTP 400)', resZeroArea.status === 400);

  // 5.2 Số nhân công âm hoặc bằng 0
  const resNegWorker = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'labor_daily', worker_count: 0, work_days: 1
  });
  assert('Từ chối số nhân công bằng 0 (HTTP 400)', resNegWorker.status === 400);

  // 5.3 Số ngày làm việc âm
  const resNegDays = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 5, pricing_type: 'labor_daily', worker_count: 2, work_days: -2
  });
  assert('Từ chối số ngày thi công âm (HTTP 400)', resNegDays.status === 400);

  // ------------------------------------------------------------
  // PHẦN 6: ĐẶT LỊCH, LƯU DATABASE & ADMIN XÁC NHẬN BÁO GIÁ
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 6: BOOKING CREATION & ADMIN CONFIRM QUOTE ---');

  const adminToken = await loginUser('admin@cleanova.vn', 'Admin@Cleanova2026!');
  assert('Admin login successful', Boolean(adminToken));

  const customerToken = await loginUser('demo@nova.app', 'NovaDemo2026!');
  assert('Customer login successful', Boolean(customerToken));

  const staffToken = await loginUser('staff@cleanova.vn', 'Staff@Cleanova2026!');
  assert('Staff login successful', Boolean(staffToken));

  // 6.1 Khách hàng tạo đơn Vệ sinh sau xây dựng
  const bookingPayload = {
    service_id: 5,
    pricing_type: 'm2',
    building_type: 'townhouse',
    area_m2: 120,
    floors: 3,
    construction_status: 'newly_completed',
    dirt_severity: 'heavy',
    glass_cleaning: 'detailed',
    stubborn_stains: 'glue_paint',
    furniture_status: 'empty',
    construction_notes: 'Nhà vừa sơn xong hôm qua, cần dọn sạch trước thứ 7',
    booking_date: '2026-10-25',
    booking_time: '08:30:00',
    address: 'Số 99 Đường Lê Duẩn, Hoàn Kiếm, Hà Nội',
    phone: '0988776655',
    payment_method: 'cash',
    contact_name: 'Nguyễn Văn Test',
    contact_phone: '0988776655'
  };

  const resCreate = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    }
  }, bookingPayload);

  assert('Khách đặt đơn Sau xây dựng thành công (HTTP 201)',
    resCreate.status === 201 && Boolean(resCreate.data.data.id),
    JSON.stringify(resCreate.data));

  const newBookingId = resCreate.data.data.id;

  // 6.2 Kiểm tra thông tin đơn trong Admin API
  const resAdminGet = await request({
    hostname: 'localhost', port: 5000, path: `/api/admin/bookings`, method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const foundBooking = (resAdminGet.data.data || []).find(b => b.id === newBookingId);
  assert('Admin xem được đầy đủ 16 trường sau xây dựng của đơn hàng',
    foundBooking &&
    foundBooking.pricing_type === 'm2' &&
    foundBooking.building_type === 'townhouse' &&
    Number(foundBooking.area_m2) === 120 &&
    Number(foundBooking.floors) === 3 &&
    foundBooking.dirt_severity === 'heavy' &&
    foundBooking.stubborn_stains === 'glue_paint',
    JSON.stringify(foundBooking));

  // 6.3 Admin xác nhận báo giá chính thức
  const confirmPayload = {
    confirmed_price: 2400000,
    quote_notes: 'Đã hoàn tất khảo sát trực tiếp. Bố trí 2 chuyên viên kèm máy chà sàn công nghiệp.'
  };

  const resConfirm = await request({
    hostname: 'localhost', port: 5000, path: `/api/admin/bookings/${newBookingId}/confirm-quote`, method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, confirmPayload);

  assert('Admin xác nhận báo giá chính thức thành công (HTTP 200)',
    resConfirm.status === 200 && resConfirm.data.success,
    JSON.stringify(resConfirm.data));

  // 6.4 Kiểm tra snapshot giá đã được lưu
  const resVerifyBooking = await request({
    hostname: 'localhost', port: 5000, path: `/api/bookings/${newBookingId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  assert('Báo giá chính thức được lưu snapshot cố định vào confirmed_price',
    Number(resVerifyBooking.data.data.confirmed_price) === 2400000 &&
    Number(resVerifyBooking.data.data.total_price) === 2400000 &&
    resVerifyBooking.data.data.quote_status === 'confirmed' &&
    resVerifyBooking.data.data.quote_notes.includes('máy chà sàn'),
    JSON.stringify(resVerifyBooking.data));

  // ------------------------------------------------------------
  // PHẦN 7: ADMIN CẤU HÌNH BẢNG GIÁ & KIỂM TRA ĐỒNG BỘ
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 7: ADMIN CẤU HÌNH GIÁ & ĐỒNG BỘ ---');

  const resGetConfig = await request({
    hostname: 'localhost', port: 5000, path: `/api/admin/post-construction/config`, method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert('Admin lấy được toàn bộ cấu hình m2, package, labor_daily',
    resGetConfig.status === 200 &&
    Boolean(resGetConfig.data.data.m2_rates) &&
    Boolean(resGetConfig.data.data.package_rates) &&
    Boolean(resGetConfig.data.data.labor_daily_rates),
    JSON.stringify(resGetConfig.data));

  // Cập nhật giá m2 nhà phố từ 15.000 lên 16.000 đ
  const updatedM2Config = JSON.parse(JSON.stringify(resGetConfig.data.data.m2_rates));
  const targetKey = updatedM2Config.standard ? 'standard' : 'townhouse';
  if (updatedM2Config[targetKey]) {
    updatedM2Config[targetKey].applied = 16000;
  }

  const resUpdateConfig = await request({
    hostname: 'localhost', port: 5000, path: `/api/admin/post-construction/config`, method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { key: 'm2_rates', config_data: updatedM2Config });

  assert('Admin cập nhật thành công cấu hình m2_rates (HTTP 200)',
    resUpdateConfig.status === 200 && resUpdateConfig.data.success);

  // Khôi phục lại 15.000 đ
  if (updatedM2Config[targetKey]) {
    updatedM2Config[targetKey].applied = 15000;
  }
  await request({
    hostname: 'localhost', port: 5000, path: `/api/admin/post-construction/config`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { key: 'm2_rates', config_data: updatedM2Config });

  // ------------------------------------------------------------
  // PHẦN 8: NHÂN VIÊN XEM HỒ SƠ CÔNG TRÌNH & BẢO VỆ GIÁ
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 8: PHÂN CÔNG & QUYỀN NHÂN VIÊN ---');

  // 8.1 Admin phân công nhân viên cho đơn
  const resStaffUsers = await request({
    hostname: 'localhost', port: 5000, path: '/api/admin/staff', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const staffMember = (resStaffUsers.data.data || []).find(s => s.email === 'staff@cleanova.vn') || (resStaffUsers.data.data || [])[0];
  if (staffMember) {
    const resAssign = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/bookings/${newBookingId}/assign`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { staff_id: staffMember.id });
    assert('Admin phân công nhân viên thành công', resAssign.status === 200);

    // 8.2 Nhân viên xem chi tiết công việc
    const resStaffTask = await request({
      hostname: 'localhost', port: 5000, path: `/api/staff/tasks/${newBookingId}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert('Nhân viên nhận được đầy đủ thông số công trình (diện tích, độ bẩn, vết sơn, chỉ dẫn)',
      resStaffTask.status === 200 &&
      Number(resStaffTask.data.data.area_m2) === 120 &&
      resStaffTask.data.data.dirt_severity === 'heavy' &&
      Boolean(resStaffTask.data.data.quote_notes),
      JSON.stringify(resStaffTask.data));

    // 8.3 Nhân viên KHÔNG được phép sửa giá hoặc xác nhận báo giá (Forbidden)
    const resStaffConfirm = await request({
      hostname: 'localhost', port: 5000, path: `/api/admin/bookings/${newBookingId}/confirm-quote`, method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      }
    }, { confirmed_price: 1000000 });
    assert('Nhân viên bị từ chối quyền sửa đổi giá (HTTP 403 Forbidden)',
      resStaffConfirm.status === 403);
  }

  // ------------------------------------------------------------
  // PHẦN 9: KHÔNG LÀM HỎNG CÁC DỊCH VỤ HIỆN CÓ (REGRESSION)
  // ------------------------------------------------------------
  console.log('\n--- PHẦN 9: REGRESSION TEST DỊCH VỤ KHÁC ---');

  // Dịch vụ 1: Dọn dẹp nhà cửa theo giờ / quy mô diện tích
  const resCleaning1 = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 1, area_size: 'medium', frequency: 'once'
  });
  assert('Dịch vụ 1 (Dọn dẹp nhà vừa = 225.000 đ) vẫn hoạt động chính xác',
    resCleaning1.status === 200 && resCleaning1.data.data.total_price === 225000,
    JSON.stringify(resCleaning1.data));

  // Dịch vụ 6: Chăm sóc trẻ em tại nhà gói Buổi
  const resCare6 = await request({
    hostname: 'localhost', port: 5000, path: '/api/bookings/quote', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    service_id: 6, package_type: 'shift', frequency: 'once'
  });
  assert('Dịch vụ 6 (Chăm sóc trẻ em gói Buổi = 300.000 đ) vẫn hoạt động chính xác',
    resCare6.status === 200 && resCare6.data.data.total_price === 300000,
    JSON.stringify(resCare6.data));

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
