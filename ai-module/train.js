// ============================================================
// DABCLEAN AI MODULE - TRAIN.JS (Transfer Learning)
// ============================================================
// Huấn luyện model phân loại độ bẩn bằng TRANSFER LEARNING.
//
// CÁCH CHẠY:
//   node train.js
//   node train.js --epochs 60 --batch 16
//   node train.js --dataset ./dataset --out ./model-do-ban2
//
// YÊU CẦU DATASET:
//   dataset/
//     sach/      (ảnh phòng sạch)
//     hoi-ban/   (ảnh phòng hơi bẩn)
//     rat-ban/   (ảnh phòng rất bẩn)
//
// KẾT QUẢ: lưu model vào thư mục model-do-ban2/ gồm model.json + weights.bin
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');

const { loadBackbone } = require('./src/ml/backbone');
const { buildHeadModel } = require('./src/ml/modelFactory');
const {
  scanDataset,
  validateDataset,
  buildEmbeddingDataset
} = require('./src/ml/dataset');
const { LABELS } = require('./src/ml/labels');
const { createFsIOHandler } = require('./src/ml/fsIOHandler');
const {
  confusionMatrix,
  formatConfusionMatrix,
  pairConfusionRate,
  makeEarlyStopping
} = require('./src/ml/metrics');

// ------------------------------------------------------------
// Đọc tham số dòng lệnh
// ------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    dataset: path.join(__dirname, 'dataset'),
    out: path.join(__dirname, 'model-do-ban2'),
    epochs: 30,
    batch: 16,
    validationSplit: 0.2,
    hiddenUnits: [256, 128],
    dropouts: [0.5, 0.3],
    learningRate: 0.001,
    augment: 2,          // số biến thể thêm mỗi ảnh (0 = tắt)
    ratWeight: 1.5,      // class weight cho rat-ban
    patience: 7,         // early stopping: chờ bao nhiêu epoch
    seed: 20261017
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    switch (key) {
      case '--dataset': args.dataset = path.resolve(val); i += 1; break;
      case '--out': args.out = path.resolve(val); i += 1; break;
      case '--epochs': args.epochs = parseInt(val, 10); i += 1; break;
      case '--batch': args.batch = parseInt(val, 10); i += 1; break;
      case '--split': args.validationSplit = parseFloat(val); i += 1; break;
      case '--units': args.hiddenUnits = val.split(',').map(s => parseInt(s, 10)); i += 1; break;
      case '--dropout': args.dropouts = val.split(',').map(s => parseFloat(s)); i += 1; break;
      case '--lr': args.learningRate = parseFloat(val); i += 1; break;
      case '--augment': args.augment = parseInt(val, 10); i += 1; break;
      case '--rat-weight': args.ratWeight = parseFloat(val); i += 1; break;
      case '--patience': args.patience = parseInt(val, 10); i += 1; break;
      default: break;
    }
  }
  return args;
}

function line(char = '=') {
  console.log(char.repeat(58));
}

// ------------------------------------------------------------
// Chia train/validation theo NHÓM (chống rò rỉ dữ liệu)
// ------------------------------------------------------------
// MỖI ẢNH GỐC = MỘT NHÓM. Tất cả bản sao augmentation của một ảnh gốc phải
// nằm cùng một phía (train hoặc validation). Nếu không, model đã "thấy" ảnh
// đó lúc train nên val_acc sẽ cao giả tạo.
//
// Đầu vào cần: nhãn từng mẫu + id nhóm từng mẫu.
//
// Ngoài ra vẫn PHÂN TẦNG theo lớp: mỗi lớp đóng góp đúng ~20% nhóm vào val,
// để validation có đủ cả 3 lớp (nếu chia ngẫu nhiên thuần, có thể thiếu lớp).
function groupStratifiedSplit(allLabels, groupIds, splitRatio, seed) {
  const rng = makeRng(seed);

  // Gom nhóm theo (lớp, groupId)
  const groupsByClass = {};
  for (let i = 0; i < allLabels.length; i += 1) {
    const cls = allLabels[i];
    const gid = groupIds[i];
    if (!groupsByClass[cls]) groupsByClass[cls] = new Map();
    const m = groupsByClass[cls];
    if (!m.has(gid)) m.set(gid, []);
    m.get(gid).push(i);
  }

  const trainIdx = [];
  const valIdx = [];

  for (const cls of Object.keys(groupsByClass)) {
    const entries = Array.from(groupsByClass[cls].values()); // mảng các nhóm

    // Fisher-Yates với seed cố định
    for (let i = entries.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }

    const nValGroups = Math.max(1, Math.round(entries.length * splitRatio));
    entries.forEach((idxs, k) => {
      if (k < nValGroups) valIdx.push(...idxs);
      else trainIdx.push(...idxs);
    });
  }

  return { trainIdx, valIdx };
}

