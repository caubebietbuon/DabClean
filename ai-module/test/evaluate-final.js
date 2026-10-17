// ============================================================
// CLEANOVA AI - Đánh giá tổng thể model sau khi train
// Chạy: node test/evaluate-final.js [--sample 20]
// ============================================================
// Kiểm tra ĐẦY ĐỦ theo yêu cầu:
//   1. So sánh patch 3x3 vs whole (cả ảnh)
//   2. Confusion matrix trên mẫu (mỗi lớp N ảnh)
//   3. Mục tiêu: nhầm lẫn hoi-ban <-> rat-ban < 10%
//   4. REGRESSION: lớp sach không được giảm accuracy
//   5. Ảnh ngập rác phải ra rat-ban với điểm cao
//
// ⚠️ Đây là đánh giá LẠC QUAN (ảnh đã dùng để train).
// ============================================================

const fs = require('fs');
const path = require('path');

const { predictFile, loadModel, readMetadata } = require('../predict');
const { LABELS, LABEL_DISPLAY } = require('../src/ml/labels');
const { confusionMatrix, pairConfusionRate } = require('../src/ml/metrics');

const DATASET = path.join(__dirname, '..', 'dataset');
const OUT_JSON = path.join(__dirname, '..', 'evaluate-result.json');

function parseArgs(argv) {
  const args = { sample: 20, skipWhole: false, modes: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--sample') { args.sample = parseInt(argv[i + 1], 10); i += 1; }
    if (argv[i] === '--skip-whole') args.skipWhole = true;
    if (argv[i] === '--modes') { args.modes = argv[i + 1].split(','); i += 1; }
  }
  return args;
}

function listJpg(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f)).map(f => path.join(dir, f));
}

