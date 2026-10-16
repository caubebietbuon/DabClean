// ============================================================
// CLEANOVA AI MODULE - Sinh dataset ảnh TỔNG HỢP để test pipeline
// ============================================================
// ⚠️ MỤC ĐÍCH: CHỈ để kiểm chứng code train/predict chạy đúng.
// KHÔNG phải dữ liệu thật — model train từ đây KHÔNG dùng cho production.
//
// Ảnh tổng hợp được tạo theo quy luật tương ứng 3 lớp:
//   sach     -> nền sáng, ít chi tiết, ít nhiễu
//   hoi-ban  -> nền trung bình, có vết loang vừa phải
//   rat-ban  -> nền tối, nhiều đốm/vết bẩn rải rác
//
// CÁCH CHẠY:
//   node test/make-synthetic-dataset.js
//   node test/make-synthetic-dataset.js --per-class 30
// ============================================================

const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');

// Bộ sinh số ngẫu nhiên có seed -> tái lập được kết quả
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const WIDTH = 224;
const HEIGHT = 224;

/**
 * Tạo 1 ảnh RGBA tổng hợp theo lớp.
 */
function generateImage(label, rng) {
  const data = Buffer.alloc(WIDTH * HEIGHT * 4);

  // Cấu hình theo lớp
  let base, variance, blobCount, blobDarkness, grain;
  if (label === 'sach') {
    base = 205; variance = 12; blobCount = 3;  blobDarkness = 25; grain = 6;
  } else if (label === 'hoi-ban') {
    base = 150; variance = 30; blobCount = 14; blobDarkness = 55; grain = 22;
  } else { // rat-ban
    base = 95;  variance = 45; blobCount = 30; blobDarkness = 85; grain = 45;
  }

  // Nền + nhiễu hạt
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 4;
      // Gradient nhẹ + nhiễu
      const grad = (x / WIDTH) * 10 - 5;
      const noise = (rng() - 0.5) * variance + (rng() - 0.5) * grain;
      let v = base + grad + noise;
      v = Math.max(0, Math.min(255, v));

      // Lệch tông màu theo lớp (bẩn -> ngả vàng/nâu)
      const tint = label === 'sach' ? 0 : (label === 'hoi-ban' ? 8 : 16);
      data[i]     = Math.max(0, Math.min(255, v + tint));        // R
      data[i + 1] = Math.max(0, Math.min(255, v + tint * 0.5));  // G
      data[i + 2] = Math.max(0, Math.min(255, v - tint * 0.5));  // B
      data[i + 3] = 255;
    }
  }

  // Vẽ các "vết bẩn" hình tròn
  for (let b = 0; b < blobCount; b += 1) {
    const cx = Math.floor(rng() * WIDTH);
    const cy = Math.floor(rng() * HEIGHT);
    const r = 6 + rng() * (label === 'sach' ? 8 : 22);

    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(HEIGHT, cy + r); y += 1) {
      for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(WIDTH, cx + r); x += 1) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        // Càng gần tâm càng đậm
        const strength = (1 - d / r) * (blobDarkness / 255);
        const i = (y * WIDTH + x) * 4;
        data[i]     = Math.max(0, data[i]     * (1 - strength));
        data[i + 1] = Math.max(0, data[i + 1] * (1 - strength));
        data[i + 2] = Math.max(0, data[i + 2] * (1 - strength));
      }
    }
  }

  return data;
}

function main() {
  const args = process.argv.slice(2);
  let perClass = 25;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--per-class') { perClass = parseInt(args[i + 1], 10); i += 1; }
  }

  const datasetDir = path.join(__dirname, '..', 'dataset');
  const labels = ['sach', 'hoi-ban', 'rat-ban'];

  console.log('='.repeat(58));
  console.log('  SINH DATASET TỔNG HỢP (chỉ để test pipeline)');
  console.log('='.repeat(58));
  console.log(`  Thư mục  : ${datasetDir}`);
  console.log(`  Mỗi lớp  : ${perClass} ảnh`);
  console.log(`  Kích thước: ${WIDTH}x${HEIGHT}`);
  console.log('='.repeat(58));

  let total = 0;
  labels.forEach((label, li) => {
    const dir = path.join(datasetDir, label);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (let n = 0; n < perClass; n += 1) {
      const rng = makeRng(li * 100000 + n * 7919 + 12345);
      const rgba = generateImage(label, rng);
      const encoded = jpeg.encode({ data: rgba, width: WIDTH, height: HEIGHT }, 85);
      const file = path.join(dir, `${label}_${String(n).padStart(3, '0')}.jpg`);
      fs.writeFileSync(file, encoded.data);
      total += 1;
    }
    console.log(`  ✅ ${label.padEnd(9)}: ${perClass} ảnh`);
  });

  console.log('='.repeat(58));
  console.log(`  Tổng: ${total} ảnh`);
  console.log('');
  console.log('👉 Bây giờ chạy: node train.js');
  console.log('='.repeat(58));
}

main();
