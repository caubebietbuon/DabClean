// ============================================================
// CLEANOVA AI MODULE - Routes API
// ============================================================
// Endpoint chính: POST /api/ai/scan      -> quét ảnh, trả độ bẩn
// Endpoint phụ  : POST /api/ai/estimate  -> quét ảnh + báo giá
// ============================================================

const express = require('express');
const multer = require('multer');
const path = require('path');

const {
  predictBuffer,
  modelExists,
  readMetadata,
  DEFAULT_MODEL_DIR
} = require('../../predict');

const { calculatePrice } = require('../pricing/priceCalculator');
const {
  SERVICE_PACKAGES,
  DIRT_LEVELS,
  SURCHARGES
} = require('../config/businessRules');
const { LABEL_DISPLAY, LABEL_COLOR } = require('../ml/labels');

const router = express.Router();

// ------------------------------------------------------------
// Cấu hình multer: giữ ảnh trong RAM
// ------------------------------------------------------------
// Đây chỉ là lớp LỌC THÔ. MIME type do trình duyệt gửi KHÔNG đáng tin:
//   - Ảnh .webp đổi tên thành .jpg vẫn được gửi là image/jpeg
//   - Ảnh tải từ một số nguồn bị gửi là application/octet-stream
//   - Một số trình duyệt/OS không gán MIME (chuỗi rỗng)
// Nên ta chấp nhận nếu MIME là ảnh HOẶC đuôi file trông như ảnh.
//
// Lớp kiểm tra THẬT SỰ nằm ở `sniffFormat()` trong imageUtils.js — đọc MAGIC
// BYTES. Nếu file không phải ảnh, nó sẽ báo lỗi tiếng Việt rõ ràng (HTTP 415).
const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic|heif|jfif)$/i;
const ALLOWED_IMAGE_MIME = /^image\//i;

const maxBytes = parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 10 },
  fileFilter(req, file, cb) {
    const mimeOk = ALLOWED_IMAGE_MIME.test(file.mimetype || '');
    const extOk = IMAGE_EXT_RE.test(file.originalname || '');

    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error(
        `File "${file.originalname}" không phải ảnh `
        + `(MIME: ${file.mimetype || 'không rõ'}). `
        + 'Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF, BMP, TIFF.'
      ));
    }
  }
});

// Chấp nhận cả field "image" và "images"
const uploadMiddleware = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 10 }
]);

function handleUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE'
          ? 'Ảnh quá lớn, dung lượng tối đa cho phép là 10MB mỗi ảnh.'
          : err.message
      });
    }

    let files = [];
    if (req.files) {
      if (req.files.images) files = files.concat(req.files.images);
      if (req.files.image) files = files.concat(req.files.image);
    }

    // Khử TRÙNG LẶP.
    // Vì sao cần: client cũ gửi mỗi ảnh vào CẢ hai field "images" và "image"
    // để "tương thích ngược", nên cùng một file xuất hiện 2 lần -> server
    // phân tích 2 lần (soAnh=2), tốn gấp đôi thời gian mà kết quả không đổi.
    // Nhận diện trùng bằng tên file + kích thước (multer không cho hash).
    const seen = new Set();
    files = files.filter(f => {
      const key = `${f.originalname}::${f.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu file ảnh (vui lòng gửi vào field "image" hoặc "images").'
      });
    }

    req.collectedFiles = files;
    next();
  });
}

// Đảm bảo model đã được train trước khi phục vụ
function requireModel(req, res, next) {
  if (!modelExists()) {
    return res.status(503).json({
      success: false,
      code: 'MODEL_NOT_TRAINED',
      message: 'Model chưa được huấn luyện. Hãy chạy "node train.js" trong thư mục ai-module trước.',
      modelDir: DEFAULT_MODEL_DIR
    });
  }
  next();
}

const round4 = (v) => Math.round(v * 10000) / 10000;

// ============================================================
// POST /api/ai/scan
// ============================================================
// Nhận 1 (hoặc nhiều) ảnh chụp căn phòng -> trả về độ bẩn.
//
// Request : multipart/form-data, field "image" (hoặc "images")
// Response:
//   {
//     "success": true,
//     "data": {
//       "diem": 72.4,                  // điểm bẩn 0-100
//       "phanLoai": "rat-ban",         // sach | hoi-ban | rat-ban
//       "doTinCay": {                  // độ tin cậy từng loại (0..1)
//         "sach": 0.02, "hoiBan": 0.11, "ratBan": 0.87
//       },
//       "phanLoaiHienThi": "Rất bẩn",
//       "mauSac": "#EF4444",
//       "ketQuaTungAnh": [ ... ]       // chỉ có khi gửi nhiều ảnh
//     }
//   }
// ============================================================
router.post('/scan', requireModel, handleUpload, async (req, res, next) => {
  try {
    const files = req.collectedFiles;
    const perImage = [];

    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const result = await predictBuffer(file.buffer, ext);
      perImage.push({ filename: file.originalname, ...result });
    }

    const n = perImage.length;

    // Nhiều ảnh -> lấy trung bình điểm & trung bình độ tin cậy
    const diem = perImage.reduce((s, r) => s + r.diem, 0) / n;
    const avgConf = {
      sach: perImage.reduce((s, r) => s + r.doTinCay.sach, 0) / n,
      hoiBan: perImage.reduce((s, r) => s + r.doTinCay.hoiBan, 0) / n,
      ratBan: perImage.reduce((s, r) => s + r.doTinCay.ratBan, 0) / n
    };

    // Suy phân loại TỪ ĐIỂM SỐ để luôn nhất quán giữa `diem` và `phanLoai`.
    //
    // (Trước đây lấy lớp có độ tin cậy trung bình cao nhất, nhưng cách đó
    //  cho kết quả vô lý khi 2 ảnh trái ngược nhau: điểm trung bình 50 —
    //  đúng ra là "hơi bẩn" — lại bị gán thành "sạch" do chênh lệch 0.001.)
    const phanLoai = diem < 35 ? 'sach' : (diem < 65 ? 'hoi-ban' : 'rat-ban');

    res.json({
      success: true,
      data: {
        diem: Math.round(diem * 10) / 10,
        phanLoai,
        doTinCay: {
          sach: round4(avgConf.sach),
          hoiBan: round4(avgConf.hoiBan),
          ratBan: round4(avgConf.ratBan)
        },
        phanLoaiHienThi: LABEL_DISPLAY[phanLoai] || phanLoai,
        mauSac: LABEL_COLOR[phanLoai] || '#10B981',
        soAnh: n,
        ketQuaTungAnh: n > 1 ? perImage : undefined
      }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// POST /api/ai/estimate  (scan + báo giá)
// ============================================================
// Thêm các field tuỳ chọn: areaSize, urgency, extras
// ============================================================
router.post('/estimate', requireModel, handleUpload, async (req, res, next) => {
  try {
    const files = req.collectedFiles;
    const perImage = [];

    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      perImage.push(await predictBuffer(file.buffer, ext));
    }

    const n = perImage.length;
    const diem = Math.round((perImage.reduce((s, r) => s + r.diem, 0) / n) * 10) / 10;

    // Suy phân loại từ điểm trung bình (nhất quán với `diem` khi gửi nhiều ảnh)
    const phanLoai = diem < 35 ? 'sach' : (diem < 65 ? 'hoi-ban' : 'rat-ban');

    // Bắc cầu sang module tính giá: nó nhận trường `overallScore`
    const quote = calculatePrice({ overallScore: diem }, {
      areaSize: req.body.areaSize,
      urgency: req.body.urgency,
      extras: req.body.extras
        ? String(req.body.extras).split(',').map(s => s.trim()).filter(Boolean)
        : []
    });

    res.json({
      success: true,
      data: {
        scan: {
          diem,
          phanLoai,
          doTinCay: perImage[0].doTinCay,
          phanLoaiHienThi: LABEL_DISPLAY[phanLoai] || phanLoai,
          mauSac: LABEL_COLOR[phanLoai] || '#10B981',
          soAnh: n
        },
        quote
      }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/ai/model-info
// ============================================================
router.get('/model-info', (req, res) => {
  res.json({
    success: true,
    data: {
      trained: modelExists(),
      modelDir: DEFAULT_MODEL_DIR,
      metadata: readMetadata()
    }
  });
});

// ============================================================
// GET /api/ai/services
// ============================================================
router.get('/services', (req, res) => {
  res.json({
    success: true,
    data: {
      services: SERVICE_PACKAGES,
      dirtLevels: DIRT_LEVELS,
      surcharges: SURCHARGES
    }
  });
});

// ============================================================
// GET /api/ai/health
// ============================================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Cleanova AI Module',
    engine: 'tensorflow.js - MobileNet transfer learning',
    modelTrained: modelExists(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
