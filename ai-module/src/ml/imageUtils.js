// ============================================================
// CLEANOVA AI MODULE - Tiện ích đọc ảnh -> Tensor
// ============================================================
// VÌ SAO KHÔNG DÙNG tf.node.decodeImage?
// Bản @tensorflow/tfjs thuần JavaScript KHÔNG có đối tượng `tf.node`
// (kiểm chứng: typeof tf.node === 'undefined'). `tf.node` chỉ tồn tại ở
// @tensorflow/tfjs-node — mà gói đó không có prebuilt binary cho Node 24
// và máy thiếu Visual Studio để build từ source.
//
// Nên ta giải mã ảnh bằng thư viện thuần JS:
//   - jpeg-js  -> ảnh JPEG
//   - pngjs    -> ảnh PNG
// Sau đó tự dựng tensor [224, 224, 3] bằng tf.image.resizeBilinear.
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

// Kích thước đầu vào chuẩn của MobileNet
const IMAGE_SIZE = 224;

/**
 * Giải mã buffer ảnh (JPEG/PNG) thành mảng pixel RGBA.
 * @param {Buffer} buffer
 * @param {string} ext - phần mở rộng file ('.jpg', '.png', ...)
 * @returns {{ width:number, height:number, data:Uint8Array }}
 */
function decodeImage(buffer, ext = '') {
  const e = ext.toLowerCase();

  if (e === '.png') {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }

  // Mặc định coi là JPEG
  const raw = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
  return { width: raw.width, height: raw.height, data: raw.data };
}

/**
 * Chuyển mảng RGBA thô sang tensor RGB [h, w, 3] giá trị 0..255.
 * Bỏ kênh alpha vì MobileNet chỉ cần 3 kênh màu.
 */
function rgbaToTensor({ width, height, data }) {
  const pixels = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i += 1) {
    const k = i * 4;
    pixels[j++] = data[k];     // R
    pixels[j++] = data[k + 1]; // G
    pixels[j++] = data[k + 2]; // B
  }
  return tf.tensor3d(pixels, [height, width, 3], 'float32');
}

/**
 * Đọc ảnh từ đĩa -> tensor [224, 224, 3] giá trị 0..255.
 * @param {string} filePath
 * @param {number} size
 * @returns {tf.Tensor3D}
 */
function loadImageAsTensor(filePath, size = IMAGE_SIZE) {
  const buffer = fs.readFileSync(filePath);
  const decoded = decodeImage(buffer, path.extname(filePath));
  const tensor = rgbaToTensor(decoded);

  // Resize về 224x224 (giữ tỉ lệ bị bỏ qua — MobileNet dùng alignCorners)
  if (tensor.shape[0] !== size || tensor.shape[1] !== size) {
    const resized = tf.image.resizeBilinear(tensor, [size, size], true);
    tensor.dispose();
    return resized;
  }
  return tensor;
}

/**
 * Đọc ảnh từ buffer (dùng cho upload qua multer) -> tensor.
 * @param {Buffer} buffer
 * @param {string} ext
 * @param {number} size
 * @returns {tf.Tensor3D}
 */
function bufferToTensor(buffer, ext = '.jpg', size = IMAGE_SIZE) {
  const decoded = decodeImage(buffer, ext);
  const tensor = rgbaToTensor(decoded);
  if (tensor.shape[0] !== size || tensor.shape[1] !== size) {
    const resized = tf.image.resizeBilinear(tensor, [size, size], true);
    tensor.dispose();
    return resized;
  }
  return tensor;
}

module.exports = {
  IMAGE_SIZE,
  decodeImage,
  rgbaToTensor,
  loadImageAsTensor,
  bufferToTensor
};
