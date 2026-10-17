// ============================================================
// DABCLEAN AI MODULE - Model Factory (phần "đầu" tự huấn luyện)
// ============================================================
// Đây là các lớp Dense của riêng ta, xếp trên vector đặc trưng MobileNet.
//
//   Input  : vector đặc trưng MobileNet (1024 chiều)
//   Block 1: Dense(256, relu)  -> Dropout(0.5)
//   Block 2: Dense(128, relu)  -> Dropout(0.3)
//   Output : Dense(3, softmax) -> [sach, hoi-ban, rat-ban]
//
// VÌ SAO SÂU HƠN BẢN CŨ?
// Bản cũ chỉ có 1 lớp Dense(64) — quá mỏng để tách "hơi bẩn" khỏi "rất bẩn",
// vì hai lớp này khác nhau chủ yếu ở MẬT ĐỘ rác (đặc trưng phi tuyến phức tạp),
// không phải ở loại vật thể. Thêm một block ẩn nữa cho model khả năng học
// ranh giới phi tuyến đó. Dropout tăng lên 0.5 ở block đầu để chống overfit
// (dataset 1057 ảnh, không lớn).
//
// LƯU Ý VỀ INPUT:
// Vì MobileNet ở đây là GraphModel (không cắt/ghép layer được — xem giải
// thích chi tiết trong `backbone.js`), ta áp dụng MobileNet TRƯỚC để lấy
// vector 1024 chiều, rồi đưa vector đó vào các lớp Dense này.
//
// Về mặt toán học, mạng hoàn chỉnh là:
//
//   ảnh 224x224x3
//     -> [MobileNet v1 đóng băng] -> vector 1024
//     -> [Dense 256 relu]         <- TA TRAIN
//     -> [Dropout 0.5]
//     -> [Dense 128 relu]         <- TA TRAIN
//     -> [Dropout 0.3]
//     -> [Dense 3 softmax]        <- TA TRAIN
// ============================================================

const tf = require('@tensorflow/tfjs');
const { EMBEDDING_DIM } = require('./backbone');
const { LABELS } = require('./labels');

/**
 * Tạo model "đầu" (head) chưa huấn luyện — bản SÂU.
 *
 * @param {object} options
 * @param {number[]} options.hiddenUnits - số unit từng lớp ẩn (mặc định [256, 128])
 * @param {number[]} options.dropouts     - tỉ lệ dropout sau mỗi lớp ẩn (mặc định [0.5, 0.3])
 * @param {number} options.learningRate   - tốc độ học (mặc định 0.001)
 * @returns {tf.Sequential}
 */
function buildHeadModel(options = {}) {
  const hiddenUnits = options.hiddenUnits || [256, 128];
  const dropouts = options.dropouts || [0.5, 0.3];
  const learningRate = options.learningRate || 0.001;

  const model = tf.sequential();

  // Lớp vào: vector đặc trưng MobileNet
  model.add(tf.layers.dense({
    units: hiddenUnits[0],
    activation: 'relu',
    inputShape: [EMBEDDING_DIM],
    kernelInitializer: 'glorotUniform',
    name: `dense_${hiddenUnits[0]}_relu`
  }));

  if (dropouts[0] > 0) {
    model.add(tf.layers.dropout({ rate: dropouts[0], name: 'dropout_1' }));
  }

  // Các block ẩn tiếp theo (nếu có)
  for (let i = 1; i < hiddenUnits.length; i += 1) {
    model.add(tf.layers.dense({
      units: hiddenUnits[i],
      activation: 'relu',
      kernelInitializer: 'glorotUniform',
      name: `dense_${hiddenUnits[i]}_relu`
    }));
    const d = dropouts[i] === undefined ? 0.3 : dropouts[i];
    if (d > 0) {
      model.add(tf.layers.dropout({ rate: d, name: `dropout_${i + 1}` }));
    }
  }

  // Lớp ra: softmax 3 lớp
  model.add(tf.layers.dense({
    units: LABELS.length,
    activation: 'softmax',
    name: `dense_${LABELS.length}_softmax`
  }));

  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

module.exports = { buildHeadModel };
