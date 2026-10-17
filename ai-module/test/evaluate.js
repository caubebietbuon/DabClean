// ============================================================
// DABCLEAN AI MODULE - Đánh giá chất lượng model đã train
// Chạy: node test/evaluate.js [--dataset "D:\folder anh\dataset"] [--sample 30]
// ============================================================
// Script này lấy mẫu N ảnh ngẫu nhiên từ MỖI lớp trong dataset, chạy dự đoán
// và thống kê:
//   - Độ chính xác tổng
//   - Ma trận nhầm lẫn (ảnh lớp nào bị đoán sai thành lớp nào)
//   - Điểm trung bình từng lớp (phải xấp xỉ 10 / 50 / 90)
//
// ⚠️ LƯU Ý VỀ TÍNH KHÁCH QUAN:
// Các ảnh trong dataset đã được dùng để TRAIN model (80%) hoặc VALIDATE (20%).
// Nên độ chính xác đo trên đây là ĐÁNH GIÁ LẠC QUAN — nó KHÔNG phản ánh đúng
// hiệu năng khi gặp ảnh hoàn toàn mới. Muốn đánh giá khách quan phải có bộ ảnh
// test RIÊNG chưa từng đưa vào train.
// ============================================================

const fs = require('fs');
const path = require('path');

const { predictFile, readMetadata, loadModel } = require('../predict');
const { LABELS, LABEL_DISPLAY, probsToLabel } = require('../src/ml/labels');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];

function parseArgs(argv) {
  const args = {
    dataset: 'd:\\folder anh\\dataset',
    sample: 30
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dataset') { args.dataset = argv[i + 1]; i += 1; }
    else if (argv[i] === '--sample') { args.sample = parseInt(argv[i + 1], 10); i += 1; }
  }
  return args;
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f));
}

// Chọn mẫu rải đều (không ngẫu nhiên kiểu Math.random để kết quả tái lập được)
function pickSpread(files, n) {
  if (files.length <= n) return files;
  const step = files.length / n;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(files[Math.floor(i * step)]);
  return out;
}

function line(c = '=') { console.log(c.repeat(62)); }

async function main() {
  const args = parseArgs(process.argv);

  line();
  console.log('  ĐÁNH GIÁ CHẤT LƯỢNG MODEL - DABCLEAN AI');
  line();
  console.log(`  Dataset : ${args.dataset}`);
  console.log(`  Mẫu/lớp : ${args.sample}`);
  line();

  // --- Thông tin model ---
  const meta = readMetadata();
  if (!meta) {
    console.error('❌ Chưa có model. Chạy "node train.js" trước.');
    process.exit(1);
  }
  console.log('  Model đang đánh giá:');
  console.log(`   - Backbone    : ${meta.backbone}`);
  console.log(`   - Train lúc   : ${new Date(meta.trainedAt).toLocaleString('vi-VN')}`);
  console.log(`   - Số ảnh train: ${JSON.stringify(meta.datasetCounts)}`);
  console.log(`   - Val accuracy: ${(meta.finalValAccuracy * 100).toFixed(1)}%`);
  line();

  // Nạp model 1 lần duy nhất (tránh nạp lại mỗi ảnh — rất chậm)
  await loadModel();

  // --- Ma trận nhầm lẫn ---
  const confusion = {};
  for (const a of LABELS) {
    confusion[a] = {};
    for (const b of LABELS) confusion[a][b] = 0;
  }
  const scoreSum = {};
  const scoreCount = {};
  LABELS.forEach(l => { scoreSum[l] = 0; scoreCount[l] = 0; });

  let correct = 0;
  let total = 0;
  const mistakes = [];

  for (const truth of LABELS) {
    const files = pickSpread(listImages(path.join(args.dataset, truth)), args.sample);
    if (files.length === 0) {
      console.log(`  ⚠️  Lớp "${truth}" không có ảnh, bỏ qua.`);
      continue;
    }

    let classCorrect = 0;
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const r = await predictFile(file);
      const pred = r.phanLoai;

      confusion[truth][pred] += 1;
      scoreSum[truth] += r.diem;
      scoreCount[truth] += 1;
      total += 1;

      if (pred === truth) { correct += 1; classCorrect += 1; }
      else {
        mistakes.push({
          file: path.basename(file),
          truth,
          pred,
          diem: r.diem,
          conf: r.doTinCay
        });
      }

      process.stdout.write(`\r   ${LABEL_DISPLAY[truth].padEnd(9)} ${i + 1}/${files.length}   `);
    }
    const pct = ((classCorrect / files.length) * 100).toFixed(1);
    console.log(`\r   ${LABEL_DISPLAY[truth].padEnd(9)} : ${classCorrect}/${files.length} đúng  (${pct}%)        `);
  }

  line();
  console.log('  KẾT QUẢ TỔNG HỢP');
  line();
  const acc = total ? (correct / total) * 100 : 0;
  console.log(`  Độ chính xác : ${correct}/${total}  (${acc.toFixed(1)}%)`);
  console.log('');
  console.log('  Điểm trung bình mỗi lớp (kỳ vọng: Sạch ~10, Hơi bẩn ~50, Rất bẩn ~90):');
  for (const l of LABELS) {
    if (scoreCount[l] === 0) continue;
    const avg = scoreSum[l] / scoreCount[l];
    console.log(`   - ${LABEL_DISPLAY[l].padEnd(9)} : ${avg.toFixed(1)} điểm`);
  }
  line();

  // --- Ma trận nhầm lẫn ---
  console.log('  MA TRẬN NHẦM LẪN (hàng = nhãn thật, cột = model đoán)');
  console.log('');
  const header = '  ' + 'Thật \\ Đoán'.padEnd(12) + LABELS.map(l => LABEL_DISPLAY[l].padStart(11)).join('');
  console.log(header);
  for (const a of LABELS) {
    let row = '  ' + LABEL_DISPLAY[a].padEnd(12);
    for (const b of LABELS) {
      const v = confusion[a][b];
      const mark = a === b ? '✓' : ' ';
      row += `${String(v).padStart(9)}${mark} `;
    }
    console.log(row);
  }
  line();

  // --- Liệt kê lỗi ---
  if (mistakes.length) {
    console.log(`  CÁC ẢNH ĐOÁN SAI (${mistakes.length}):`);
    for (const m of mistakes.slice(0, 15)) {
      const conf = Object.entries(m.conf)
        .map(([k, v]) => `${k}=${(v * 100).toFixed(1)}%`)
        .join(' ');
      console.log(`   - ${m.file}`);
      console.log(`       thật: ${m.truth}  |  đoán: ${m.pred} (${m.diem} điểm)`);
      console.log(`       ${conf}`);
    }
    if (mistakes.length > 15) console.log(`   ... và ${mistakes.length - 15} ảnh khác`);
  } else {
    console.log('  🎉 Không có ảnh nào đoán sai trong mẫu này!');
  }
  line();
  console.log('  ⚠️  Đây là đánh giá LẠC QUAN: ảnh trong dataset đã dùng để train.');
  console.log('     Muốn đánh giá khách quan cần bộ ảnh test RIÊNG chưa từng train.');
  line();
}

main().catch(err => {
  console.error('\n❌ LỖI:', err.message);
  console.error(err.stack);
  process.exit(1);
});
