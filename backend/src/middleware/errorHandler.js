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

// Hàm làm sạch dữ liệu nhạy cảm trước khi log
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'confirm_password', 'token', 'authorization', 'cookie', 'secret', 'credit_card'];
  for (const k of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof sanitized[k] === 'object' && sanitized[k] !== null) {
      sanitized[k] = sanitizeForLog(sanitized[k]);
    }
  }
  return sanitized;
}

// Xử lý lỗi toàn cục hệ thống (Bug 14: Bảo vệ không rò rỉ stack trace & SQL details)
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  // Log an toàn ở server log (không log mật khẩu hoặc token)
  const reqInfo = {
    method: req.method,
    url: req.originalUrl,
    userId: req.user ? req.user.id : null,
    body: sanitizeForLog(req.body)
  };
  console.error(`[Error ${statusCode}] ${reqInfo.method} ${reqInfo.url}:`, err.message || err);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  // Thông báo trả về client: Ở production/test/unset, lỗi 500 luôn trả thông báo chung, không lộ schema/SQL
  let clientMessage = err.message || 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.';
  if (!isDev && statusCode >= 500) {
    clientMessage = 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng liên hệ bộ phận hỗ trợ.';
  }

  const responseBody = {
    success: false,
    message: clientMessage
  };

  if (err.code && typeof err.code === 'string') {
    responseBody.code = err.code;
  }

  // Chỉ bao gồm stack trace và chi tiết SQL khi rõ ràng là môi trường development
  if (isDev) {
    responseBody.stack = err.stack;
    if (err.sqlMessage || err.sql) {
      responseBody.details = err.sqlMessage || err.sql;
    }
  }

  res.status(statusCode).json(responseBody);
}

module.exports = {
  notFoundHandler,
  errorHandler,
  sanitizeForLog
};
