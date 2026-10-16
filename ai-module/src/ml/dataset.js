// ============================================================
// CLEANOVA AI MODULE - Đọc dataset ảnh từ thư mục
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
 * cập nhật 2 lớp Dense nhỏ, nhanh hơn hàng chục lần so với chạy lại MobileNet
 * mỗi epoch (đặc biệt quan trọng vì ta dùng backend CPU thuần JS).
 *
 * @param {Array} items - kết quả từ scanDataset()
 * @param {object} opts
 * @param {number} opts.batchSize
 * @param {function} opts.onProgress - callback(done, total)
 * @returns {{ xs: tf.Tensor2D, ys: tf.Tensor2D }}
 */
async function buildEmbeddingDataset(items, opts = {}) {
  const batchSize = opts.batchSize || 16;
  const onProgress = opts.onProgress || (() => {});
  const { extractEmbeddingBatch } = require('./backbone');

  const embeddingChunks = [];
  const labelChunks = [];

  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);

    // Nạp từng ảnh -> tensor [224,224,3], gom thành lô [n,224,224,3]
    const tensors = slice.map(it => loadImageAsTensor(it.file));
    const batch = tf.stack(tensors);
    tensors.forEach(t => t.dispose());

    // MobileNet -> [n,1024]
    const emb = await extractEmbeddingBatch(batch);
    batch.dispose();

    embeddingChunks.push(emb);
    labelChunks.push(tf.tensor2d(
      slice.map(it => oneHot(it.labelIndex)),
      [slice.length, LABELS.length]
    ));

    onProgress(Math.min(start + batchSize, items.length), items.length);
  }

  // Nối tất cả lô lại thành 1 tensor duy nhất
  const xs = tf.concat(embeddingChunks, 0);
  const ys = tf.concat(labelChunks, 0);
  embeddingChunks.forEach(t => t.dispose());
  labelChunks.forEach(t => t.dispose());

  return { xs, ys };
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
  oneHot
};
