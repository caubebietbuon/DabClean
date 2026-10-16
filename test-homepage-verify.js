const fs = require('fs');

const html = fs.readFileSync('frontend/trangchu.html', 'utf8');
const main = fs.readFileSync('frontend/main.js', 'utf8');
const css = fs.readFileSync('frontend/css/pages/home.css', 'utf8');

console.log('--- VERIFYING HOMEPAGE REQUIREMENT CHECKLIST ---');

const checks = [
  { name: '1. Hero Title: Chăm sóc ngôi nhà, an tâm chăm sóc gia đình', pass: html.includes('Chăm sóc ngôi nhà, an tâm chăm sóc gia đình') },
  { name: '1. Hero CTA Explore: Khám phá dịch vụ', pass: html.includes('Khám phá dịch vụ') && html.includes('href="#services"') },
  { name: '1. Hero CTA Book: Đặt lịch ngay', pass: html.includes('Đặt lịch ngay') },
  { name: '2. Services Section 8 Cards', pass: [1,2,3,4,5,6,7,8].every(id => html.includes(`data-service-id="${id}"`)) },
  { name: '2. Category Tabs for Cleaning & Care', pass: html.includes('id="services-category-tabs"') && html.includes('data-filter="cleaning"') && html.includes('data-filter="care"') },
  { name: '2. Child care service (80.000 / giờ, min 2h)', pass: html.includes('Chăm sóc trẻ em tại nhà') && html.includes('80.000') && html.includes('Tối thiểu: 2 giờ') },
  { name: '2. Elderly care service (90.000 / giờ, min 2h)', pass: html.includes('Chăm sóc người cao tuổi') && html.includes('90.000') && html.includes('Tối thiểu: 2 giờ') },
  { name: '2. Patient care service (120.000 / giờ, min 2h)', pass: html.includes('Chăm sóc người bệnh tại nhà') && html.includes('120.000') && html.includes('Tối thiểu: 2 giờ') },
  { name: '2. Service Detail button on cards', pass: html.includes('btn-service-detail') },
  { name: '3. Section Vì sao chọn CleanNova 5 points', pass: [1,2,3,4,5].every(i => html.includes(`why_point_${i}_title`)) },
  { name: '4. Section 4 Bước đặt dịch vụ', pass: [1,2,3,4].every(i => html.includes(`workflow_step_${i}_title`)) },
  { name: '5. Section Bảng giá dịch vụ with tabs', pass: html.includes('id="pricing-table"') && html.includes('id="pricing-category-tabs"') },
  { name: '5. Pricing error state container', pass: html.includes('id="pricing-error-state"') },
  { name: '6. Section Cam kết & Phạm vi', pass: html.includes('id="commitments"') && html.includes('scope-disclaimer-callout') },
  { name: '6. Patient care disclaimer (không phải điều trị y tế)', pass: html.includes('KHÔNG PHẢI') && html.includes('điều trị y tế') },
  { name: '7. Section FAQ 6 Questions', pass: [
    'Giá dịch vụ được tính như thế nào?',
    'Có thể đặt dịch vụ tối thiểu bao nhiêu giờ?',
    'Có thể đổi hoặc hủy lịch không?',
    'Làm thế nào để theo dõi lịch đặt?',
    'Tiền dịch vụ được thanh toán như thế nào?',
    'Nhân viên chăm sóc có thể thực hiện những công việc gì?'
  ].every(q => html.includes(q)) },
  { name: '8. Footer contact info real (1900-8888, contact@cleanova.vn, 123 Đường Cầu Giấy)', pass: html.includes('1900-8888') && html.includes('contact@cleanova.vn') && html.includes('123 Đường Cầu Giấy') },
  { name: 'Service Details Modal Dialog in HTML', pass: html.includes('id="service-modal"') && html.includes('id="modal-service-price"') },
  { name: 'CSS tokens and rules present in home.css', pass: css.includes('.badge-category-care') && css.includes('.service-modal-overlay') && css.includes('.scope-disclaimer-callout') },
  { name: 'JS initServicesAndPricing connects to API', pass: main.includes('initServicesAndPricing') && main.includes('/api/services') },
  { name: 'JS modal open/close handlers', pass: main.includes('initServiceModal') && main.includes('serviceDetailsData') },
  { name: 'JS calculator handles care services', pass: main.includes('child_care') && main.includes('elderly_care') && main.includes('patient_care') }
];

let allPass = true;
checks.forEach(c => {
  if (c.pass) {
    console.log(`✅ [PASS] ${c.name}`);
  } else {
    console.log(`❌ [FAIL] ${c.name}`);
    allPass = false;
  }
});

if (allPass) {
  console.log('\n🎯 ALL 22 HOMEPAGE VERIFICATION CHECKS PASSED!');
} else {
  console.log('\n❌ SOME CHECKS FAILED!');
  process.exit(1);
}
