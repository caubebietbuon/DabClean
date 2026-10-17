// ============================================================
// DABCLEAN BACKEND - Server Entry Point
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

const os = require('os');

function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const lanIP = getLanIP();
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log(`  DABCLEAN BACKEND SERVER IS RUNNING`);
  console.log(`  - Local URL:    http://localhost:${PORT}`);
  console.log(`  - LAN Network:  http://${lanIP}:${PORT}`);
  console.log(`  - API Health:   http://${lanIP}:${PORT}/api/health`);
  console.log(`  - Services API: http://${lanIP}:${PORT}/api/services`);
  console.log('----------------------------------------------------');
  console.log('  Tài khoản Demo có sẵn:');
  console.log('  1. Khách hàng: demo@nova.app / NovaDemo2026!');
  console.log('  2. Quản trị:   admin@cleanova.vn / Admin@Cleanova2026!');
  console.log('====================================================');
});