/**
 * Xây danh sách id nhóm cho từng mẫu.
 *
 * Thứ tự trong `xs` là: [tất cả ảnh gốc của items...] rồi
 * [biến thể của item 0..., biến thể của item 1...].
 * Nên: mẫu thứ i < nItems thuộc nhóm i.
 * Mẫu augmentation thứ k thuộc nhóm floor(k / augmentPerImage).
 *
 * @param {Array} items - danh sách ảnh gốc
 * @param {number} augmentPerImage
 * @param {number} totalSamples - xs.shape[0]
 * @returns {number[]} groupIds (song song với xs)
 */
function buildGroupIds(items, augmentPerImage, totalSamples) {
  const groupIds = [];
  const nItems = items.length;

  // Phần 1: ảnh gốc — mỗi ảnh một nhóm
  for (let i = 0; i < nItems && groupIds.length < totalSamples; i += 1) {
    groupIds.push(i);
  }

  // Phần 2: biến thể augmentation — cùng nhóm với ảnh gốc
  if (augmentPerImage > 0) {
    let itemIdx = 0;
    let countInGroup = 0;
    while (groupIds.length < totalSamples) {
      groupIds.push(itemIdx);
      countInGroup += 1;
      if (countInGroup >= augmentPerImage) {
        itemIdx += 1;
        countInGroup = 0;
      }
      // Nếu số biến thể thực tế ít hơn kế hoạch (ảnh lỗi bị bỏ), vòng lặp
      // vẫn an toàn: itemIdx không vượt nItems vì tổng mẫu đã bị chặn.
      if (itemIdx >= nItems) itemIdx = nItems - 1;
    }
  }

  return groupIds;
}

// Bộ sinh số ngẫu nhiên có seed (dùng chung thuật toán với augment.js)
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Lấy tensor con theo danh sách index.
 */
function gatherRows(tensor, idxs) {
  return tf.tidy(() => tf.gather(tensor, idxs));
}

/**
 * Tính class weight cho tfjs.
 *
 * tfjs nhận classWeight dạng { indexLớp: weight }. Ta tăng trọng số lớp
 * rat-ban để model bị "phạt" nặng hơn khi đoán nhầm lớp này — đúng yêu cầu,
 * vì lỗi người dùng gặp là rat-ban bị đoán thành hoi-ban.
 *
 * @param {object} counts - { sach: n, 'hoi-ban': n, 'rat-ban': n }
 * @param {number} ratBoost - hệ số nhân thêm cho rat-ban (mặc định 1.5)
 * @returns {{classWeight: object, detail: object}}
 */