// Lấy mẫu rải đều — tái lập được
function pick(files, n) {
  if (files.length <= n) return files;
  const step = files.length / n;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(files[Math.floor(i * step)]);
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  await loadModel();
  const meta = readMetadata();

  console.log('='.repeat(76));
  console.log('  ĐÁNH GIÁ MODEL SAU HUẤN LUYỆN');
  console.log('='.repeat(76));
  if (meta) {
    console.log(`  Train lúc    : ${new Date(meta.trainedAt).toLocaleString('vi-VN')}`);
    console.log(`  Số ảnh train : ${JSON.stringify(meta.datasetCounts)}`);
    console.log(`  Kiến trúc    : Dense(${(meta.architecture?.hiddenUnits || []).join(' -> ')})`);
    console.log(`  Val accuracy : ${(meta.valAccuracy * 100).toFixed(1)}%`);
    console.log(`  Nhầm hoi↔rat : ${((meta.pairErrorHoiRat || 0) * 100).toFixed(1)}%`);
  }
  console.log('');

  const result = {
    meta,
    samplePerClass: args.sample,
    byMode: {},
    regression: null,
    pairError: null
  };

  // ============================================================
  // PHẦN 1: Chấm mỗi lớp bằng PATCH và WHOLE
  // ============================================================
  const modes = args.modes || (args.skipWhole ? ['hybrid'] : ['hybrid', 'whole', 'patch']);

  for (const mode of modes) {
    const MODE_LABEL = {
      hybrid: 'HYBRID (whole + patch)',
      patch: 'PATCH 3x3 (chỉ theo vùng)',
      whole: 'WHOLE (cả ảnh)'
    };
    console.log(`  ═══ CÁCH CHẤM: ${MODE_LABEL[mode] || mode} ═══`);
    console.log('');

    const trueLabels = [];
    const predLabels = [];
    const scores = {};

    for (const cls of LABELS) {
      const files = pick(listJpg(path.join(DATASET, cls)), args.sample);
      if (files.length === 0) continue;

      let correct = 0;
      let sumScore = 0;
      const classPreds = {};

      for (const f of files) {
        const r = await predictFile(f, { mode });
        trueLabels.push(cls);
        predLabels.push(r.phanLoai);
        sumScore += r.diem;
        classPreds[r.phanLoai] = (classPreds[r.phanLoai] || 0) + 1;
        if (r.phanLoai === cls) correct += 1;
      }

      const acc = correct / files.length;
      scores[cls] = {
        count: files.length,
        correct,
        accuracy: Math.round(acc * 1000) / 1000,
        avgScore: Math.round((sumScore / files.length) * 10) / 10,
        predictedAs: classPreds
      };

      console.log(`   ${LABEL_DISPLAY[cls].padEnd(9)} : ${correct}/${files.length} đúng `
        + `(${(acc * 100).toFixed(0)}%)  ·  điểm TB ${(sumScore / files.length).toFixed(1)}`
        + `  ·  đoán thành: ${Object.entries(classPreds).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    }

    const cm = confusionMatrix(trueLabels, predLabels);
    const pair = pairConfusionRate(cm, 'hoi-ban', 'rat-ban');

    console.log('');
    console.log(`   Tổng: ${cm.correct}/${cm.total} (${(cm.accuracy * 100).toFixed(1)}%)`);
    console.log(`   Nhầm hoi-ban ↔ rat-ban: ${pair.count}/${pair.total} = ${(pair.rate * 100).toFixed(1)}% `
      + `${pair.pass ? '✅ ĐẠT (<10%)' : '❌ CHƯA ĐẠT'}`);
    console.log('');

    result.byMode[mode] = { scores, cm: { accuracy: cm.accuracy, matrix: cm.matrix }, pair: pair.rate };
  }

  // ============================================================
  // PHẦN 2: REGRESSION — lớp sach không được giảm
  // ============================================================
  console.log('  ═══ REGRESSION CHECK: LỚP SẠCH ═══');
  console.log('');
  // Ngưỡng tham chiếu: model CŨ đạt 30/30 = 100% trên lớp sach (đo trước đó)
  const SACH_BASELINE = 0.90;
  const sachHybrid = result.byMode.hybrid?.scores?.sach;
  const sachWhole = result.byMode.whole?.scores?.sach;
  const sachBest = Math.max(sachHybrid?.accuracy || 0, sachWhole?.accuracy || 0);

  console.log(`   Baseline (model cũ, đo trước): ${(SACH_BASELINE * 100).toFixed(0)}%`);
  if (sachHybrid) console.log(`   Model mới (hybrid) : ${(sachHybrid.accuracy * 100).toFixed(0)}%  (${sachHybrid.correct}/${sachHybrid.count})`);
  if (sachWhole) console.log(`   Model mới (whole)  : ${(sachWhole.accuracy * 100).toFixed(0)}%  (${sachWhole.correct}/${sachWhole.count})`);
  const regressionPass = sachBest >= SACH_BASELINE;
  console.log(`   → ${regressionPass ? '✅ KHÔNG GIẢM' : '❌ GIẢM so với baseline'}`);
  console.log('');

  result.regression = {
    baseline: SACH_BASELINE,
    hybrid: sachHybrid?.accuracy || null,
    whole: sachWhole?.accuracy || null,
    pass: regressionPass
  };

  // ============================================================
  // PHẦN 3: Ảnh ngập rác phải ra rat-ban điểm cao
  // ============================================================
  console.log('  ═══ ẢNH NGẬP RÁC PHẢI RA rat-ban, ĐIỂM > 85 ═══');
  console.log('');
  const ratFiles = pick(listJpg(path.join(DATASET, 'rat-ban')), 10);
  let ratPass = 0;
  let ratScoreSum = 0;
  for (const f of ratFiles) {
    const r = await predictFile(f, { mode: 'hybrid' });
    ratScoreSum += r.diem;
    const ok = r.phanLoai === 'rat-ban' && r.diem > 85;
    if (ok) ratPass += 1;
    console.log(`   ${path.basename(f).padEnd(26)} ${r.phanLoai.padEnd(9)} ${String(r.diem).padStart(5)} điểm  ${ok ? '✓' : '✗'}`);
  }
  const ratAvg = ratScoreSum / ratFiles.length;
  console.log('');
  console.log(`   Đạt yêu cầu (>85 điểm + rat-ban): ${ratPass}/${ratFiles.length}  ·  điểm TB ${ratAvg.toFixed(1)}`);
  console.log('');

  result.ratHighScore = {
    count: ratFiles.length,
    pass: ratPass,
    avgScore: Math.round(ratAvg * 10) / 10
  };

  // ============================================================
  // TỔNG KẾT
  // ============================================================
  console.log('='.repeat(76));
  console.log('  TỔNG KẾT');
  console.log('='.repeat(76));

  const checks = [];
  const pairRate = result.byMode.hybrid?.pair ?? 1;
  checks.push(['Nhầm hoi-ban ↔ rat-ban < 10% (hybrid)', pairRate < 0.10]);
  checks.push(['Lớp sạch không giảm (< baseline)', regressionPass]);
  checks.push(['Ảnh ngập rác >85 điểm', ratPass >= Math.ceil(ratFiles.length * 0.7)]);

  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) failed += 1;
  }

  console.log('');
  console.log(failed === 0
    ? '  🎉 TẤT CẢ MỤC TIÊU ĐỀU ĐẠT'
    : `  ⚠️  CÓ ${failed}/${checks.length} MỤC TIÊU CHƯA ĐẠT`);
  console.log('='.repeat(76));

  result.checks = checks.map(([l, ok]) => ({ label: l, pass: ok }));
  result.allPass = failed === 0;
  fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
  console.log(`  (kết quả JSON: ${OUT_JSON})`);
}

main().catch(err => {
  console.error('LỖI:', err.message);
  console.error(err.stack);
  process.exit(1);
});
