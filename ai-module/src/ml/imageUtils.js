// ============================================================
// DABCLEAN AI MODULE - Tiện ích đọc ảnh -> Tensor
// ============================================================
// VÌ SAO KHÔNG DÙNG tf.node.decodeImage?
// Bản @tensorflow/tfjs thuần JavaScript KHÔNG có đối tượng `tf.node`
// (kiểm chứng: typeof tf.node === 'undefined'). `tf.node` chỉ tồn tại ở
// @tensorflow/tfjs-node — mà gói đó không có prebuilt binary cho Node 24
// và máy thiếu Visual Studio để build từ source.
//
// CÁCH GIẢI MÃ ẢNH — hai tầng:
//
//   Tầng 1 (chính): `sharp` — thư viện native, hỗ trợ JPEG/PNG/WebP/GIF/BMP/
//     TIFF/HEIC/SVG. Nó còn RESIZE luôn về 224x224 trong lúc giải mã nên
//     nhanh hơn hẳn so với giải mã ảnh gốc rồi resize bằng tfjs.
//
//   Tầng 2 (dự phòng): jpeg-js + pngjs — thuần JS, chỉ JPEG/PNG. Dùng khi
//     sharp không nạp được (thiếu binary native trên máy khác).
//
// ⚠️ LỖI ĐÃ TỪNG GẶP: multer cho phép webp/bmp/gif qua, nhưng bộ giải mã chỉ
// có JPEG/PNG. Ảnh WebP rơi vào jpeg-js -> ném "SOI not found" (SOI = Start
// Of Image, marker 0xFFD8 của JPEG). Thông báo đó vô nghĩa với người dùng.
// Nay định dạng được nhận diện bằng MAGIC BYTES và thông báo lỗi rõ ràng.
// ============================================================

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

// Kích thước đầu vào chuẩn của MobileNet
const IMAGE_SIZE = 224;

// --- Nạp sharp một lần, có thể thất bại (thiếu binary native) ---
let _sharp = null;
let _sharpChecked = false;
function getSharp() {
  if (_sharpChecked) return _sharp;
  _sharpChecked = true;
  try {
    _sharp = require('sharp');
  } catch (err) {
    console.warn('[imageUtils] Không nạp được sharp, dùng bộ giải mã thuần JS (chỉ JPEG/PNG):', err.message);
    _sharp = null;
  }
  return _sharp;
}

// ------------------------------------------------------------
// Nhận diện định dạng ảnh bằng MAGIC BYTES (chữ ký nhị phân)
// ------------------------------------------------------------
// ⚠️ KHÔNG tin vào phần mở rộng file hay MIME type do trình duyệt gửi —
// cả hai đều có thể sai (ảnh .webp đổi tên thành .jpg, hoặc MIME bị đoán sai).
// Chỉ magic bytes mới là sự thật.
function sniffFormat(buffer) {
  if (!buffer || buffer.length < 12) return 'unknown';

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';

  // GIF: "GIF87a" hoặc "GIF89a"
  if (buffer.toString('ascii', 0, 3) === 'GIF') return 'gif';

  // WebP: "RIFF" .... "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';

  // BMP: "BM"
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'bmp';

  // HEIC/HEIF (ảnh iPhone) và AVIF: đều là ISO-BMFF, có box "ftyp" ở offset 4
  const ftyp = buffer.toString('ascii', 4, 8);
  if (ftyp === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['avif', 'avis'].includes(brand)) return 'avif';
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }

  // TIFF: "II*\0" (little-endian) hoặc "MM\0*" (big-endian)
  if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a)
    || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00)) return 'tiff';

  return 'unknown';
}

// Tên định dạng để hiển thị cho người dùng
const FORMAT_LABEL = {
  jpeg: 'JPEG', png: 'PNG', gif: 'GIF', webp: 'WebP',
  bmp: 'BMP', heic: 'HEIC/HEIF (ảnh iPhone)', tiff: 'TIFF',
  avif: 'AVIF', unknown: 'không xác định'
};

// Lỗi có thông báo tiếng Việt rõ ràng, kèm mã HTTP để tầng trên trả về
class UnsupportedImageError extends Error {
  constructor(format, detail) {
    const label = FORMAT_LABEL[format] || format;
    super(
      `Không đọc được ảnh (định dạng nhận diện: ${label}). `
      + 'File có thể bị hỏng hoặc không phải ảnh. '
      + 'Vui lòng dùng ảnh JPG, PNG, WebP, GIF, BMP hoặc TIFF.'
      + (detail ? ` [chi tiết: ${detail}]` : '')
    );
    this.name = 'UnsupportedImageError';
    this.format = format;
    this.status = 415; // Unsupported Media Type
  }
}

// Định dạng mà bộ giải mã DỰ PHÒNG (thuần JS) xử lý được
const FALLBACK_FORMATS = ['jpeg', 'png'];

