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
  console.log('🧪 CLEANOVA IN-HOME CARE REDESIGN - TEST SUITE');
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

  // 1. Static HTML & Card Verification
  console.log('\n--- PHẦN 1 & 2: TRANG CHỦ & SERVICE CARDS CLICKABILITY ---');
  const trangchu = fs.readFileSync('frontend/trangchu.html', 'utf8');
  const mainJs = fs.readFileSync('frontend/main.js', 'utf8');
  const homeCss = fs.readFileSync('frontend/css/pages/home.css', 'utf8');

  assert('Card 6 (Child Care) has data-href="care-child.html"', trangchu.includes('data-service-id="6"') && trangchu.includes('data-href="care-child.html"'));
  assert('Card 7 (Elderly Care) has data-href="care-elderly.html"', trangchu.includes('data-service-id="7"') && trangchu.includes('data-href="care-elderly.html"'));
  assert('Card 8 (Patient Care) has data-href="care-patient.html"', trangchu.includes('data-service-id="8"') && trangchu.includes('data-href="care-patient.html"'));
  assert('Card 1 (Cleaning) has data-href="service-cleaning.html"', trangchu.includes('data-service-id="1"') && trangchu.includes('data-href="service-cleaning.html"'));
  assert('Care cards link to booking-care.html?service=X', trangchu.includes('href="booking-care.html?service=6"') && trangchu.includes('href="booking-care.html?service=7"') && trangchu.includes('href="booking-care.html?service=8"'));
  assert('Cards are accessible with role="link" and tabindex="0"', trangchu.includes('tabindex="0" role="link"'));
  assert('main.js handles whole-card click navigation and prevents double-navigation', mainJs.includes('initCardClickNavigation') && mainJs.includes('e.stopPropagation()'));
  assert('home.css has pointer cursor and focus styles for cards', homeCss.includes('cursor: pointer;') && homeCss.includes('.service-card:focus-visible'));

  // 2. Dedicated Care Pages Verification (Part 3)
  console.log('\n--- PHẦN 3: TRANG GIỚI THIỆU CHI TIẾT DỊCH VỤ CHĂM SÓC ---');
  const careChild = fs.readFileSync('frontend/care-child.html', 'utf8');
  const careElderly = fs.readFileSync('frontend/care-elderly.html', 'utf8');
  const carePatient = fs.readFileSync('frontend/care-patient.html', 'utf8');
  const careCss = fs.readFileSync('frontend/css/pages/care.css', 'utf8');

  assert('care-child.html contains 8 required sections and no AI dirt analysis', 
    careChild.includes('Chăm sóc trẻ em tại nhà') && 
    careChild.includes('Bảng giá') && 
    careChild.includes('booking-care.html?service=6') &&
    !careChild.includes('AI phân tích') &&
    !careChild.includes('diện tích nhà'));

  assert('care-elderly.html contains dedicated scope, timeline, and 4 package pricing', 
    careElderly.includes('Chăm sóc người cao tuổi') && 
    careElderly.includes('Theo giờ') && 
    careElderly.includes('Theo ca buổi') && 
    careElderly.includes('Theo ngày') &&
    careElderly.includes('Theo tháng') &&
    careElderly.includes('booking-care.html?service=7'));

  assert('care-patient.html contains physical care scope and clear medical disclaimer', 
    carePatient.includes('Chăm sóc người bệnh tại nhà') && 
    carePatient.includes('không thay thế bác sĩ điều trị') && 
    carePatient.includes('booking-care.html?service=8'));

  assert('care.css contains dedicated styling for timeline, pricing cards, and scope grids', 
    careCss.includes('.care-price-card') && 
    careCss.includes('.care-timeline') && 
    careCss.includes('.care-scope-item'));

  // 3. Dedicated Care Booking Page (Part 4)
  console.log('\n--- PHẦN 4: TRANG ĐẶT LỊCH DỊCH VỤ CHĂM SÓC ---');
  const bookingCare = fs.readFileSync('frontend/booking-care.html', 'utf8');
  assert('booking-care.html has package_type and shift selection', bookingCare.includes('name="package_type"') && bookingCare.includes('id="group-shift-choice"'));
  assert('booking-care.html has recipient name, age, and scope fields', bookingCare.includes('id="care-recipient-name"') && bookingCare.includes('id="care-recipient-age"'));
  assert('booking-care.html has care scope notes field', bookingCare.includes('id="care-scope-notes"'));
  assert('booking-care.html calls /api/bookings/quote for dynamic server calculation', bookingCare.includes('/api/bookings/quote'));

  // 4. Backend API Tests (Parts 4, 5, 6, 7)
  console.log('\n--- PHẦN 5, 6 & 7: BACKEND PRICING, QUOTE, BOOKING & WORKFLOW ---');
  const customerToken = await loginUser('demo@nova.app', 'NovaDemo2026!');
  const staffToken = await loginUser('staff@cleanova.vn', 'Staff@Cleanova2026!');
  const adminToken = await loginUser('admin@cleanova.vn', 'Admin@Cleanova2026!');

  assert('Customer authentication succeeded', !!customerToken);
  assert('Staff authentication succeeded', !!staffToken);
  assert('Admin authentication succeeded', !!adminToken);

  // Test Quote API for Care Service (Hourly)
  const hourlyQuoteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/quote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { service_id: 7, package_type: 'hourly', duration_hours: 3 });

  assert('Quote API: Elderly Care 3h = 270.000 VNĐ (wage 210.000)', 
    hourlyQuoteRes.status === 200 && 
    hourlyQuoteRes.data.data.final_price === 270000 &&
    hourlyQuoteRes.data.data.staff_wage === 210000);

  // Test Quote API for Care Service (Shift)
  const shiftQuoteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/quote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { service_id: 7, package_type: 'shift', shift_choice: 'morning' });

  assert('Quote API: Elderly Care 1 shift (4h) = 340.000 VNĐ (wage 250.000)', 
    shiftQuoteRes.status === 200 && 
    shiftQuoteRes.data.data.final_price === 340000 &&
    shiftQuoteRes.data.data.staff_wage === 250000);

  // Test Quote API for Care Service (Daily)
  const dailyQuoteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/quote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { service_id: 6, package_type: 'daily' });

  assert('Quote API: Child Care 1 day (8h) = 580.000 VNĐ (wage 430.000)', 
    dailyQuoteRes.status === 200 && 
    dailyQuoteRes.data.data.final_price === 580000 &&
    dailyQuoteRes.data.data.staff_wage === 430000);

  // Test Quote API for Care Service (Monthly)
  const monthlyQuoteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/quote',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { service_id: 8, package_type: 'monthly' });

  assert('Quote API: Patient Care 1 month (26 days) = 20.500.000 VNĐ (wage 15.000.000)', 
    monthlyQuoteRes.status === 200 && 
    monthlyQuoteRes.data.data.final_price === 20500000 &&
    monthlyQuoteRes.data.data.staff_wage === 15000000);

  // Test Create Care Booking
  const createCareBookingRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    }
  }, {
    service_id: 7,
    package_type: 'shift',
    shift_choice: 'morning',
    booking_date: '2026-11-01',
    booking_time: '08:00',
    address: 'Số 15 Lê Văn Lương, Cầu Giấy, Hà Nội',
    phone: '0912345678',
    recipient_name: 'Bà Nguyễn Thị Lan',
    recipient_age: 78,
    recipient_gender: 'Nữ',
    care_scope_notes: 'Hỗ trợ sinh hoạt buổi sáng, nhắc uống thuốc huyết áp lúc 9h',
    payment_method: 'cash'
  });

  console.log('createCareBookingRes:', createCareBookingRes.status, createCareBookingRes.data);
  assert('Create Care Booking succeeded with recipient details', 
    createCareBookingRes.status === 201 && 
    createCareBookingRes.data.success === true &&
    (createCareBookingRes.data.data && Number(createCareBookingRes.data.data.total_price) === 340000));

  const careBookingId = createCareBookingRes.data?.data?.id;

  // Admin assigns staff to care booking
  const assignStaffRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/admin/bookings/${careBookingId}/assign`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, { staff_id: 3 });

  assert('Admin assigned staff #3 to Care Booking', assignStaffRes.status === 200);

  // Staff workflow progression WITHOUT photo checklist
  // 1. Confirm
  const staffConfirmRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/tasks/${careBookingId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  }, { status: 'confirmed' });
  assert('Staff confirmed care booking task', staffConfirmRes.status === 200);

  // 2. Arrived
  const staffArriveRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/tasks/${careBookingId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  }, { status: 'arrived' });
  assert('Staff marked arrived at client residence', staffArriveRes.status === 200);

  // 3. In Progress (bypasses room photo checklist for care)
  const staffStartRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/tasks/${careBookingId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  }, { status: 'in_progress', notes: 'Bắt đầu ca chăm sóc buổi sáng' });
  assert('Staff started care task without room photo checklist error', staffStartRes.status === 200);

  // 3.5. Staff confirms cash payment received
  const staffCashRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/tasks/${careBookingId}/cash-payment`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  });
  assert('Staff confirmed cash payment received for care task', staffCashRes.status === 200);

  // 4. Completed (bypasses room photo checklist for care)
  const staffCompleteRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/staff/tasks/${careBookingId}/status`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    }
  }, { status: 'completed', notes: 'Đã hoàn thành ca chăm sóc, cụ Lan đã ăn trưa và nghỉ ngơi an toàn' });
  assert('Staff completed care task without room photo checklist error', staffCompleteRes.status === 200);

  // Admin Care Service Configuration
  // 1. Test updating care packages
  const adminUpdateCareRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/services/7',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    shift_price: 350000,
    staff_shift_wage: 260000
  });
  assert('Admin successfully updated care service package price', adminUpdateCareRes.status === 200);

  // 2. Test negative price rejection
  const adminNegativePriceRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/services/7',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    shift_price: -50000
  });
  assert('Admin rejected negative package price with HTTP 400', adminNegativePriceRes.status === 400);

  // Restore price back to 340.000
  await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/services/7',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    shift_price: 340000,
    staff_shift_wage: 250000
  });

  // Verify Admin UI contains care elements
  const adminHtml = fs.readFileSync('frontend/admin.html', 'utf8');
  assert('admin.html has category filter for care services', adminHtml.includes('id="filter-booking-category"'));
  assert('admin.html modal has care pricing package fields', adminHtml.includes('id="care-pricing-section"') && adminHtml.includes('id="service-shift-price"'));

  // Verify Staff UI contains care elements
  const staffHtml = fs.readFileSync('frontend/staff.html', 'utf8');
  assert('staff.html has care recipient display and bypasses photo checklist', staffHtml.includes('Thông tin ca chăm sóc') && staffHtml.includes('!isCare'));

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
