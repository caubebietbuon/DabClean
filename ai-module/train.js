// ============================================================
// CLEANOVA AI MODULE - TRAIN.JS (Transfer Learning)
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

// ------------------------------------------------------------
// Đọc tham số dòng lệnh
// ------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    dataset: path.join(__dirname, 'dataset'),
    out: path.join(__dirname, 'model-do-ban2'),
    epochs: 40,
    batch: 16,
    validationSplit: 0.2,
    hiddenUnits: 64,
    dropout: 0.3,
    learningRate: 0.001
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
      case '--units': args.hiddenUnits = parseInt(val, 10); i += 1; break;
      case '--dropout': args.dropout = parseFloat(val); i += 1; break;
      case '--lr': args.learningRate = parseFloat(val); i += 1; break;
      default: break;
    }
  }
  return args;
}

function line(char = '=') {
  console.log(char.repeat(58));
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  line();
  console.log('  CLEANOVA AI - HUẤN LUYỆN MODEL ĐỘ BẨN (TRANSFER LEARNING)');
  line();
  console.log(`  Dataset : ${args.dataset}`);
  console.log(`  Output  : ${args.out}`);
  console.log(`  Epochs  : ${args.epochs}   Batch: ${args.batch}   Split: ${args.validationSplit}`);
  console.log(`  Head    : Dense(${args.hiddenUnits}, relu) -> Dropout(${args.dropout}) -> Dense(3, softmax)`);
  line();

  // --- Bước 0: kiểm tra dataset ---
  const check = validateDataset(args.dataset);
  check.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  if (!check.ok) {
    console.error('\n❌ Dataset chưa hợp lệ:');
    check.errors.forEach(e => console.error(`   - ${e}`));
    console.error('\nHãy tạo cấu trúc:');
    console.error(`   ${args.dataset}${path.sep}sach\\       (ảnh phòng sạch)`);
    console.error(`   ${args.dataset}${path.sep}hoi-ban\\    (ảnh phòng hơi bẩn)`);
    console.error(`   ${args.dataset}${path.sep}rat-ban\\    (ảnh phòng rất bẩn)`);
    process.exit(1);
  }

  const { items, counts, total } = scanDataset(args.dataset);
  console.log('  Số ảnh mỗi lớp:');
  LABELS.forEach(l => console.log(`   - ${l.padEnd(9)} : ${counts[l]} ảnh`));
  console.log(`  Tổng cộng: ${total} ảnh`);
  line();

  // --- Bước 1: nạp MobileNet đã train sẵn (backbone) ---
  console.log('⏳ Đang nạp MobileNet (pretrained trên ImageNet)...');
  await tf.ready();
  console.log(`   Backend: ${tf.getBackend()}`);
  await loadBackbone();
  console.log('✅ MobileNet đã sẵn sàng (toàn bộ trọng số bị ĐÓNG BĂNG).');
  line();

  // --- Bước 2: trích đặc trưng (chạy MobileNet 1 lần cho mỗi ảnh) ---
  console.log('⏳ Đang trích đặc trưng 1024 chiều cho toàn bộ ảnh...');
  const t0 = Date.now();
  const { xs, ys } = await buildEmbeddingDataset(items, {
    batchSize: args.batch,
    onProgress: (done, all) => {
      const pct = Math.round((done / all) * 100);
      process.stdout.write(`\r   Tiến độ: ${done}/${all} (${pct}%)   `);
    }
  });
  console.log(`\n✅ Xong trong ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   xs shape: ${JSON.stringify(xs.shape)}   ys shape: ${JSON.stringify(ys.shape)}`);
  line();

  // --- Bước 3: tạo & huấn luyện "đầu" (2 lớp Dense của riêng ta) ---
  console.log('⏳ Đang huấn luyện 2 lớp Dense...');
  const model = buildHeadModel({
    hiddenUnits: args.hiddenUnits,
    dropout: args.dropout,
    learningRate: args.learningRate
  });
  model.summary();

  const history = await model.fit(xs, ys, {
    epochs: args.epochs,
    batchSize: args.batch,
    validationSplit: args.validationSplit,
    shuffle: true,
    verbose: 1,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const acc = (logs.acc !== undefined ? logs.acc : logs.accuracy) || 0;
        const valAcc = (logs.val_acc !== undefined ? logs.val_acc : logs.val_accuracy) || 0;
        const loss = logs.loss || 0;
        console.log(
          `   epoch ${String(epoch + 1).padStart(3)}/${args.epochs}` +
          `  loss=${loss.toFixed(4)}` +
          `  acc=${(acc * 100).toFixed(1)}%` +
          `  val_acc=${(valAcc * 100).toFixed(1)}%`
        );
      }
    }
  });

  const finalAcc = history.history.acc || history.history.accuracy || [];
  const finalVal = history.history.val_acc || history.history.val_accuracy || [];
  line();
  console.log('✅ Huấn luyện hoàn tất!');
  if (finalAcc.length) {
    console.log(`   Độ chính xác cuối (train)     : ${(finalAcc[finalAcc.length - 1] * 100).toFixed(1)}%`);
  }
  if (finalVal.length) {
    console.log(`   Độ chính xác cuối (validation): ${(finalVal[finalVal.length - 1] * 100).toFixed(1)}%`);
  }
  line();

  // --- Bước 4: lưu model ---
  console.log(`⏳ Đang lưu model vào "${args.out}"...`);
  if (!fs.existsSync(args.out)) fs.mkdirSync(args.out, { recursive: true });
  await model.save(createFsIOHandler(args.out));

  // Lưu kèm metadata để predict.js biết thứ tự nhãn & cấu hình
  fs.writeFileSync(
    path.join(args.out, 'metadata.json'),
    JSON.stringify({
      labels: LABELS,
      embeddingDim: 1024,
      backbone: 'mobilenet-v1-1.0',
      imageSize: 224,
      hiddenUnits: args.hiddenUnits,
      dropout: args.dropout,
      epochs: args.epochs,
      trainedAt: new Date().toISOString(),
      datasetCounts: counts,
      finalTrainAccuracy: finalAcc.length ? finalAcc[finalAcc.length - 1] : null,
      finalValAccuracy: finalVal.length ? finalVal[finalVal.length - 1] : null
    }, null, 2)
  );

  const files = fs.readdirSync(args.out);
  console.log('✅ Đã lưu:');
  files.forEach(f => {
    const size = fs.statSync(path.join(args.out, f)).size;
    console.log(`   - ${f}  (${(size / 1024).toFixed(1)} KB)`);
  });
  line();
  console.log('👉 Bây giờ chạy thử:');
  console.log('   node predict.js duong-dan-anh.jpg');
  console.log('   hoặc khởi động server: npm start  -> POST /api/ai/scan');
  line();

  xs.dispose();
  ys.dispose();
  model.dispose();
}

main().catch(err => {
  console.error('\n❌ LỖI KHI HUẤN LUYỆN:', err.message);
  console.error(err.stack);
  process.exit(1);
});
