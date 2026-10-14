// ============================================================
// CLEANOVA BACKEND - Server Entry Point
// ============================================================
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`  CLEANOVA BACKEND SERVER IS RUNNING`);
  console.log(`  - Local URL:    http://localhost:${PORT}`);
  console.log(`  - API Health:   http://localhost:${PORT}/api/health`);
  console.log(`  - Services API: http://localhost:${PORT}/api/services`);
  console.log('----------------------------------------------------');
  console.log('  Tài khoản Demo có sẵn:');
  console.log('  1. Khách hàng: demo@nova.app / NovaDemo2026!');
  console.log('  2. Quản trị:   admin@cleanova.vn / Admin@Cleanova2026!');
  console.log('====================================================');
});
