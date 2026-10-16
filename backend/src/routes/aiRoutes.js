const path = require('path');
const express = require('express');

// Nạp router xử lý AI từ ai-module an toàn (fallback nếu ai-module chưa cài dependencies)
let aiRoutes;
try {
  aiRoutes = require(path.join(__dirname, '../../../ai-module/src/routes/aiRoutes'));
} catch (err) {
  console.warn('[AI Module] Lưu ý: Không thể tải ai-module:', err.message);
  console.warn('[AI Module] Để sử dụng tính năng AI phân tích ảnh, hãy chạy "npm install" trong thư mục ai-module.');
  
  const fallbackRouter = express.Router();
  fallbackRouter.all('*', (req, res) => {
    res.status(503).json({
      success: false,
      code: 'AI_MODULE_UNAVAILABLE',
      message: 'Module AI phân tích ảnh hiện chưa khả dụng. Vui lòng cài đặt thư viện phụ thuộc bằng lệnh: cd ai-module && npm install',
      error: err.message
    });
  });
  aiRoutes = fallbackRouter;
}

module.exports = aiRoutes;
