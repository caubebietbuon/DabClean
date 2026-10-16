// ============================================================
// CLEANOVA AI MODULE - PREDICT.JS
// ============================================================
// Nạp model đã train (model-do-ban2/) và dự đoán độ bẩn của 1 ảnh.
//
// CÁCH DÙNG (CLI):
//   node predict.js duong-dan-anh.jpg
//   node predict.js anh1.jpg anh2.jpg        (nhiều ảnh)
//
// CÁCH DÙNG (từ code khác):
//   const { predictFile } = require('./predict');
//   const result = await predictFile('anh.jpg');
//
// OUTPUT (JSON):
//   {
//     "diem": 72.4,
//     "phanLoai": "rat-ban",
//     "doTinCay": { "sach": 0.02, "hoiBan": 0.11, "ratBan": 0.87 }
//   }
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');

const { loadBackbone } = require('./src/ml/backbone');
const { loadImageAsTensor, bufferToTensor, IMAGE_SIZE } = require('./src/ml/imageUtils');
const { createFsIOHandler } = require('./src/ml/fsIOHandler');
const {
  LABELS,
  LABEL_DISPLAY,
  probsToScore,
  probsToLabel,
  probsToConfidence
} = require('./src/ml/labels');

// Thư mục model mặc định
const DEFAULT_MODEL_DIR = path.join(__dirname, 'model-do-ban2');

let _model = null;
let _modelDir = null;

/**
 * Nạp model đã train (có cache).
 * @param {string} modelDir
 * @returns {Promise<tf.LayersModel>}
 */
async function loadModel(modelDir = DEFAULT_MODEL_DIR) {
  if (_model && _modelDir === modelDir) return _model;

  await tf.ready();
  _model = await tf.loadLayersModel(createFsIOHandler(modelDir));
  _modelDir = modelDir;
  return _model;
}

/**
 * Chạy dự đoán trên một tensor ảnh đã resize 224x224.
 * @param {tf.Tensor3D} imageTensor
 * @returns {Promise<number[]>} vector xác suất [sach, hoi-ban, rat-ban]
 */
async function predictTensor(imageTensor) {
  const model = await loadModel();
  const net = await loadBackbone();

  // MobileNet lấy embedding -> input cho 2 lớp Dense của ta
  const emb = net.infer(imageTensor, true);   // [1,1024]

  const probsTensor = model.predict(emb);      // [1,3]
  const probs = Array.from(await probsTensor.data());

  emb.dispose();
  probsTensor.dispose();
  return probs;
}

/**
 * Dự đoán từ đường dẫn file ảnh.
 * @param {string} filePath
 * @param {object} opts { modelDir }
 * @returns {Promise<{diem:number, phanLoai:string, doTinCay:object}>}
 */
async function predictFile(filePath, opts = {}) {
  if (opts.modelDir) await loadModel(opts.modelDir);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file ảnh: ${filePath}`);
  }

  const tensor = await loadImageAsTensor(filePath, IMAGE_SIZE);
  try {
    const probs = await predictTensor(tensor);
    return formatResult(probs);
  } finally {
    tensor.dispose();
  }
}

/**
 * Dự đoán từ buffer (dùng cho upload qua multer).
 * @param {Buffer} buffer
 * @param {string} ext - '.jpg' | '.png'
 * @param {object} opts { modelDir }
 * @returns {Promise<{diem:number, phanLoai:string, doTinCay:object}>}
 */
async function predictBuffer(buffer, ext = '.jpg', opts = {}) {
  if (opts.modelDir) await loadModel(opts.modelDir);

  const tensor = await bufferToTensor(buffer, ext, IMAGE_SIZE);
  try {
    const probs = await predictTensor(tensor);
    return formatResult(probs);
  } finally {
    tensor.dispose();
  }
}

/**
 * Đóng gói vector xác suất -> JSON kết quả theo đúng format yêu cầu.
 */
function formatResult(probs) {
  const phanLoai = probsToLabel(probs);
  return {
    diem: probsToScore(probs),
    phanLoai,
    doTinCay: probsToConfidence(probs)
  };
}

/**
 * Kiểm tra model đã được train chưa.
 */
function modelExists(modelDir = DEFAULT_MODEL_DIR) {
  return fs.existsSync(path.join(modelDir, 'model.json'));
}

/**
 * Đọc metadata của model (nhãn, thời điểm train, độ chính xác...).
 */
function readMetadata(modelDir = DEFAULT_MODEL_DIR) {
  const p = path.join(modelDir, 'metadata.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  DEFAULT_MODEL_DIR,
  loadModel,
  predictFile,
  predictBuffer,
  predictTensor,
  formatResult,
  modelExists,
  readMetadata
};

// ------------------------------------------------------------
// CLI: node predict.js <ảnh...>
// ------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const files = process.argv.slice(2);

    if (files.length === 0) {
      console.log('Cách dùng: node predict.js <duong-dan-anh> [anh2.jpg ...]');
      process.exit(1);
    }

    if (!modelExists()) {
      console.error(`❌ Chưa có model tại "${DEFAULT_MODEL_DIR}".`);
      console.error('   Hãy chạy "node train.js" trước để huấn luyện.');
      process.exit(1);
    }

    await tf.ready();
    console.log(`Backend: ${tf.getBackend()}`);
    await loadModel();

    const meta = readMetadata();
    if (meta && meta.trainedAt) {
      console.log(`Model train lúc: ${new Date(meta.trainedAt).toLocaleString('vi-VN')}`);
    }
    console.log('='.repeat(58));

    for (const f of files) {
      try {
        const t0 = Date.now();
        const result = await predictFile(f);
        const ms = Date.now() - t0;
        const display = LABEL_DISPLAY[result.phanLoai] || result.phanLoai;

        console.log(`\n📷 ${path.basename(f)}   (${ms}ms)`);
        console.log(`   Điểm số   : ${result.diem}/100`);
        console.log(`   Phân loại : ${display}  (${result.phanLoai})`);
        console.log(`   Độ tin cậy:`);
        console.log(`     - Sạch      : ${(result.doTinCay.sach * 100).toFixed(2)}%`);
        console.log(`     - Hơi bẩn   : ${(result.doTinCay.hoiBan * 100).toFixed(2)}%`);
        console.log(`     - Rất bẩn   : ${(result.doTinCay.ratBan * 100).toFixed(2)}%`);
        console.log('   JSON:');
        console.log('   ' + JSON.stringify(result));
      } catch (err) {
        console.error(`\n❌ Lỗi với "${f}": ${err.message}`);
      }
    }
    console.log('\n' + '='.repeat(58));
  })().catch(err => {
    console.error('❌ LỖI:', err.message);
    process.exit(1);
  });
}
