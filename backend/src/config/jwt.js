// ============================================================
// CLEANOVA BACKEND - JWT Security Configuration
// Quản lý khóa bí mật ký và xác thực JWT token an toàn
// ============================================================
const crypto = require('crypto');

// Danh sách các secret yếu/công khai không được phép dùng để chống giả mạo token
const INSECURE_DEFAULT_SECRETS = new Set([
  'cleanova_super_secret_jwt_key_2026_modern_cleaning',
  'cleanova_change_this_to_a_secure_random_secret_in_production',
  'secret',
  'jwt_secret',
  '123456'
]);

let runtimeSecret = null;

function getJwtSecret() {
  const envSecret = process.env.JWT_SECRET ? process.env.JWT_SECRET.trim() : '';

  // Nếu secret hợp lệ và không nằm trong blacklist mẫu công khai
  if (envSecret && !INSECURE_DEFAULT_SECRETS.has(envSecret)) {
    return envSecret;
  }

  // Trong môi trường Production, bắt buộc phải có JWT_SECRET an toàn, từ chối khởi động
  if (process.env.NODE_ENV === 'production') {
    console.error('====================================================');
    console.error('[FATAL SECURITY ERROR] Trong môi trường Production, biến môi trường JWT_SECRET');
    console.error('bắt buộc phải được cấu hình an toàn và KHÔNG được trùng với secret mẫu công khai!');
    console.error('Ứng dụng từ chối khởi động để ngăn chặn nguy cơ giả mạo Token.');
    console.error('====================================================');
    process.exit(1);
  }

  // Trong môi trường dev/test, tự sinh secret ngẫu nhiên bảo mật cao tại runtime để ngăn chặn kẻ xấu tự ký JWT
  if (!runtimeSecret) {
    runtimeSecret = crypto.randomBytes(48).toString('hex');
    console.warn('[Security Warning] JWT_SECRET chưa được cấu hình hoặc trùng với mẫu công khai trên GitHub.');
    console.warn('[Security Warning] Hệ thống đã tự động tạo khóa ký bảo mật tạm thời (48-byte) trong bộ nhớ để bảo vệ tài khoản.');
  }

  return runtimeSecret;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = {
  getJwtSecret,
  JWT_EXPIRES_IN
};
