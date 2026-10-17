// ============================================================
// DABCLEAN AI MODULE - Model Factory (phần "đầu" tự huấn luyện)
// ============================================================
// Đây chính là 2 lớp Dense của riêng ta, đúng như yêu cầu:
//
//   Input  : vector đặc trưng MobileNet (1024 chiều)
//   Dense 1: 64 units, activation = relu
//   Dense 2:  3 units, activation = softmax   -> [sach, hoi-ban, rat-ban]
//
// LƯU Ý VỀ INPUT:
// Vì MobileNet ở đây là GraphModel (không cắt/ghép layer được — xem giải
// thích chi tiết trong `backbone.js`), ta áp dụng MobileNet TRƯỚC để lấy
// vector 1024 chiều, rồi đưa vector đó vào 2 lớp Dense này.
//
// Về mặt toán học, mạng hoàn chỉnh là:
//
//   ảnh 224x224x3
//     -> [MobileNet v1 đóng băng]  -> vector 1024
//     -> [Dense 64 relu]           <- TA TRAIN
//     -> [Dense 3 softmax]         <- TA TRAIN
//
// Tức là ta đã "cắt bỏ lớp cuối" (lớp softmax 1000 lớp ImageNet) của
// MobileNet và "thêm 2 lớp Dense của riêng mình" vào đúng vị trí đó.
// ============================================================

const tf = require('@tensorflow/tfjs');
const { EMBEDDING_DIM } = require('./backbone');
const { LABELS } = require('./labels');

/**
 * Tạo model "đầu" (head) chưa huấn luyện.
 *
 * @param {object} options
 * @param {number} options.hiddenUnits - số unit lớp Dense 1 (mặc định 64)
 * @param {number} options.dropout      - tỉ lệ dropout (mặc định 0.3, chống overfit)
 * @param {number} options.learningRate - tốc độ học (mặc định 0.001)
 * @returns {tf.Sequential}
 */
function buildHeadModel(options = {}) {
  const hiddenUnits = options.hiddenUnits || 64;
  const dropout = options.dropout === undefined ? 0.3 : options.dropout;
  const learningRate = options.learningRate || 0.001;

  const model = tf.sequential();

  // Lớp Dense 1: 64 units, relu — như yêu cầu
  model.add(tf.layers.dense({
    units: hiddenUnits,
    activation: 'relu',
    inputShape: [EMBEDDING_DIM],
    kernelInitializer: 'glorotUniform',
    name: 'dense_64_relu'
  }));

  // Dropout: tắt ngẫu nhiên 30% neuron khi train để giảm overfit
  // (dataset nhỏ nên bước này rất quan trọng)
  if (dropout > 0) {
    model.add(tf.layers.dropout({ rate: dropout, name: 'dropout' }));
  }

  // Lớp Dense 2: 3 units, softmax — đầu ra xác suất 3 lớp
  model.add(tf.layers.dense({
    units: LABELS.length,
    activation: 'softmax',
    name: 'dense_3_softmax'
  }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

module.exports = { buildHeadModel };
