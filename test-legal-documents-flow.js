// ===============================================================
// DABCLEAN: TEST SUITE KIỂM THỬ ĐIỀU KHOẢN ĐỐI TÁC & CHÍNH SÁCH BẢO MẬT
// ===============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./backend/src/config/db');

const BASE_URL = 'http://localhost:5000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (body) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = null;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: ĐIỀU KHOẢN ĐỐI TÁC & CHÍNH SÁCH BẢO MẬT');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition, extra = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${extra}`);
    }
  }

  // 1. Kiểm tra trang partner-terms.html mở được qua Web Server
  const termsRes = await request({ path: '/partner-terms.html' });
  assert('Trang partner-terms.html tải thành công (HTTP 200 OK)', termsRes.status === 200);
  assert('partner-terms.html có tiêu đề và văn bản chính thức', termsRes.raw.includes('Điều Khoản Đăng Ký Đối Tác DabClean'));
  assert('partner-terms.html chứa đủ 10 mục điều khoản bắt buộc',
    termsRes.raw.includes('1. Phạm vi & Đối tượng') &&
    termsRes.raw.includes('2. Điều kiện & Xác minh') &&
    termsRes.raw.includes('3. Quy trình 4 bước nhận ca') &&
    termsRes.raw.includes('4. Bảo vệ tài sản & Thông tin') &&
    termsRes.raw.includes('5. Phí, Hai Ví & Thanh toán') &&
    termsRes.raw.includes('6. Hủy đơn & Giải quyết tranh chấp') &&
    termsRes.raw.includes('7. Hành vi bị nghiêm cấm') &&
    termsRes.raw.includes('8. Tạm khóa & Chấm dứt') &&
    termsRes.raw.includes('9. Thay đổi điều khoản') &&
    termsRes.raw.includes('10. Xác nhận đồng ý & Hiệu lực')
  );
  assert('partner-terms.html tài liệu hóa hệ thống Hai Ví (Ví Tín Dụng >= 100k & Ví Thu Nhập)',
    termsRes.raw.includes('Ví Tín Dụng (Credit Wallet)') &&
    termsRes.raw.includes('Ví Thu Nhập (Earnings Wallet)') &&
    termsRes.raw.includes('100.000 VNĐ')
  );

  // 2. Kiểm tra trang privacy-policy.html mở được qua Web Server
  const privacyRes = await request({ path: '/privacy-policy.html' });
  assert('Trang privacy-policy.html tải thành công (HTTP 200 OK)', privacyRes.status === 200);
  assert('privacy-policy.html căn cứ Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15',
    privacyRes.raw.includes('Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15') ||
    privacyRes.raw.includes('91/2025/QH15')
  );
  assert('privacy-policy.html có quy định riêng biệt cho Ảnh trước/sau và GPS',
    privacyRes.raw.includes('Quy định riêng đối với ảnh trước/sau khi làm việc') &&
    privacyRes.raw.includes('tọa độ định vị GPS')
  );
  assert('privacy-policy.html chứa đủ 12 mục chính sách bảo mật',
    privacyRes.raw.includes('1. Đơn vị xử lý & Liên hệ') &&
    privacyRes.raw.includes('2. Các nhóm dữ liệu thu thập') &&
    privacyRes.raw.includes('3. Mục đích & Căn cứ xử lý') &&
    privacyRes.raw.includes('4. Cách thức thu thập') &&
    privacyRes.raw.includes('5. Chia sẻ dữ liệu') &&
    privacyRes.raw.includes('6. Quy định riêng về Ảnh trước/sau') &&
    privacyRes.raw.includes('7. Lưu trữ, Bảo vệ & Thời hạn') &&
    privacyRes.raw.includes('8. Quyền của chủ thể dữ liệu') &&
    privacyRes.raw.includes('9. Rút đồng ý & Ngoại lệ xóa') &&
    privacyRes.raw.includes('10. Cookie & Nhật ký Audit Logs') &&
    privacyRes.raw.includes('11. Quy trình xử lý sự cố dữ liệu') &&
    privacyRes.raw.includes('12. Thay đổi chính sách & Hiệu lực')
  );

  // 3. Kiểm tra trang partner-register.html
  const registerHtmlRes = await request({ path: '/partner-register.html' });
  assert('Trang partner-register.html liên kết thực tế tới partner-terms.html',
    registerHtmlRes.raw.includes('href="partner-terms.html"')
  );
  assert('Trang partner-register.html liên kết thực tế tới privacy-policy.html',
    registerHtmlRes.raw.includes('href="privacy-policy.html"')
  );
  assert('Không còn liên kết placeholder # trong khối điều khoản partner-register.html',
    !registerHtmlRes.raw.includes('href="#" style="color: #0d9488;')
  );
  assert('partner-register.html có checkbox riêng cho tùy chọn Marketing theo Luật 91/2025/QH15',
    registerHtmlRes.raw.includes('id="p-marketing"') &&
    registerHtmlRes.raw.includes('name="marketing_consent"')
  );
  assert('partner-register.html mở tài liệu ở tab mới target="_blank" để không mất dữ liệu form',
    registerHtmlRes.raw.includes('target="_blank"') &&
    registerHtmlRes.raw.includes('rel="noopener noreferrer"')
  );

  // 4. Backend Validation: Gửi đăng ký trực tiếp khi agree_terms = false hoặc thiếu -> Phải từ chối (HTTP 400)
  const randomSuffix = Date.now().toString().slice(-6);
  const testCandidate = {
    name: 'Ứng Viên Test Pháp Lý ' + randomSuffix,
    email: `candidate_${randomSuffix}@partner.dabclean.vn`,
    phone: '097' + randomSuffix + '1',
    password: 'PartnerSecure2026!',
    confirm_password: 'PartnerSecure2026!',
    address: 'Số 100 Duy Tân, Cầu Giấy, Hà Nội',
    work_area: 'Cầu Giấy, Ba Đình',
    experience: '1-3 năm',
    available_hours: 'Toàn thời gian',
    bio: 'Kiểm thử xác thực đồng ý điều khoản',
    agree_terms: false
  };

  const rejectConsentRes = await request({
    path: '/api/partner/register',
    method: 'POST'
  }, testCandidate);

  assert('Backend từ chối khi chưa đồng ý điều khoản (HTTP 400)', rejectConsentRes.status === 400);

  // 5. Backend Registration thành công khi có agree_terms = true, lưu version và consent
  testCandidate.agree_terms = true;
  testCandidate.terms_version = '1.0';
  testCandidate.privacy_version = '1.0';
  testCandidate.marketing_consent = true;

  const validRegisterRes = await request({
    path: '/api/partner/register',
    method: 'POST'
  }, testCandidate);

  assert('Backend đăng ký đối tác thành công khi đồng ý điều khoản (HTTP 201)',
    validRegisterRes.status === 201 && validRegisterRes.data?.success === true
  );
  const createdAppId = validRegisterRes.data?.data?.id;

  // 6. Kiểm tra lưu trữ bền vững trong cơ sở dữ liệu MySQL
  const pool = db.getPool();
  let dbRecord = null;
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM partner_applications WHERE id = ?', [createdAppId]);
    dbRecord = rows[0];
  } else {
    dbRecord = (await db.query('SELECT * FROM partner_applications WHERE id = ?', [createdAppId]))[0];
  }

  assert('Cơ sở dữ liệu lưu chính xác terms_version = "1.0"', dbRecord && dbRecord.terms_version === '1.0');
  assert('Cơ sở dữ liệu lưu chính xác privacy_version = "1.0"', dbRecord && dbRecord.privacy_version === '1.0');
  assert('Cơ sở dữ liệu lưu chính xác terms_accepted_at (timestamp ghi nhận)', dbRecord && dbRecord.terms_accepted_at !== null);
  assert('Cơ sở dữ liệu lưu chính xác marketing_consent = 1 khi người dùng chọn', dbRecord && Number(dbRecord.marketing_consent) === 1);

  // 7. Kiểm tra trường hợp không chọn marketing_consent (marketing_consent = false)
  const candidateNoMarketing = {
    ...testCandidate,
    email: `candidate_nomarketing_${randomSuffix}@partner.dabclean.vn`,
    phone: '098' + randomSuffix + '2',
    marketing_consent: false
  };
  const regNoMarketingRes = await request({
    path: '/api/partner/register',
    method: 'POST'
  }, candidateNoMarketing);

  const noMarketingId = regNoMarketingRes.data?.data?.id;
  let dbRecordNoMarketing = null;
  if (pool) {
    const [rows] = await pool.query('SELECT * FROM partner_applications WHERE id = ?', [noMarketingId]);
    dbRecordNoMarketing = rows[0];
  } else {
    dbRecordNoMarketing = (await db.query('SELECT * FROM partner_applications WHERE id = ?', [noMarketingId]))[0];
  }

  assert('Khi không chọn marketing, marketing_consent lưu = 0 và đăng ký vẫn thành công',
    dbRecordNoMarketing && Number(dbRecordNoMarketing.marketing_consent) === 0
  );

  console.log('\n===============================================================');
  console.log(`🎯 KẾT QUẢ: ${passed}/${total} KIỂM THỬ ĐẠT YÊU CẦU (${Math.round(passed/total * 100)}%)`);
  console.log('===============================================================\n');

  if (passed === total) {
    console.log('🎉 TẤT CẢ CÁC TIÊU CHÍ VỀ ĐIỀU KHOẢN & BẢO MẬT ĐÃ ĐẠT 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
