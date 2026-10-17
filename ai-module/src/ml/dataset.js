// ============================================================
// DABCLEAN AI MODULE - Đọc dataset ảnh từ thư mục
// ============================================================
// Cấu trúc dataset mong đợi:
//
//   ai-module/
//     dataset/
//       sach/       *.jpg *.jpeg *.png
//       hoi-ban/    *.jpg *.jpeg *.png
//       rat-ban/    *.jpg *.jpeg *.png
//
// Mỗi thư mục con = 1 lớp. Thứ tự lớp lấy từ `labels.js` để đảm bảo
// index của softmax luôn khớp với ý nghĩa nhãn.
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');

const { LABELS } = require('./labels');
const { loadImageAsTensor } = require('./imageUtils');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png'];

/**
 * Liệt kê file ảnh trong 1 thư mục (không đệ quy).
 */
function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f));
}

/**
 * Quét dataset và trả về danh sách { file, labelIndex, label }.
 * @param {string} datasetDir
 * @returns {{ items: Array, counts: object, total: number }}
 */
function scanDataset(datasetDir) {
  const items = [];
  const counts = {};

  for (let i = 0; i < LABELS.length; i += 1) {
    const label = LABELS[i];
    const dir = path.join(datasetDir, label);
    const files = listImages(dir);
    counts[label] = files.length;
    for (const file of files) {
      items.push({ file, labelIndex: i, label });
    }
  }

  return { items, counts, total: items.length };
}

/**
 * Kiểm tra dataset có hợp lệ để train không.
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
function validateDataset(datasetDir) {
  const errors = [];
  const warnings = [];
  const { counts, total } = scanDataset(datasetDir);

  if (total === 0) {
    errors.push(
      `Không tìm thấy ảnh nào trong "${datasetDir}". ` +
      `Cần 3 thư mục con: ${LABELS.map(l => `${l}/`).join(', ')}`
    );
    return { ok: false, errors, warnings };
  }

  for (const label of LABELS) {
    if (counts[label] === 0) {
      errors.push(`Thư mục "${label}" chưa có ảnh — cần ít nhất vài ảnh mỗi lớp.`);
    } else if (counts[label] < 10) {
      warnings.push(`Lớp "${label}" chỉ có ${counts[label]} ảnh — nên có từ 30-50 ảnh để kết quả tốt hơn.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Chuyển TOÀN BỘ dataset thành 2 tensor embedding + nhãn.
 *
 * Đây là bước "trích đặc trưng" (feature extraction): MobileNet chạy MỘT LẦN
 * cho mỗi ảnh, ta lưu lại vector 1024 chiều. Nhờ vậy quá trình train chỉ phải
 * cập nhật các lớp Dense nhỏ, nhanh hơn hàng chục lần so với chạy lại MobileNet
 * mỗi epoch (đặc biệt quan trọng vì ta dùng backend CPU thuần JS).
 *
 * AUGMENTATION (tuỳ chọn):
 * Nếu opts.augmentPerImage > 0, mỗi ảnh gốc sinh thêm N biến thể (lật ngang,
 * crop/zoom, đổi độ sáng) TRƯỚC khi trích embedding. Nhờ vậy tập train lớn
 * hơn N+1 lần, giúp model học đặc trưng bền vững thay vì ghi nhớ ảnh.
 * Riêng lớp rat-ban còn được zoom sâu vùng trung tâm (xem augment.js).
 *
 * ⚠️ Chi phí: mỗi biến thể = 1 lần MobileNet. Trên CPU ~1.8s/lần.
 *
 * @param {Array} items - kết quả từ scanDataset()
 * @param {object} opts
 * @param {number} opts.batchSize        - số ảnh mỗi lô (mặc định 16)
 * @param {number} opts.augmentPerImage  - số biến thể thêm mỗi ảnh (mặc định 0)
 * @param {function} opts.onProgress     - callback(done, total)
 * @param {function} opts.onStage        - callback(stageName) báo giai đoạn
 * @returns {{ xs: tf.Tensor2D, ys: tf.Tensor2D, augmentInfo: object }}
 */
