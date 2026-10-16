// ============================================================
// CLEANOVA AI MODULE - MobileNet Backbone (đóng băng)
// ============================================================
// MobileNet v1 huấn luyện sẵn trên ImageNet, dùng làm BỘ TRÍCH ĐẶC TRƯNG
// (feature extractor). Toàn bộ trọng số của nó được ĐÓNG BĂNG — không train.
//
// ⚠️ VÌ SAO KHÔNG "CẮT LỚP CUỐI" THEO CÁCH THÔNG THƯỜNG?
// Gói @tensorflow-models/mobilenet trả về một tf.GraphModel, KHÔNG phải
// tf.LayersModel (kiểm chứng: base.layers === undefined, base.getLayer === undefined).
// GraphModel không cho phép truy cập/cắt từng layer, nên không thể làm:
//     const base = mobilenet.model;
//     base.layers.pop();            // ❌ không tồn tại
//     model.add(tf.layers.dense(...));  // ❌ không ghép được
//
// CÁCH LÀM TƯƠNG ĐƯƠNG VỀ MẶT TOÁN HỌC (và hiệu quả hơn nhiều trên CPU):
//   1. Chạy MobileNet với `embedding = true` để lấy vector đặc trưng 1024 chiều
//      ở lớp global pooling — tức là "đầu ra ngay trước lớp phân loại 1000 lớp".
//      Đây chính là việc "cắt bỏ lớp cuối" (bỏ lớp softmax 1000 lớp của ImageNet).
//   2. Vector 1024 chiều đó là INPUT cho 2 lớp Dense của riêng ta.
//
// Lợi ích: MobileNet chỉ chạy 1 lần cho mỗi ảnh (thay vì mỗi epoch), nên
// train nhanh hơn hàng chục lần trên backend CPU thuần JS.
// ============================================================

const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');

// Số chiều vector đặc trưng của MobileNet v1 alpha=1.0
const EMBEDDING_DIM = 1024;

let _backbone = null;

/**
 * Nạp MobileNet (có cache — chỉ nạp 1 lần cho cả tiến trình).
 */
async function loadBackbone() {
  if (_backbone) return _backbone;
  await tf.ready();
  // version 1 + alpha 1.0 -> embedding 1024 chiều, nhẹ và ổn định trên CPU
  _backbone = await mobilenet.load({ version: 1, alpha: 1.0 });
  return _backbone;
}

/**
 * Trích vector đặc trưng 1024 chiều cho MỘT tensor ảnh [224,224,3].
 *
 * Đã kiểm chứng thực tế: infer(t, true) trả về shape [1, 1024].
 * @param {tf.Tensor3D} imageTensor
 * @returns {tf.Tensor2D} shape [1,1024]
 */
async function extractEmbedding(imageTensor) {
  const net = await loadBackbone();
  return net.infer(imageTensor, true);
}

/**
 * Trích embedding cho một LÔ ảnh (batch) — nhanh hơn nhiều so với từng ảnh.
 *
 * Đã kiểm chứng thực tế các shape đầu ra của infer(t, true):
 *   [224,224,3]      -> [1,1024]
 *   [1,224,224,3]    -> [1,1024]
 *   [3,224,224,3]    -> [3,1024]
 * Tức là thư viện ĐÃ tự squeeze sẵn, không cần gọi tf.squeeze nữa.
 *
 * @param {tf.Tensor4D} batchTensor - shape [n,224,224,3]
 * @returns {tf.Tensor2D} shape [n,1024]
 */
async function extractEmbeddingBatch(batchTensor) {
  const net = await loadBackbone();
  return net.infer(batchTensor, true);
}

module.exports = {
  EMBEDDING_DIM,
  loadBackbone,
  extractEmbedding,
  extractEmbeddingBatch
};
