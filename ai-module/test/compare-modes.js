// ============================================================
// CLEANOVA AI - So sánh cách chấm WHOLE vs PATCH
// Chạy: node test/compare-modes.js [--sample 12]
// ============================================================
// Chấm cùng một bộ ảnh bằng 2 cách để thấy khác biệt:
//   - WHOLE : nén cả ảnh -> 1 xác suất (cách cũ)
//   - PATCH : chia lưới 3x3, chấm từng ô (cách mới)
//
// Mục tiêu: cách PATCH phải cho điểm CAO HƠN rõ rệt trên ảnh ngập rác,
// và giữ nguyên (không tăng) trên ảnh sạch.
// ============================================================

const fs = require('fs');
const path = require('path');

const { predictFile, loadModel, readMetadata } = require('../predict');
const { LABEL_DISPLAY } = require('../src/ml/labels');

const DATASET = path.join(__dirname, '..', 'dataset');

function parseArgs(argv) {
  const args = { sample: 12 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--sample') { args.sample = parseInt(argv[i + 1], 10); i += 1; }
  }
  return args;
}

// Lấy mẫu rải đều để kết quả tái lập được
function pick(files, n) {
  if (files.length <= n) return files;
  const step = files.length / n;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(files[Math.floor(i * step)]);
  return out;
}

function listJpg(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.jpe?g$/i.test(f))
    .map(f => path.join(dir, f));
}

async function main() {
  const args = parseArgs(process.argv);
  await loadModel();
  const meta = readMetadata();

  console.log('='.repeat(78));
  console.log('  SO SÁNH CÁCH CHẤM: WHOLE (cả ảnh) vs PATCH 3x3 (theo vùng)');
  console.log('='.repeat(78));
  if (meta) {
    console.log(`  Model train lúc: ${new Date(meta.trainedAt).toLocaleString('vi-VN')}`);
    console.log(`  Số ảnh train  : ${JSON.stringify(meta.datasetCounts)}`);
  }
  console.log('');

  const classes = ['sach', 'hoi-ban', 'rat-ban'];
  const summary = {};

  for (const cls of classes) {
    const files = pick(listJpg(path.join(DATASET, cls)), args.sample);
    if (files.length === 0) { console.log(`  (bỏ qua ${cls}: không có ảnh)`); continue; }

    console.log(`  ── ${LABEL_DISPLAY[cls]} (${files.length} ảnh mẫu) ──`);
    console.log('  ' + 'Ảnh'.padEnd(30) + 'WHOLE'.padEnd(22) + 'PATCH 3x3');
    console.log('  ' + '-'.repeat(74));

    let sumW = 0; let sumP = 0;
    let correctW = 0; let correctP = 0;

    for (const f of files) {
      const w = await predictFile(f, { mode: 'whole' });
      const p = await predictFile(f, { mode: 'patch' });
      sumW += w.diem; sumP += p.diem;
      if (w.phanLoai === cls) correctW += 1;
      if (p.phanLoai === cls) correctP += 1;

      const name = path.basename(f).slice(0, 28);
      const wTxt = `${w.diem} ${LABEL_DISPLAY[w.phanLoai]}`;
      const pTxt = `${p.diem} ${LABEL_DISPLAY[p.phanLoai]}`;
      const mark = p.phanLoai === cls ? '✓' : ' ';
      console.log('  ' + name.padEnd(30) + wTxt.padEnd(22) + pTxt + ' ' + mark);
    }

    const n = files.length;
    summary[cls] = {
      avgWhole: sumW / n,
      avgPatch: sumP / n,
      accWhole: correctW / n,
      accPatch: correctP / n
    };
    console.log('  ' + '-'.repeat(74));
    console.log('  ' + `TB điểm`.padEnd(30)
      + `${(sumW / n).toFixed(1)}`.padEnd(22)
      + `${(sumP / n).toFixed(1)}`);
    console.log('  ' + `Đúng nhãn`.padEnd(30)
      + `${correctW}/${n}`.padEnd(22)
      + `${correctP}/${n}`);
    console.log('');
  }

  console.log('='.repeat(78));
  console.log('  TỔNG KẾT');
  console.log('='.repeat(78));
  console.log('  ' + 'Lớp'.padEnd(14) + 'TB whole'.padEnd(12) + 'TB patch'.padEnd(12)
    + 'Δ điểm'.padEnd(12) + 'Acc whole → patch');
  console.log('  ' + '-'.repeat(74));
  for (const cls of classes) {
    const s = summary[cls];
    if (!s) continue;
    const delta = s.avgPatch - s.avgWhole;
    console.log('  ' + LABEL_DISPLAY[cls].padEnd(14)
      + s.avgWhole.toFixed(1).padEnd(12)
      + s.avgPatch.toFixed(1).padEnd(12)
      + (delta >= 0 ? '+' : '') + delta.toFixed(1).padEnd(11)
      + `${(s.accWhole * 100).toFixed(0)}% → ${(s.accPatch * 100).toFixed(0)}%`);
  }
  console.log('='.repeat(78));

  // Ghi thêm kết quả ra JSON để đọc lại khi console lỗi encoding tiếng Việt
  const outPath = path.join(__dirname, '..', 'compare-result.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`  (kết quả JSON: ${outPath})`);
}

main().catch(err => {
  console.error('LỖI:', err.message);
  console.error(err.stack);
  process.exit(1);
});