async function buildEmbeddingDataset(items, opts = {}) {
  const batchSize = opts.batchSize || 16;
  const onProgress = opts.onProgress || (() => {});
  const onStage = opts.onStage || (() => {});
  const augmentPerImage = opts.augmentPerImage || 0;
  const { extractEmbeddingBatch } = require('./backbone');
  const { planAugmentations, applyAugmentation } = require('./augment');
  const fs = require('fs');

  const embeddingChunks = [];
  const labelChunks = [];
  const augmentInfo = { original: 0, augmented: 0, byLabel: {} };

  // --- Giai đoạn 1: ảnh GỐC ---
  onStage('Trích đặc trưng ảnh GỐC');
  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);

    const tensors = await Promise.all(slice.map(it => loadImageAsTensor(it.file)));
    const batch = tf.stack(tensors);
    tensors.forEach(t => t.dispose());

    const emb = await extractEmbeddingBatch(batch);
    batch.dispose();

    embeddingChunks.push(emb);
    labelChunks.push(tf.tensor2d(
      slice.map(it => oneHot(it.labelIndex)),
      [slice.length, LABELS.length]
    ));
    augmentInfo.original += slice.length;

    onProgress(Math.min(start + batchSize, items.length), items.length);
  }

  // --- Giai đoạn 2: các BIẾN THỂ augmentation ---
  if (augmentPerImage > 0) {
    onStage(`Trích đặc trưng ${augmentPerImage} biến thể/ảnh`);
    const totalAug = items.length * augmentPerImage;
    let doneAug = 0;

    // Gom theo nhãn để biết lớp nào (rat-ban cần zoom sâu hơn)
    for (let idx = 0; idx < items.length; idx += 1) {
      const it = items[idx];
      const plans = planAugmentations(it.label, augmentPerImage, idx * 7919 + 13);
      const raw = fs.readFileSync(it.file);

      const variants = [];
      for (const plan of plans) {
        try {
          variants.push(await applyAugmentation(raw, plan));
        } catch (e) {
          // Biến thể lỗi (ảnh gốc hỏng góc cạnh) -> bỏ qua, không làm chết train
          variants.push(null);
        }
      }

      const valid = variants.filter(Boolean);
      if (valid.length > 0) {
        const tensors = await Promise.all(valid.map(v => loadTensorFromBuffer(v)));
        const batch = tf.stack(tensors);
        tensors.forEach(t => t.dispose());

        const emb = await extractEmbeddingBatch(batch);
        batch.dispose();

        embeddingChunks.push(emb);
        labelChunks.push(tf.tensor2d(
          valid.map(() => oneHot(it.labelIndex)),
          [valid.length, LABELS.length]
        ));

        augmentInfo.augmented += valid.length;
        augmentInfo.byLabel[it.label] = (augmentInfo.byLabel[it.label] || 0) + valid.length;
      }

      doneAug += augmentPerImage;
      onProgress(Math.min(doneAug, totalAug), totalAug);
    }
  }

  // Nối tất cả lô lại thành 1 tensor duy nhất
  const xs = tf.concat(embeddingChunks, 0);
  const ys = tf.concat(labelChunks, 0);
  embeddingChunks.forEach(t => t.dispose());
  labelChunks.forEach(t => t.dispose());

  return { xs, ys, augmentInfo };
}

/**
 * Nạp tensor từ buffer ảnh (dùng cho biến thể augmentation đã là JPEG 224x224).
 * Dùng sharp -> raw RGB -> tensor [224,224,3].
 */
async function loadTensorFromBuffer(buffer) {
  const sharp = require('sharp');
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const px = new Float32Array(info.width * info.height * 3);
  if (ch === 3) {
    px.set(data.subarray(0, info.width * info.height * 3));
  } else {
    for (let i = 0, j = 0; i < info.width * info.height; i += 1) {
      const k = i * ch;
      px[j++] = data[k];
      px[j++] = data[k + 1];
      px[j++] = data[k + 2];
    }
  }
  return tf.tensor3d(px, [info.height, info.width, 3], 'float32');
}

/**
 * One-hot vector cho 1 nhãn.
 */
function oneHot(labelIndex) {
  const arr = new Array(LABELS.length).fill(0);
  arr[labelIndex] = 1;
  return arr;
}

module.exports = {
  IMAGE_EXTS,
  listImages,
  scanDataset,
  validateDataset,
  buildEmbeddingDataset,
  loadTensorFromBuffer,
  oneHot
};
