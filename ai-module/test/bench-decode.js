// Đo thời gian decode ảnh lớn với các cách tối ưu khác nhau
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DATASET = path.join(__dirname, '..', 'dataset');

async function time(label, fn, times = 3) {
  const t0 = Date.now();
  for (let i = 0; i < times; i += 1) await fn();
  const ms = (Date.now() - t0) / times;
  return { label, ms: Math.round(ms) };
}

(async () => {
  // Tìm 1 ảnh lớn trong rat-ban
  const dir = path.join(DATASET, 'rat-ban');
  const files = fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f));
  let big = null;
  let bigPx = 0;
  for (const f of files.slice(0, 20)) {
    const p = path.join(dir, f);
    const m = await sharp(p).metadata();
    const px = (m.width || 0) * (m.height || 0);
    if (px > bigPx) { bigPx = px; big = p; }
  }
  const m = await sharp(big).metadata();
  console.log(`Anh test: ${path.basename(big)}  ${m.width}x${m.height}  (${(m.width*m.height/1e6).toFixed(1)} MP)`);
  console.log(`File: ${(fs.statSync(big).size/1024).toFixed(0)} KB`);
  console.log('');

  const buf = fs.readFileSync(big);

  const results = [];

  // Cách hiện tại: rotate() + resize + removeAlpha + raw
  results.push(await time('hien tai: rotate+resize+raw', async () => {
    await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize(224, 224, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }));

  // Bỏ rotate (MobileNet không cần hướng chính xác)
  results.push(await time('bo rotate', async () => {
    await sharp(buf, { failOn: 'none' })
      .resize(224, 224, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }));

  // Dùng resize nhỏ trước (2 bước) — giúp shrink-on-load hiệu quả hơn
  results.push(await time('resize 2 buoc (448 -> 224)', async () => {
    await sharp(buf, { failOn: 'none' })
      .resize(448, 448, { fit: 'fill' })
      .resize(224, 224, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  }));

  // Chỉ JPEG encode (không raw) — để so sánh
  results.push(await time('jpeg output (khong raw)', async () => {
    await sharp(buf, { failOn: 'none' })
      .resize(224, 224, { fit: 'fill' })
      .jpeg({ quality: 90 })
      .toBuffer();
  }));

  // Kết xuất
  console.log('  ' + 'Cach lam'.padEnd(34) + 'Thoi gian');
  console.log('  ' + '-'.repeat(48));
  const base = results[0].ms;
  for (const r of results) {
    const rel = ((r.ms / base) * 100).toFixed(0);
    console.log('  ' + r.label.padEnd(34) + `${r.ms} ms`.padEnd(12) + `(${rel}%)`);
  }
  console.log('');
  const best = results.reduce((a, b) => (a.ms < b.ms ? a : b));
  console.log(`  Nhanh nhat: "${best.label}"  (${best.ms} ms, nhanh gap ${(base / best.ms).toFixed(1)}x)`);

  // Ước tính thời gian cho 1057 ảnh
  console.log('');
  console.log('  Uoc tinh cho 1057 anh (chi decode):');
  for (const r of results) {
    console.log('   - ' + r.label.padEnd(34) + `~${Math.round(r.ms * 1057 / 1000 / 60)} phut`);
  }
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
