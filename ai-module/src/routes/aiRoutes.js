// ============================================================
// CLEANOVA AI MODULE - Routes API phân tích ảnh & báo giá
// Hỗ trợ cả 1 ảnh hoặc NHIỀU ẢNH (Multiple Images, tối đa 10 ảnh)
// ============================================================
const express = require('express');
const multer = require('multer');

const { analyzeMultipleImages } = require('../analyzer/aiVisionService');
const { analyzeImage, buildRecommendations } = require('../analyzer/imageAnalyzer');
const { calculatePrice, resolveDirtLevel } = require('../pricing/priceCalculator');
const { SERVICE_PACKAGES, DIRT_LEVELS, SURCHARGES } = require('../config/businessRules');

const router = express.Router();

// --- Cấu hình multer: giữ ảnh trong RAM, giới hạn 10MB/file, tối đa 10 ảnh ---
const maxBytes = parseInt(process.env.MAX_UPLOAD_BYTES, 10) || 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 10 },
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|png|webp|bmp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpeg, png, webp, bmp, gif).'));
    }
  }
});

// Middleware xử lý upload linh hoạt: chấp nhận field 'images', 'image' hoặc bất kỳ field nào
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

    // Thu thập danh sách file từ các trường có thể có
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files)) {
        files = req.files;
      } else {
        if (req.files.images) files = files.concat(req.files.images);
        if (req.files.image) files = files.concat(req.files.image);
      }
    } else if (req.file) {
      files = [req.file];
    }

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu file ảnh cần phân tích (vui lòng gửi vào field "images" hoặc "image").'
      });
    }

    req.collectedFiles = files;
    next();
  });
}

// ------------------------------------------------------------
// POST /api/ai/analyze
// Body: multipart/form-data, field "images" hoặc "image" (1 hoặc nhiều file)
// ------------------------------------------------------------
router.post('/analyze', handleUpload, async (req, res, next) => {
  try {
    const files = req.collectedFiles;
    const result = await analyzeMultipleImages(files, {
      areaSize: req.body.areaSize,
      urgency: req.body.urgency,
      extras: req.body.extras
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// POST /api/ai/estimate
// Body: multipart/form-data
//   - images / image  (1 hoặc nhiều ảnh, tối đa 10)
//   - areaSize        (số m2, tuỳ chọn)
//   - urgency         normal|soon|urgent (tuỳ chọn)
//   - extras          "disinfect,sofa_steam" (tuỳ chọn, cách nhau dấu phẩy)
// Trả về: phân tích đa ảnh chi tiết + báo giá tổng hợp
// ------------------------------------------------------------
router.post('/estimate', handleUpload, async (req, res, next) => {
  try {
    const files = req.collectedFiles;
    const extras = req.body.extras
      ? String(req.body.extras).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const result = await analyzeMultipleImages(files, {
      areaSize: req.body.areaSize,
      urgency: req.body.urgency,
      extras
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------
// GET /api/ai/services - Trả về bảng gói dịch vụ để frontend hiển thị
// ------------------------------------------------------------
router.get('/services', (req, res) => {
  res.json({
    success: true,
    data: { services: SERVICE_PACKAGES, dirtLevels: DIRT_LEVELS, surcharges: SURCHARGES }
  });
});

// ------------------------------------------------------------
// GET /api/ai/health
// ------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Cleanova AI Module',
    version: '2.0.0-multi-image',
    maxFiles: 10,
    analyzer: (process.env.ANALYZER || (process.env.GEMINI_API_KEY ? 'gemini-vision' : (process.env.OPENAI_API_KEY ? 'openai-vision' : 'builtin'))),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
