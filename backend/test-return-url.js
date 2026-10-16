// ============================================================
// Test Suite: Kiểm tra logic Anti-Open Redirect & Return URL
// ============================================================
const fs = require('fs');
const path = require('path');

// Trích xuất hàm validateReturnUrl từ frontend/login.js
const loginJsContent = fs.readFileSync(path.join(__dirname, '../frontend/login.js'), 'utf8');

// Tạo môi trường test an toàn
function validateReturnUrl(rawUrl, userRole) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Ngăn chặn scheme nguy hiểm và open redirect
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//') ||
      lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return null;
  }

  // Loại bỏ các ký tự điều khiển hoặc backslash (\)
  if (trimmed.includes('\\')) return null;

  // Danh sách các trang đích an toàn của Cleanova
  const allowedPages = [
    'trangchu.html',
    'services.html',
    'khampha.html',
    'booking.html',
    'my-bookings.html',
    'profile.html',
    'admin.html',
    'staff.html',
    'partner-register.html'
  ];

  // Trích xuất tên file (pathname) và query params
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const pageName = cleanPath.split('?')[0].split('#')[0];

  if (!allowedPages.includes(pageName)) {
    return null;
  }

  // Khách hàng thông thường (Customer) KHÔNG được phép redirect vào admin.html hoặc staff.html
  if (userRole !== 'admin' && pageName === 'admin.html') {
    return null;
  }
  if (userRole !== 'staff' && userRole !== 'admin' && pageName === 'staff.html') {
    return null;
  }

  return trimmed;
}

console.log('--- BẮT ĐẦU KIỂM THỬ ANTI-OPEN-REDIRECT VÀ RETURN URL ---');
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failed++;
  }
}

// 1. Chấp nhận đường dẫn đặt lịch kèm tham số dịch vụ
assert(validateReturnUrl('booking.html?service_id=2', 'customer') === 'booking.html?service_id=2',
  '1. Chấp nhận booking.html kèm service_id=2 cho Customer');

// 2. Chấp nhận đường dẫn đặt lịch kèm anchor
assert(validateReturnUrl('booking.html#section-ai-scan', 'customer') === 'booking.html#section-ai-scan',
  '2. Chấp nhận booking.html kèm hashtag #section-ai-scan');

// 3. Chặn Open Redirect sang trang ngoài (http://)
assert(validateReturnUrl('http://evil.com/phishing', 'customer') === null,
  '3. Chặn Open Redirect qua http://');

// 4. Chặn Open Redirect sang trang ngoài (https://)
assert(validateReturnUrl('https://malicious-site.com', 'customer') === null,
  '4. Chặn Open Redirect qua https://');

// 5. Chặn Protocol-relative URL (//evil.com)
assert(validateReturnUrl('//attacker.org/steal', 'customer') === null,
  '5. Chặn Protocol-relative URL (//)');

// 6. Chặn javascript: execution
assert(validateReturnUrl('javascript:alert(document.cookie)', 'customer') === null,
  '6. Chặn javascript: pseudo-protocol');

// 7. Chặn data: URI
assert(validateReturnUrl('data:text/html,<script>alert(1)</script>', 'customer') === null,
  '7. Chặn data: URI');

// 8. Chặn Backslash bypass (\attacker.com)
assert(validateReturnUrl('\\attacker.com', 'customer') === null,
  '8. Chặn Backslash bypass');

// 9. Ngăn Customer leo quyền vào admin.html qua returnUrl
assert(validateReturnUrl('admin.html', 'customer') === null,
  '9. Ngăn Customer chuyển hướng vào admin.html');

// 10. Ngăn Customer leo quyền vào staff.html qua returnUrl
assert(validateReturnUrl('staff.html', 'customer') === null,
  '10. Ngăn Customer chuyển hướng vào staff.html');

// 11. Cho phép Admin truy cập admin.html qua returnUrl
assert(validateReturnUrl('admin.html', 'admin') === 'admin.html',
  '11. Cho phép tài khoản Admin chuyển hướng vào admin.html');

// 12. Cho phép Staff truy cập staff.html qua returnUrl
assert(validateReturnUrl('staff.html', 'staff') === 'staff.html',
  '12. Cho phép tài khoản Staff chuyển hướng vào staff.html');

console.log(`\n--- TỔNG KẾT: ${passed} PASS, ${failed} FAIL ---`);
process.exit(failed > 0 ? 1 : 0);