function buildClassWeight(counts, ratBoost) {
  const total = LABELS.reduce((s, l) => s + (counts[l] || 0), 0);
  const nClass = LABELS.length;

  const detail = {};
  const classWeight = {};

  LABELS.forEach((label, idx) => {
    const n = counts[label] || 1;
    // Công thức cân bằng chuẩn: total / (nClass * n)
    let w = total / (nClass * n);
    if (label === 'rat-ban') w *= ratBoost;
    classWeight[idx] = w;
    detail[label] = Math.round(w * 1000) / 1000;
  });

  return { classWeight, detail };
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  line();
  console.log('  DABCLEAN AI - HUẤN LUYỆN MODEL ĐỘ BẨN (TRANSFER LEARNING)');
  line();
  console.log(`  Dataset  : ${args.dataset}`);
  console.log(`  Output   : ${args.out}`);
  console.log(`  Epochs   : ${args.epochs}  Batch: ${args.batch}  Split: ${args.validationSplit}`);
  console.log(`  Head     : Dense(${args.hiddenUnits.join(' -> ')}, relu) với Dropout(${args.dropouts.join(', ')}) -> Dense(3, softmax)`);
  console.log(`  Augment  : ${args.augment} biến thể/ảnh${args.augment === 0 ? ' (TẮT)' : ''}`);
  console.log(`  Class w  : rat-ban x${args.ratWeight}`);
  console.log(`  Early stop: patience ${args.patience} epoch theo val_loss`);
  line();

  // --- Bước 0: kiểm tra dataset ---
  const check = validateDataset(args.dataset);
  check.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  if (!check.ok) {
    console.error('\n❌ Dataset chưa hợp lệ:');
    check.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  const { items, counts, total } = scanDataset(args.dataset);
  console.log('  Số ảnh mỗi lớp:');
  LABELS.forEach(l => console.log(`   - ${l.padEnd(9)} : ${counts[l]} ảnh`));
  console.log(`  Tổng cộng: ${total} ảnh`);
  line();

  // --- Bước 1: nạp MobileNet ---
  console.log('⏳ Đang nạp MobileNet (pretrained trên ImageNet)...');
  await tf.ready();
  console.log(`   Backend: ${tf.getBackend()}`);
  await loadBackbone();
  console.log('✅ MobileNet đã sẵn sàng (ĐÓNG BĂNG hoàn toàn).');
  line();

  // --- Bước 2: trích đặc trưng (+ augmentation) ---
  console.log('⏳ Đang trích đặc trưng 1024 chiều...');
  const t0 = Date.now();
  const { xs, ys, augmentInfo } = await buildEmbeddingDataset(items, {
    batchSize: args.batch,
    augmentPerImage: args.augment,
    onStage: (s) => console.log(`   » ${s}`),
    onProgress: (done, all) => {
      const pct = Math.round((done / all) * 100);
      process.stdout.write(`\r     Tiến độ: ${done}/${all} (${pct}%)   `);
    }
  });
  console.log(`\n✅ Xong trong ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   Ảnh gốc: ${augmentInfo.original}   Biến thể: ${augmentInfo.augmented}   Tổng mẫu: ${xs.shape[0]}`);
  console.log(`   xs shape: ${JSON.stringify(xs.shape)}   ys shape: ${JSON.stringify(ys.shape)}`);
  line();

  // --- Bước 3: chia train/validation theo NHÓM ẢNH GỐC ---
  console.log('⏳ Đang chia train/validation (theo nhóm ảnh gốc)...');

  // Suy nhãn & ID nhóm ảnh gốc cho MỌI mẫu (kể cả mẫu augmentation).
  const ysArr = await ys.array();
  const allLabels = ysArr.map(row => LABELS[row.indexOf(Math.max(...row))]);

  // ⚠️ RÒ RỈ DỮ LIỆU (data leakage) — vấn đề nghiêm trọng cần tránh:
  // Mỗi ảnh gốc sinh ra N biến thể augmentation. Nếu ta chia ngẫu nhiên THEO
  // TỪNG MẪU, biến thể của cùng một ảnh có thể rơi vào cả train LẪN validation.
  // Khi đó model "đã thấy" ảnh đó lúc train -> val_acc cao GIẢ TẠO, không phản
  // ánh đúng hiệu năng thật.
  //
  // Nên ta chia theo NHÓM: tất cả biến thể của cùng 1 ảnh gốc phải nằm CÙNG
  // một phía (train hoặc validation). Mỗi ảnh gốc = 1 nhóm.
  const groupIds = buildGroupIds(items, args.augment, allLabels.length);

  const { trainIdx, valIdx } = groupStratifiedSplit(
    allLabels, groupIds, args.validationSplit, args.seed
  );
  const xTrain = gatherRows(xs, trainIdx);
  const yTrain = gatherRows(ys, trainIdx);
  const xVal = gatherRows(xs, valIdx);
  const yVal = gatherRows(ys, valIdx);

  // Đếm phân bố để xác nhận phân tầng đúng
  const trainCount = {}; const valCount = {};
  trainIdx.forEach(i => { trainCount[allLabels[i]] = (trainCount[allLabels[i]] || 0) + 1; });
  valIdx.forEach(i => { valCount[allLabels[i]] = (valCount[allLabels[i]] || 0) + 1; });
  console.log('   Train: ' + LABELS.map(l => `${l}=${trainCount[l] || 0}`).join('  '));
  console.log('   Val  : ' + LABELS.map(l => `${l}=${valCount[l] || 0}`).join('  '));
  line();

  // --- Bước 4: tạo model & class weight ---
  const model = buildHeadModel({
    hiddenUnits: args.hiddenUnits,
    dropouts: args.dropouts,
    learningRate: args.learningRate
  });
  model.summary();

  const { classWeight, detail } = buildClassWeight(trainCount, args.ratWeight);
  console.log(`  Class weight: ${JSON.stringify(detail)}`);
  line();

  // --- Bước 5: huấn luyện với early stopping ---
  const es = makeEarlyStopping({ patience: args.patience, minDelta: 0.001 });
  console.log(`⏳ Huấn luyện (tối đa ${args.epochs} epoch, dừng sớm sau ${args.patience} epoch không cải thiện)...`);

  let bestSoFar = Infinity;
  await model.fit(xTrain, yTrain, {
    epochs: args.epochs,
    batchSize: args.batch,
    shuffle: true,
    verbose: 0,
    classWeight,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        const acc = logs.acc !== undefined ? logs.acc : logs.accuracy;
        const valAcc = logs.val_acc !== undefined ? logs.val_acc : logs.val_accuracy;
        const r = await es.onEpochEnd(epoch, logs, model);
        const mark = r.improved ? ' ★' : '';
        console.log(
          `   epoch ${String(epoch + 1).padStart(3)}/${args.epochs}`
          + `  loss=${(logs.loss || 0).toFixed(4)}`
          + `  acc=${((acc || 0) * 100).toFixed(1)}%`
          + `  val_loss=${(logs.val_loss || 0).toFixed(4)}`
          + `  val_acc=${((valAcc || 0) * 100).toFixed(1)}%`
          + `${mark}`
          + (es.state.stopped ? '   ⛔ dừng sớm' : '')
        );
      }
    }
  });

  // Khôi phục trọng số TỐT NHẤT (không phải epoch cuối)
  es.restoreBest(model);
  console.log(`\n✅ Huấn luyện xong. Epoch tốt nhất: ${es.state.bestEpoch + 1} (val_loss=${es.state.bestValLoss.toFixed(4)})`);
  if (es.state.stopped) console.log(`   (dừng sớm do val_loss không cải thiện sau ${args.patience} epoch)`);
  line();

  // --- Bước 6: đánh giá trên tập VALIDATION -> confusion matrix ---
  console.log('⏳ Đang đánh giá trên tập validation...');
  const valPredTensor = model.predict(xVal);
  const valPredArr = await valPredTensor.array();
  valPredTensor.dispose();

  const yValArr = await yVal.array();
  const trueLabels = yValArr.map(row => LABELS[row.indexOf(Math.max(...row))]);
  const predLabels = valPredArr.map(row => LABELS[row.indexOf(Math.max(...row))]);

  const cm = confusionMatrix(trueLabels, predLabels);
  console.log('');
  console.log(formatConfusionMatrix(cm));
  line();

  // Kiểm tra mục tiêu: nhầm lẫn hoi-ban <-> rat-ban < 10%
  const pair = pairConfusionRate(cm, 'hoi-ban', 'rat-ban');
  console.log(`  Mục tiêu nhầm lẫn hoi-ban ↔ rat-ban < 10%:`);
  console.log(`   - Thực tế: ${pair.count}/${pair.total} = ${(pair.rate * 100).toFixed(1)}%  ${pair.pass ? '✅ ĐẠT' : '❌ CHƯA ĐẠT'}`);
  line();

  // --- Bước 7: lưu model ---
  console.log(`⏳ Đang lưu model vào "${args.out}"...`);
  if (!fs.existsSync(args.out)) fs.mkdirSync(args.out, { recursive: true });
  await model.save(createFsIOHandler(args.out));

  const valAccFinal = cm.accuracy;
  fs.writeFileSync(
    path.join(args.out, 'metadata.json'),
    JSON.stringify({
      labels: LABELS,
      embeddingDim: 1024,
      backbone: 'mobilenet-v1-1.0',
      imageSize: 224,
      architecture: {
        hiddenUnits: args.hiddenUnits,
        dropouts: args.dropouts,
        params: model.countParams()
      },
      training: {
        epochs: args.epochs,
        epochsRun: es.state.history.length,
        bestEpoch: es.state.bestEpoch + 1,
        batch: args.batch,
        augmentPerImage: args.augment,
        classWeightRatBan: args.ratWeight,
        classWeightDetail: detail,
        earlyStopped: es.state.stopped
      },
      trainedAt: new Date().toISOString(),
      datasetCounts: counts,
      samplesTotal: xs.shape[0],
      valAccuracy: valAccFinal,
      confusionMatrix: cm.matrix,
      pairErrorHoiRat: pair.rate
    }, null, 2)
  );

  const files = fs.readdirSync(args.out);
  console.log('✅ Đã lưu:');
  files.forEach(f => {
    const size = fs.statSync(path.join(args.out, f)).size;
    console.log(`   - ${f}  (${(size / 1024).toFixed(1)} KB)`);
  });
  line();
  console.log('👉 Chạy thử:');
  console.log('   node predict.js duong-dan-anh.jpg        (chấm theo patch 3x3)');
  console.log('   node predict.js --whole anh.jpg          (chấm cả ảnh)');
  line();

  // Dọn tài nguyên
  es.dispose();
  xs.dispose(); ys.dispose();
  xTrain.dispose(); yTrain.dispose();
  xVal.dispose(); yVal.dispose();
  model.dispose();
}

main().catch(err => {
  console.error('\n❌ LỖI KHI HUẤN LUYỆN:', err.message);
  console.error(err.stack);
  process.exit(1);
});
