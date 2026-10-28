'use strict';
const express = require('express');
const multer = require('multer');
const { runAnalysis } = require('./engine');
const { CRITERIA } = require('./contract');

const MAX_FILE_BYTES = 6 * 1024 * 1024, MAX_FILES = 4;
const upload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 0, parts: MAX_FILES
} }).fields([{ name: 'images', maxCount: MAX_FILES }, { name: 'image', maxCount: MAX_FILES }]);

// Factory allows contract tests with an injected runner. Production ALWAYS uses the real worker.
function createRouter({ run = runAnalysis, version = '3.0', providerEnv = 'AI_V3_PROVIDER',
  enabledEnv = 'AI_V3_ENABLED', defaultProvider = 'clip', capabilities = {} } = {}) {
  const router = express.Router();
  let busy = false;
  const clients = new Map();
  router.get('/capabilities', (req, res) => res.json({ success: true, data: {
    schemaVersion: version, enabled: process.env[enabledEnv] !== 'false', experimental: true,
    provider: process.env[providerEnv] || defaultProvider, calibrated: false,
    criteria: CRITERIA, maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES,
    localOnly: true, modelReadiness: 'not_probed', aggregation: 'per_image_only', automaticPricing: false,
    ...capabilities
  } }));
  router.post('/analyze', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const error = (status, code, message) => res.status(status).json({ success: false, code, message });
    const provider = process.env[providerEnv] || defaultProvider;
    if (process.env[enabledEnv] === 'false') return error(503, 'AI_V3_DISABLED', 'AI đang được tắt bằng cấu hình.');
    if (!['clip', 'ollama'].includes(provider)) return error(503, 'AI_V3_CONFIG', 'Provider V3 chưa được cấu hình hợp lệ.');
    const now = Date.now(), key = req.socket.remoteAddress || 'unknown';
    for (const [ip, value] of clients) if (value.until < now) clients.delete(ip);
    if (!clients.has(key) && clients.size >= 1000) return error(429, 'AI_RATE_LIMIT', 'Hệ thống đang bận, vui lòng thử lại sau.');
    const quota = clients.get(key) || { count: 0, until: now + 60000 };
    clients.set(key, quota);
    if (++quota.count > 10) { res.set('Retry-After', '60'); return error(429, 'AI_RATE_LIMIT', 'Tối đa 10 yêu cầu AI mỗi phút.'); }
    if (busy) { res.set('Retry-After', '5'); return error(429, 'AI_BUSY', 'Đang xử lý một lượt quét. Vui lòng thử lại sau.'); }
    const reservation = Symbol('analysis');
    busy = reservation;
    let running = false;
    const release = () => { if (busy === reservation) busy = false; };
    const controller = new AbortController();
    const uploadTimeout = setTimeout(() => {
      if (!res.headersSent) error(408, 'UPLOAD_TIMEOUT', 'Tải ảnh vượt thời gian cho phép.');
      controller.abort(); req.destroy();
    }, 30000);
    const close = () => { controller.abort(); clearTimeout(uploadTimeout); if (!running) release(); };
    res.once('close', close);
    upload(req, res, async err => {
      clearTimeout(uploadTimeout);
      try {
        if (controller.signal.aborted) return;
        if (err) return error(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_LIMIT', 'Chỉ nhận tối đa 4 ảnh tĩnh, mỗi ảnh 6 MB; dùng field image hoặc images và không gửi field khác.');
        const files = [...(req.files?.images || []), ...(req.files?.image || [])];
        if (!files.length) return error(400, 'IMAGE_REQUIRED', 'Chọn ít nhất một ảnh.');
        running = true;
        const result = await run(files.map(file => ({ filename: file.originalname.slice(0, 180), buffer: file.buffer })),
          { provider, signal: controller.signal });
        if (!controller.signal.aborted) res.json({ success: true, data: result });
      } catch (err) {
        if (!controller.signal.aborted) error(err.status || 503, err.code || 'AI_V3_UNAVAILABLE',
          err.status ? err.message : 'AI local hiện không khả dụng. Không tạo kết quả thay thế.');
      } finally {
        req.files = null;
        release();
      }
    });
  });
  return router;
}
module.exports = { createRouter, MAX_FILES, MAX_FILE_BYTES };
