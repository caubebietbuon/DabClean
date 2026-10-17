// ============================================================
// Kiểm tra khả năng giải mã ảnh của module AI
// Chạy: node test/check-formats.js
// ============================================================
// Tạo ảnh ở nhiều định dạng rồi thử giải mã, để biết CHÍNH XÁC định dạng nào
// hệ thống đọc được. Đây là kiểm chứng thực tế, không phải phỏng đoán.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

const { sniffFormat, decodeImageAsync, bufferToTensor } = require('../src/ml/imageUtils');

const dir = path.join(os.tmpdir(), 'dabclean-fmt-test');
fs.mkdirSync(dir, { recursive: true });

// Mẫu ảnh đơn giản: nền nâu + một khối tối, để mọi định dạng đều mã hoá được
async function makeSample(format, file) {
  const sharp = require('sharp');
  const svg = Buffer.from(
    '<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">'
    + '<rect width="300" height="200" fill="#b4a078"/>'
    + '<rect x="60" y="50" width="120" height="90" fill="#3a2f22"/>'
    + '</svg>'
  );
  await sharp(svg).toFormat(format).toFile(file);
}

async function main() {
  console.log('='.repeat(64));
  console.log('  KIỂM TRA KHẢ NĂNG GIẢI MÃ ẢNH');
  console.log('='.repeat(64));

  // Kiểm tra sharp có sẵn không
  let sharpOk = true;
  try { require('sharp'); } catch { sharpOk = false; }
  console.log(`  sharp: ${sharpOk ? 'CÓ (hỗ trợ nhiều định dạng)' : 'KHÔNG (chỉ JPEG/PNG)'}`);
  console.log('');

  const formats = ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'];
  const results = [];

  for (const fmt of formats) {
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const file = path.join(dir, `sample.${ext}`);

    let made = false;
    try { await makeSample(fmt, file); made = true; } catch (e) {
      results.push({ fmt, made: false, sniff: '-', decode: 'không tạo được mẫu', note: e.message.slice(0, 40) });
      continue;
    }

    const buf = fs.readFileSync(file);
    const sniffed = sniffFormat(buf);

    let decodeResult;
    try {
      const d = await decodeImageAsync(buf, 224);
      decodeResult = `OK (${d.width}x${d.height})`;
    } catch (e) {
      decodeResult = `LỖI: ${e.message.slice(0, 55)}`;
    }

    // Thử luôn đường đi thật mà server dùng
    let tensorResult;
    try {
      const t = await bufferToTensor(buf, '.' + ext, 224);
      tensorResult = `OK ${JSON.stringify(t.shape)}`;
      t.dispose();
    } catch (e) {
      tensorResult = `LỖI: ${e.message.slice(0, 40)}`;
    }

    results.push({ fmt, made: true, sniff: sniffed, decode: decodeResult, tensor: tensorResult, bytes: buf.length });
  }

  console.log('  KẾT QUẢ:');
  console.log('');
  console.log('  ' + 'Định dạng'.padEnd(12) + 'Nhận diện'.padEnd(12) + 'Giải mã'.padEnd(28) + 'Tensor');
  console.log('  ' + '-'.repeat(72));
  for (const r of results) {
    if (!r.made) {
      console.log('  ' + r.fmt.padEnd(12) + 'không tạo được mẫu');
      continue;
    }
    console.log('  ' + r.fmt.padEnd(12) + r.sniff.padEnd(12) + r.decode.padEnd(28) + (r.tensor || ''));
  }
  console.log('');

  // Kết luận
  const ok = results.filter(r => r.made && r.decode.startsWith('OK')).map(r => r.fmt);
  const bad = results.filter(r => r.made && !r.decode.startsWith('OK')).map(r => r.fmt);
  console.log('  ✅ Giải mã được : ' + (ok.join(', ') || '(không có)'));
  console.log('  ❌ Không được   : ' + (bad.join(', ') || '(không có)'));
  console.log('');
  console.log('  Thư mục mẫu: ' + dir);
  console.log('='.repeat(64));
}

main().catch(err => {
  console.error('LỖI:', err.message);
  console.error(err.stack);
  process.exit(1);
});
