// ============================================================
// DABCLEAN AI MODULE - PREDICT.JS
// ============================================================
// Nạp model đã train (model-do-ban2/) và dự đoán độ bẩn của 1 ảnh.
//
// CÁCH DÙNG (CLI):
//   node predict.js duong-dan-anh.jpg
//   node predict.js anh1.jpg anh2.jpg        (nhiều ảnh)
//   node predict.js --whole anh.jpg          (chấm cả ảnh 1 lần, cách cũ)
//
// CÁCH DÙNG (từ code khác):
//   const { predictFile } = require('./predict');
//   const result = await predictFile('anh.jpg');
//
// CƠ CHẾ CHẤM ĐIỂM: PATCH 3x3 (mặc định)
// ---------------------------------------
// Trước đây: nén cả ảnh -> 1 xác suất. Ảnh NGẬP RÁC bị chấm "hoi-ban" vì
// đặc trưng "rác" bị pha loãng với phần tường/trần sạch còn lại.
//
// Nay: chia ảnh thành lưới 3x3, chấm TỪNG Ô riêng (mỗi ô phóng to về 224x224
// để MobileNet "soi kỹ" vùng đó), rồi tổng hợp:
//   tiLeSieuBan = số ô rat-ban / tổng số ô
//   tiLeBan     = số ô (rat-ban + hoi-ban) / tổng số ô
//   >= 34% ô rat-ban          -> rat-ban
//   >= 34% ô bẩn              -> hoi-ban
//   còn lại                   -> sach
//   diem = tiLeSieuBan*70 + tiLeBan*30
//
// OUTPUT (JSON):
//   {
//     "diem": 72.4,
//     "phanLoai": "rat-ban",
//     "doTinCay": { "sach": 0.02, "hoiBan": 0.11, "ratBan": 0.87 },
//     "chiTiet": { "soOSieuBan": 6, "tiLeSieuBan": 0.67, ... }
//   }
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');

const { loadBackbone } = require('./src/ml/backbone');
const { loadImageAsTensor, bufferToTensor, IMAGE_SIZE } = require('./src/ml/imageUtils');
const { createFsIOHandler } = require('./src/ml/fsIOHandler');
const { scoreByPatch, combineWholeAndPatch } = require('./src/ml/patchScorer');
const {
  LABELS,
  LABEL_DISPLAY,
  probsToScore,
  probsToLabel,
  probsToConfidence
} = require('./src/ml/labels');

// Thư mục model mặc định
const DEFAULT_MODEL_DIR = path.join(__dirname, 'model-do-ban2');

// Cách chấm:
//   'whole'  (MẶC ĐỊNH) — nén cả ảnh 1 lần. ĐÃ ĐO THỰC TẾ: đây là cách
//            TỐT NHẤT cả về độ chính xác lẫn tốc độ.
//   'fast'   — whole trước, chỉ chạy patch khi điểm nằm vùng nghi ngờ (40-88)
//   'hybrid' — luôn chấm cả whole lẫn patch (chậm ~6x)
//   'patch'  — chỉ patch (giữ để nghiên cứu, KHÔNG khuyến nghị)
//
// 📊 SỐ LIỆU ĐO THỰC TẾ (model v2: Dense 256-128, 1057 ảnh, augment 1):
//   chế độ    Sạch   Hơi bẩn   Rất bẩn   Giây/ảnh
//   whole     100%     75%      100%       2.3
//   fast      100%     50%      100%       9.1
//   hybrid     75%     50%        -       13.0
//   patch      25%     50%      100%      13.0
//
// KẾT LUẬN: patch 3x3 KHÔNG giúp ích với model này. Lý do: model được train
// trên TOÀN ẢNH phòng (thấy bố cục tường+sàn+đồ đạc). Khi chỉ đưa một mảng
// tường 1/9 khung, đặc trưng nằm ngoài phân bố train (distribution shift)
// -> model đoán bừa. Với ảnh NGẬP RÁC, whole đã nhận đúng 100%.
const SCORE_MODE = (process.env.SCORE_MODE || 'whole').toLowerCase();

// Ngưỡng "vùng nghi ngờ": ngoài khoảng này, whole đã đủ chắc chắn,
// không cần chạy patch (tiết kiệm ~13 giây/ảnh).
const DOUBT_LOW = 40;    // dưới mức này: chắc chắn sạch
const DOUBT_HIGH = 88;   // trên mức này: chắc chắn rất bẩn

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
 *
 * Mặc định chấm theo PATCH 3x3 (chính xác hơn cho ảnh ngập rác).
 * Đặt opts.mode = 'whole' để quay lại cách cũ (chấm cả ảnh 1 lần).
 *
 * @param {string} filePath
 * @param {object} opts { modelDir, mode }
 * @returns {Promise<{diem:number, phanLoai:string, doTinCay:object, chiTiet?:object}>}
 */
