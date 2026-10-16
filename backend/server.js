// ============================================================
// CLEANOVA BACKEND - Server Entry Point
// ============================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const PORT = process.env.PORT || 5000;

// Bắt các ngoại lệ chưa xử lý để ngăn server bị dừng đột ngột
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Error] Unhandled Rejection:', reason && reason.message ? reason.message : reason);
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`  CLEANOVA BACKEND SERVER IS RUNNING`);
  console.log(`  - Local URL:    c`);
  console.log(`  - API Health:   http://localhost:${PORT}/api/health`);
  console.log(`  - Services API: http://localhost:${PORT}/api/services`);
  console.log('----------------------------------------------------');
  console.log('  Tài khoản Demo có sẵn:');
  console.log('  1. Khách hàng: demo@nova.app / NovaDemo2026!');
  console.log('  2. Quản trị:   admin@cleanova.vn / Admin@Cleanova2026!');
  console.log('====================================================');
});