/**
 * Giải mã buffer ảnh ĐỒNG BỘ — chỉ JPEG/PNG (bộ giải mã thuần JS).
 *
 * ⚠️ Đây KHÔNG phải đường đi chính. Dùng `decodeImageAsync` để có hỗ trợ
 * WebP/GIF/BMP/TIFF/HEIC qua sharp. Hàm này giữ lại cho trường hợp cần
 * đồng bộ hoặc khi sharp không nạp được.
 *
 * @param {Buffer} buffer
 * @param {string} [_ext] - không dùng nữa, giữ để tương thích chữ ký cũ
 * @returns {{ width:number, height:number, data:Uint8Array }}
 * @throws {UnsupportedImageError} khi định dạng không giải mã được
 */
function decodeImage(buffer, _ext = '') {
  const format = sniffFormat(buffer);

  if (format === 'png') {
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }

  if (format === 'jpeg') {
    const raw = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    return { width: raw.width, height: raw.height, data: raw.data };
  }

  // WebP/GIF/BMP/HEIC/TIFF/không xác định: báo lỗi RÕ RÀNG thay vì
  // để jpeg-js ném "SOI not found" khó hiểu.
  throw new UnsupportedImageError(format,
    getSharp() ? 'định dạng này cần sharp (hãy dùng decodeImageAsync)' : 'chưa cài sharp');
}

/**
 * Giải mã ảnh BẤT ĐỒNG BỘ (đường đi chính, dùng sharp).
 * Nhanh hơn và hỗ trợ WebP/GIF/BMP/TIFF/HEIC. Tự resize về `size`x`size`.
 * @param {Buffer} buffer
 * @param {number} size
 * @returns {Promise<{width:number, height:number, data:Uint8Array}>}
 */
async function decodeImageAsync(buffer, size = IMAGE_SIZE) {
  const format = sniffFormat(buffer);
  const sharp = getSharp();

  if (sharp) {
    try {
      const out = await sharp(buffer, { failOn: 'none' })
        .rotate()                                   // tôn trọng EXIF orientation
        .resize(size, size, { fit: 'fill' })        // MobileNet cần đúng 224x224
        .removeAlpha()                              // bỏ kênh alpha -> RGB
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { width: out.info.width, height: out.info.height, data: out.data };
    } catch (err) {
      // sharp đọc được định dạng nhưng file hỏng -> báo lỗi rõ ràng
      throw new UnsupportedImageError(format, err.message);
    }
  }

  // Dự phòng: chỉ JPEG/PNG, và KHÔNG resize ở đây (resize bằng tfjs ở dưới)
  return decodeImage(buffer);
}

/**
 * Chuyển mảng RGBA thô sang tensor RGB [h, w, 3] giá trị 0..255.
 * Bỏ kênh alpha vì MobileNet chỉ cần 3 kênh màu.
 * Tự nhận cả 3 kênh (RGB) lẫn 4 kênh (RGBA).
 */
function rgbaToTensor({ width, height, data }, channels = 4) {
  const pixels = new Float32Array(width * height * 3);
  if (channels === 3) {
    pixels.set(data.subarray(0, width * height * 3));
    return tf.tensor3d(pixels, [height, width, 3], 'float32');
  }
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
 * @returns {Promise<tf.Tensor3D>}
 */
async function loadImageAsTensor(filePath, size = IMAGE_SIZE) {
  const buffer = fs.readFileSync(filePath);
  return bufferToTensor(buffer, path.extname(filePath), size);
}

/**
 * Đọc ảnh từ buffer (dùng cho upload qua multer) -> tensor [224,224,3].
 *
 * BẤT ĐỒNG BỘ: ưu tiên sharp (đã resize sẵn 224x224), nếu không có thì
 * dùng bộ giải mã thuần JS rồi resize bằng tfjs.
 *
 * @param {Buffer} buffer
 * @param {string} ext
 * @param {number} size
 * @returns {Promise<tf.Tensor3D>}
 */
async function bufferToTensor(buffer, ext = '.jpg', size = IMAGE_SIZE) {
  const sharp = getSharp();

  if (sharp) {
    const decoded = await decodeImageAsync(buffer, size);
    // sharp đã trả RGB 3 kênh, đúng kích thước
    return rgbaToTensor(decoded, 3);
  }

  const decoded = decodeImage(buffer, ext);
  const tensor = rgbaToTensor(decoded, 4);
  if (tensor.shape[0] !== size || tensor.shape[1] !== size) {
    const resized = tf.image.resizeBilinear(tensor, [size, size], true);
    tensor.dispose();
    return resized;
  }
  return tensor;
}

module.exports = {
  IMAGE_SIZE,
  sniffFormat,
  FORMAT_LABEL,
  FALLBACK_FORMATS,
  UnsupportedImageError,
  decodeImage,
  decodeImageAsync,
  rgbaToTensor,
  loadImageAsTensor,
  bufferToTensor
};
