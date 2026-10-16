// ============================================================
// CLEANOVA AI MODULE - Custom IOHandler đọc/ghi model bằng fs
// ============================================================
// VÌ SAO CẦN FILE NÀY?
// Bản @tensorflow/tfjs thuần JavaScript (dùng cho Node 24 vì không có
// prebuilt binary của tfjs-node) KHÔNG đăng ký sẵn IO handler cho scheme
// `file://` — đó là tính năng riêng của @tensorflow/tfjs-node.
//
// Kiểm chứng:
//   tf.io.getSaveHandlers('file:///x')  ->  []   (rỗng)
//   model.save('file://...')            ->  lỗi "Cannot find any save handlers"
//
// Nên ta tự viết một IOHandler dùng module `fs` của Node để ghi/đọc đúng
// định dạng chuẩn của TensorFlow.js:
//   <dir>/model.json   -> kiến trúc mạng + danh sách weight (manifest)
//   <dir>/weights.bin  -> dữ liệu weight dạng nhị phân
//
// Nhờ vậy `tf.loadLayersModel(handler)` vẫn hoạt động bình thường.
// ============================================================

const fs = require('fs');
const path = require('path');

const MODEL_JSON = 'model.json';
const WEIGHTS_BIN = 'weights.bin';

/**
 * Tạo IOHandler cho một thư mục trên ổ đĩa.
 * @param {string} dir - thư mục chứa model (ví dụ: model-do-ban2)
 * @returns {tf.io.IOHandler}
 */
function createFsIOHandler(dir) {
  return {
    // --------------------------------------------------------
    // SAVE: tf truyền vào modelArtifacts, ta ghi ra 2 file
    // --------------------------------------------------------
    async save(modelArtifacts) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const {
        modelTopology,
        weightSpecs,
        weightData,
        format,
        generatedBy,
        convertedBy
      } = modelArtifacts;

      // model.json: kiến trúc + manifest trỏ tới weights.bin
      const modelJson = {
        format: format || 'layers-model',
        generatedBy: generatedBy || 'cleanova-ai-module',
        convertedBy: convertedBy || null,
        modelTopology,
        weightsManifest: [
          {
            paths: [WEIGHTS_BIN],
            weights: weightSpecs
          }
        ]
      };

      fs.writeFileSync(
        path.join(dir, MODEL_JSON),
        JSON.stringify(modelJson)
      );

      // weights.bin: dữ liệu nhị phân thô
      fs.writeFileSync(
        path.join(dir, WEIGHTS_BIN),
        Buffer.from(weightData)
      );

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          modelTopologyBytes: JSON.stringify(modelTopology).length,
          weightSpecsBytes: JSON.stringify(weightSpecs).length,
          weightDataBytes: weightData.byteLength
        }
      };
    },

    // --------------------------------------------------------
    // LOAD: đọc 2 file và trả lại modelArtifacts cho tf
    // --------------------------------------------------------
    async load() {
      const modelJsonPath = path.join(dir, MODEL_JSON);
      if (!fs.existsSync(modelJsonPath)) {
        throw new Error(
          `Không tìm thấy model tại "${dir}". Hãy chạy "node train.js" trước để huấn luyện.`
        );
      }

      const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, 'utf8'));
      const manifest = modelJson.weightsManifest[0];

      // Đọc weights.bin thành ArrayBuffer
      const weightsPath = path.join(dir, manifest.paths[0]);
      const bin = fs.readFileSync(weightsPath);
      const weightData = bin.buffer.slice(
        bin.byteOffset,
        bin.byteOffset + bin.byteLength
      );

      return {
        modelTopology: modelJson.modelTopology,
        weightSpecs: manifest.weights,
        weightData,
        format: modelJson.format,
        generatedBy: modelJson.generatedBy,
        convertedBy: modelJson.convertedBy
      };
    }
  };
}

module.exports = { createFsIOHandler, MODEL_JSON, WEIGHTS_BIN };
