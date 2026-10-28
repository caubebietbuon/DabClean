'use strict';
const { parentPort } = require('worker_threads');
const { predictBuffer } = require('../../predict');
parentPort.once('message', async ({ files }) => {
  const started = performance.now();
  try {
    const images = [];
    for (const file of files) images.push(await predictBuffer(Buffer.from(file.buffer), '.jpg', { mode: 'whole' }));
    parentPort.postMessage({ result: { images, durationMs: performance.now() - started } });
  } catch {
    parentPort.postMessage({ error: { status: 503, code: 'LEGACY_MODEL_UNAVAILABLE',
      message: 'Không nạp/chạy được model legacy hoặc backbone. Không có kết quả đối chiếu thay thế.' } });
  }
});
