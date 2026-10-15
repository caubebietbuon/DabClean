// ============================================================
// CLEANOVA BACKEND - Route AI Vision Adapter
// Tích hợp trực tiếp module AI Vision phân tích đa ảnh vào Backend chính
// ============================================================
const path = require('path');

// Nạp router xử lý AI từ ai-module
const aiRoutes = require(path.join(__dirname, '../../../ai-module/src/routes/aiRoutes'));

module.exports = aiRoutes;