async function predictFile(filePath, opts = {}) {
  if (opts.modelDir) await loadModel(opts.modelDir);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file ảnh: ${filePath}`);
  }

  const mode = (opts.mode || SCORE_MODE).toLowerCase();

  // Cả 3 chế độ đều đọc buffer rồi gọi predictBuffer (hybrid cần buffer để
  // vừa chấm whole vừa cắt patch — tránh đọc/giải mã ảnh 2 lần).
  const buffer = fs.readFileSync(filePath);
  return predictBuffer(buffer, path.extname(filePath), { ...opts, mode });
}

/**
 * Dự đoán từ buffer (dùng cho upload qua multer).
 *
 * Mặc định chấm theo PATCH 3x3. Đặt opts.mode = 'whole' để dùng cách cũ.
 *
 * @param {Buffer} buffer
 * @param {string} ext - '.jpg' | '.png' | ...
 * @param {object} opts { modelDir, mode, tile }
 * @returns {Promise<{diem:number, phanLoai:string, doTinCay:object, chiTiet?:object}>}
 */
async function predictBuffer(buffer, ext = '.jpg', opts = {}) {
  if (opts.modelDir) await loadModel(opts.modelDir);

  const mode = (opts.mode || SCORE_MODE).toLowerCase();
  const model = await loadModel();
  const net = await loadBackbone();

  // --- Chế độ WHOLE: cả ảnh 1 lần (cách cũ, nhanh nhất) ---
  if (mode === 'whole') {
    const tensor = await bufferToTensor(buffer, ext, IMAGE_SIZE);
    try {
      const probs = await predictTensor(tensor);
      return formatResult(probs);
    } finally {
      tensor.dispose();
    }
  }

  // --- Chế độ PATCH: chỉ theo vùng ---
  if (mode === 'patch') {
    return scoreByPatch(model, net, buffer, { tile: opts.tile });
  }

  // Hai chế độ còn lại đều bắt đầu bằng WHOLE (rẻ, ~1.4s)
  const tensor = await bufferToTensor(buffer, ext, IMAGE_SIZE);
  let whole;
  try {
    const probs = await predictTensor(tensor);
    whole = formatResult(probs);
  } finally {
    tensor.dispose();
  }

  // --- Chế độ FAST: chỉ chạy patch khi whole nằm trong "vùng nghi ngờ" ---
  // Lý do: patch tốn ~13s (9 lần MobileNet). Với ảnh rõ ràng sạch (<40) hoặc
  // rõ ràng rất bẩn (>88), whole đã đủ tin cậy -> bỏ qua patch.
  // Đo thực tế: ảnh ngập rác thường có whole ~50-75 (vùng nghi ngờ) nên
  // patch VẪN được chạy -> vẫn bắt đúng. Ảnh sạch thường <40 -> bỏ qua.
  if (mode === 'fast') {
    const doubt = whole.diem >= DOUBT_LOW && whole.diem <= DOUBT_HIGH;
    if (!doubt) {
      return {
        ...whole,
        chiTiet: { nguon: 'whole (ngoài vùng nghi ngờ, bỏ qua patch)' }
      };
    }
    const patch = await scoreByPatch(model, net, buffer, { tile: opts.tile });
    return combineWholeAndPatch(whole, patch);
  }

  // --- Chế độ HYBRID: luôn chạy cả hai ---
  const patch = await scoreByPatch(model, net, buffer, { tile: opts.tile });
  return combineWholeAndPatch(whole, patch);
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
    const argv = process.argv.slice(2);
    let mode = SCORE_MODE;
    if (argv.includes('--whole')) mode = 'whole';
    else if (argv.includes('--patch')) mode = 'patch';
    else if (argv.includes('--hybrid')) mode = 'hybrid';
    else if (argv.includes('--fast')) mode = 'fast';
    const files = argv.filter(a => !a.startsWith('--'));

    if (files.length === 0) {
      console.log('Cách dùng: node predict.js <duong-dan-anh> [anh2.jpg ...]');
      console.log('  (mặc định: whole — cả ảnh, nhanh 2.3s và chính xác nhất)');
      console.log('  --whole    chấm cả ảnh 1 lần       (khuyến nghị)');
      console.log('  --fast     whole + patch khi nghi  (chậm ~9s/ảnh)');
      console.log('  --hybrid   luôn chấm cả hai        (chậm ~13s/ảnh)');
      console.log('  --patch    chỉ theo vùng 3x3       (chỉ để nghiên cứu)');
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
    console.log(`Cách chấm: ${mode === 'patch' ? 'PATCH 3x3 (theo vùng)'
      : mode === 'whole' ? 'WHOLE (cả ảnh)'
      : mode === 'hybrid' ? 'HYBRID (whole + patch)'
      : 'FAST (whole, patch khi nghi ngờ)'}`);
    console.log('='.repeat(58));

    for (const f of files) {
      try {
        const t0 = Date.now();
        const result = await predictFile(f, { mode });
        const ms = Date.now() - t0;
        const display = LABEL_DISPLAY[result.phanLoai] || result.phanLoai;

        console.log(`\n📷 ${path.basename(f)}   (${ms}ms)`);
        console.log(`   Điểm số   : ${result.diem}/100`);
        console.log(`   Phân loại : ${display}  (${result.phanLoai})`);
        console.log(`   Độ tin cậy:`);
        console.log(`     - Sạch      : ${(result.doTinCay.sach * 100).toFixed(2)}%`);
        console.log(`     - Hơi bẩn   : ${(result.doTinCay.hoiBan * 100).toFixed(2)}%`);
        console.log(`     - Rất bẩn   : ${(result.doTinCay.ratBan * 100).toFixed(2)}%`);
        if (result.chiTiet) {
          const c = result.chiTiet;
          console.log(`   Theo ô    : rat-ban ${c.soOSieuBan}/${c.tongSo} · hoi-ban ${c.soOBan}/${c.tongSo} · sach ${c.soOSach}/${c.tongSo}`);
          console.log(`               tiLeSieuBan=${c.tiLeSieuBan}  tiLeBan=${c.tiLeBan}`);
        }
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
