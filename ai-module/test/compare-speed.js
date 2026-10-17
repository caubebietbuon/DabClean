// So sánh tốc độ + độ chính xác: whole / fast / hybrid
// Chạy: node test/compare-speed.js --sample 5
const fs = require('fs');
const path = require('path');

const { predictFile, loadModel, readMetadata } = require('../predict');
const { LABELS, LABEL_DISPLAY } = require('../src/ml/labels');

const DATASET = path.join(__dirname, '..', 'dataset');

function listJpg(dir) {
  return fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f)).map(f => path.join(dir, f));
}

function pick(files, n) {
  if (files.length <= n) return files;
  const step = files.length / n;
  return Array.from({ length: n }, (_, i) => files[Math.floor(i * step)]);
}

(async () => {
  const n = parseInt(process.argv[3] || '5', 10);
  await loadModel();
  const meta = readMetadata();
  console.log(`Model: val_acc ${(meta.valAccuracy * 100).toFixed(1)}%  |  ${n} anh/lop\n`);

  const modes = ['whole', 'fast', 'hybrid'];
  const summary = {};

  for (const mode of modes) {
    console.log(`═══ ${mode.toUpperCase()} ═══`);
    const t0 = Date.now();
    const acc = {};
    const scores = {};

    for (const cls of LABELS) {
      const files = pick(listJpg(path.join(DATASET, cls)), n);
      let ok = 0;
      let sum = 0;
      for (const f of files) {
        const r = await predictFile(f, { mode });
        if (r.phanLoai === cls) ok += 1;
        sum += r.diem;
      }
      acc[cls] = ok / files.length;
      scores[cls] = sum / files.length;
      console.log(`  ${LABEL_DISPLAY[cls].padEnd(9)} ${ok}/${files.length} (${(ok / files.length * 100).toFixed(0)}%)  điểm TB ${(sum / files.length).toFixed(1)}`);
    }

    const elapsed = (Date.now() - t0) / 1000;
    const perImage = elapsed / (n * 3);
    console.log(`  → ${elapsed.toFixed(0)}s tổng · ${perImage.toFixed(1)}s/ảnh\n`);

    summary[mode] = { acc, scores, elapsed, perImage };
  }

  console.log('═'.repeat(62));
  console.log('  SO SÁNH');
  console.log('═'.repeat(62));
  console.log('  ' + 'Chế độ'.padEnd(10) + 'Sạch'.padEnd(10) + 'Hơi bẩn'.padEnd(11) + 'Rất bẩn'.padEnd(11) + 'Giây/ảnh');
  console.log('  ' + '-'.repeat(58));
  for (const m of modes) {
    const s = summary[m];
    console.log('  ' + m.padEnd(10)
      + `${(s.acc.sach * 100).toFixed(0)}%`.padEnd(10)
      + `${(s.acc['hoi-ban'] * 100).toFixed(0)}%`.padEnd(11)
      + `${(s.acc['rat-ban'] * 100).toFixed(0)}%`.padEnd(11)
      + s.perImage.toFixed(1));
  }
  console.log('═'.repeat(62));

  const base = summary.whole.perImage;
  for (const m of ['fast', 'hybrid']) {
    console.log(`  ${m} chậm hơn whole: ${(summary[m].perImage / base).toFixed(1)}x`);
  }
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
