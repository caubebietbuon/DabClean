// ============================================================
// DABCLEAN AI MODULE - Server Entry Point
// ============================================================
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = require('./src/app');
const { modelExists, readMetadata } = require('./predict');

const PORT = process.env.PORT || 5100;
const HOST = process.env.HOST || '0.0.0.0';

function getLanAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}

app.listen(PORT, HOST, () => {
  const lan = getLanAddresses();
  const trained = modelExists();
  const meta = readMetadata();

  console.log('====================================================');
  console.log('  DABCLEAN AI MODULE IS RUNNING');
  console.log(`  - Local URL:  http://localhost:${PORT}`);
  console.log(`  - Health:     http://localhost:${PORT}/api/ai/health`);
  console.log(`  - Demo UI:    http://localhost:${PORT}/index.html`);
  console.log('----------------------------------------------------');
  console.log('  Engine: TensorFlow.js + MobileNet (transfer learning)');
  if (trained) {
    const acc = meta && meta.finalValAccuracy != null
      ? ` (val_acc ${(meta.finalValAccuracy * 100).toFixed(1)}%)`
      : '';
    const when = meta && meta.trainedAt
      ? ` - train lúc ${new Date(meta.trainedAt).toLocaleString('vi-VN')}`
      : '';
    console.log(`  Model : ✅ đã huấn luyện${acc}${when}`);
  } else {
    console.log('  Model : ❌ CHƯA huấn luyện -> chạy "npm run train"');
  }
  console.log('----------------------------------------------------');
  console.log('  Truy cập từ máy khác trong cùng WiFi/LAN:');
  if (lan.length) lan.forEach(ip => console.log(`  - http://${ip}:${PORT}`));
  else console.log('  - (Không tìm thấy địa chỉ IPv4 LAN.)');
  console.log('====================================================');
});
