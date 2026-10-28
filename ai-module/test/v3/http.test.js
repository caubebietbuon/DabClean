'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const sharp = require('sharp');
const { createRouter } = require('../../src/v3/routes');
const { summarize, unavailable } = require('../../src/v3/contract');
const { runAnalysis } = require('../../src/v3/engine');

async function serve(router, fn) {
  const app = express(); app.use('/api/ai/v3', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const form = (count = 1, buffer = Buffer.from('not-an-image'), name = 'test.png') => {
  const data = new FormData(); for (let i = 0; i < count; i++) data.append('images', new Blob([buffer], { type: 'image/png' }), name); return data;
};

test('real worker rejects disguised upload and returns honest retake for dark image', async () => {
  await serve(createRouter(), async base => {
    const bad = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() });
    assert.equal(bad.status, 415); assert.equal((await bad.json()).code, 'IMAGE_FORMAT');
    const buffer = await sharp({ create: { width: 300, height: 300, channels: 3, background: 'black' } }).png().toBuffer();
    const good = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form(2, buffer) });
    assert.equal(good.status, 200); assert.equal(good.headers.get('cache-control'), 'no-store');
    const result = (await good.json()).data;
    assert.equal(result.images[0].status, 'retake_required'); assert.equal(result.images[1].duplicateOf, 1);
    assert.equal(result.images[0].metrics[0].score, null); assert.equal(result.aggregation.score, null);
  });
});
test('upload missing, file count, byte count, extra fields and MIME spoofing limits', async () => {
  let invoked = 0;
  await serve(createRouter({ run: async () => { invoked++; return summarize([], 'test-only'); } }), async base => {
    const post = body => fetch(base + '/api/ai/v3/analyze', { method: 'POST', body });
    assert.equal((await post(new FormData())).status, 400);
    assert.equal((await post(form(5))).status, 400);
    assert.equal((await post(form(1, Buffer.alloc(6 * 1024 * 1024 + 1)))).status, 413);
    const extra = form(); extra.append('provider', 'evil'); assert.equal((await post(extra)).status, 400);
    assert.equal(invoked, 0);
    assert.equal((await post(form(4))).status, 200); assert.equal(invoked, 1);
  });
});
test('same filenames do not discard different image content (regression)', async () => {
  await serve(createRouter(), async base => {
    const data = new FormData();
    for (const background of ['black', 'white']) {
      const buffer = await sharp({ create: { width: 200, height: 200, channels: 3, background } }).png().toBuffer();
      data.append('images', new Blob([buffer], { type: 'image/png' }), 'same-name.png');
    }
    const response = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: data });
    assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.equal(result.images.length, 2); assert.equal(result.images[1].duplicateOf, undefined);
  });
});
test('admission control rejects concurrent requests instead of accumulating uploads', async () => {
  let release, entered;
  const start = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  await serve(createRouter({ run: async () => { entered(); await wait; return summarize([{ metrics: unavailable('test') }], 'test-only'); } }), async base => {
    const first = fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() }); await start;
    try {
      const second = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() });
      assert.equal(second.status, 429); assert.equal((await second.json()).code, 'AI_BUSY');
    } finally { release(); await first; }
  });
});
test('model error never becomes a fake successful response or a stack trace', async () => {
  await serve(createRouter({ run: async () => { throw new Error('private path and native stack'); } }), async base => {
    const response = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() });
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private path'));
  });
});
test('V3 rate limit and disable switch', async () => {
  await serve(createRouter({ run: async () => summarize([], 'test-only') }), async base => {
    for (let i = 0; i < 10; i++) await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: new FormData() });
    assert.equal((await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() })).status, 429);
  });
  const old = process.env.AI_V3_ENABLED; process.env.AI_V3_ENABLED = 'false';
  try { await serve(createRouter(), async base => {
    assert.equal((await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form() })).status, 503);
  }); } finally { if (old === undefined) delete process.env.AI_V3_ENABLED; else process.env.AI_V3_ENABLED = old; }
});
test('hard worker timeout and cancellation actually terminate computation', async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabclean-worker-'));
  const file = path.join(dir, 'busy.js');
  fs.writeFileSync(file, 'while(true) {}');
  try {
    await assert.rejects(runAnalysis([], { workerPath: file, timeoutMs: 100 }), { code: 'AI_TIMEOUT' });
    const controller = new AbortController();
    const pending = runAnalysis([], { workerPath: file, signal: controller.signal });
    controller.abort(); await assert.rejects(pending, { code: 'AI_CANCELLED' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('V3.1 route exposes policy and returns six unknown criteria through real worker without VLM on dark input', async () => {
  const { createV31Router } = require('../../src/v31/routes');
  await serve(createV31Router(), async base => {
    const caps = await (await fetch(base + '/api/ai/v3/capabilities')).json();
    assert.equal(caps.data.schemaVersion, '3.1'); assert.equal(caps.data.scoringPolicy.weights.dust, .2);
    const buffer = await sharp({ create: { width: 200, height: 200, channels: 3, background: 'black' } }).png().toBuffer();
    const response = await fetch(base + '/api/ai/v3/analyze', { method: 'POST', body: form(1, buffer) });
    assert.equal(response.status, 200); const data = (await response.json()).data;
    assert.equal(data.schemaVersion, '3.1'); assert.equal(data.images[0].metrics.length, 6);
    assert.equal(data.conclusion.label, 'CHƯA ĐỦ DỮ LIỆU'); assert.equal(data.conclusion.score, null);
  });
});
