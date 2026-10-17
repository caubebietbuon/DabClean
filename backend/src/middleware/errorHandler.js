// ============================================================
// DABCLEAN BACKEND - Error Handling Middleware
// ============================================================

// Xử lý route không tồn tại (404)
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `API endpoint không tồn tại: ${req.method} ${req.originalUrl}`
  });
}

// Xử lý lỗi toàn cục hệ thống (500)
function errorHandler(err, req, res, next) {
  console.error('[Internal Server Error]', err);

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd && statusCode === 500
    ? 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng liên hệ bộ phận hỗ trợ.'
    : (err.message || 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.');

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProd && { stack: err.stack, details: err.sqlMessage || err.message })
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
