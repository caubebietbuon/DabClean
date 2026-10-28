'use strict';
const { parentPort } = require('worker_threads');
const { analyzeBatch } = require('../v3/worker');
const { decorate } = require('./scoring');
parentPort.once('message', async ({ files, provider }) => {
  const started = performance.now();
  try {
    const local = provider === 'ollama' ? require('./ollamaProvider') : null;
    const result = decorate(await analyzeBatch(files, provider, local));
    result.runtime = { durationMs: Math.round(performance.now() - started), rssBytes: process.memoryUsage().rss };
    parentPort.postMessage({ result });
  } catch (err) {
    parentPort.postMessage({ error: err.status ? { status: err.status, code: err.code, message: err.message }
      : { status: 503, code: 'AI_V31_UNAVAILABLE', message: 'AI V3.1 local chưa khả dụng; không có kết quả thay thế.' } });
  }
});
