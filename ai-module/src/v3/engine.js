'use strict';
const path = require('path');
const { Worker } = require('worker_threads');
const { failure } = require('./quality');

function runAnalysis(files, { provider = 'clip', signal, timeoutMs = 150000,
  workerPath = path.join(__dirname, 'worker.js') } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { resourceLimits: { maxOldGenerationSizeMb: 768 } });
    let settled = false;
    const finish = async (err, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', abort);
      await worker.terminate();
      if (err) reject(err); else resolve(result);
    };
    const abort = () => finish(failure(499, 'AI_CANCELLED', 'Đã hủy phân tích.'));
    const timer = setTimeout(() => finish(failure(504, 'AI_TIMEOUT', 'Phân tích vượt thời gian cho phép. Thử ít ảnh hơn hoặc chuẩn bị model trước.')), timeoutMs);
    worker.once('message', message => {
      if (message.error) finish(failure(message.error.status, message.error.code, message.error.message));
      else finish(null, message.result);
    });
    worker.once('error', () => finish(failure(503, 'AI_WORKER_FAILED', 'Tiến trình AI không khả dụng.')));
    worker.once('exit', () => { if (!settled) finish(failure(503, 'AI_WORKER_EXIT', 'Tiến trình AI đã dừng trước khi có kết quả.')); });
    if (signal) signal.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ files, provider });
  });
}
module.exports = { runAnalysis };
