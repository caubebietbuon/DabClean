'use strict';
const { parentPort } = require('worker_threads');
const { prepare } = require('./quality');
const { unavailable, summarize } = require('./contract');

async function analyzeBatch(files, providerName, providerOverride = null) {
  const provider = providerOverride || require(providerName === 'ollama' ? './ollamaProvider' : './clipProvider');
  const images = [], seen = new Map();
  for (const [index, file] of files.entries()) {
    const prepared = await prepare(Buffer.from(file.buffer));
    const base = { id: index + 1, filename: file.filename, quality: prepared.quality };
    if (seen.has(prepared.hash)) {
      images.push({ ...base, duplicateOf: seen.get(prepared.hash), status: 'duplicate',
        metrics: unavailable('Ảnh trùng nội dung đã được phân tích; không tính thêm một lần.') });
      continue;
    }
    seen.set(prepared.hash, base.id);
    if (!prepared.quality.usable) {
      images.push({ ...base, status: 'retake_required', scene: { status: 'not_evaluated' },
        metrics: unavailable('Ảnh không qua sàng lọc chất lượng; chụp lại rõ nét, đủ sáng và đủ toàn cảnh.') });
      continue;
    }
    const result = await provider.analyze(prepared.buffer);
    images.push({ ...base, status: 'experimental_observations', ...result });
  }
  return summarize(images, providerName);
}

if (parentPort && require.main === module) parentPort.once('message', async ({ files, provider }) => {
  const start = performance.now();
  try {
    const result = await analyzeBatch(files, provider);
    result.runtime = { durationMs: Math.round(performance.now() - start), rssBytes: process.memoryUsage().rss,
      note: 'RSS tiến trình tại thời điểm kết thúc; không phải peak riêng của worker.' };
    parentPort.postMessage({ result });
  } catch (err) {
    // Only allowlisted errors cross the worker boundary; no file paths, native traces or image data.
    parentPort.postMessage({ error: err.status ? { status: err.status, code: err.code, message: err.message }
      : { status: 503, code: 'AI_V3_UNAVAILABLE', message: 'Không nạp hoặc chạy được mô hình local. Chuẩn bị model/cache theo hướng dẫn AI V3 rồi thử lại.' } });
  }
});
module.exports = { analyzeBatch };
