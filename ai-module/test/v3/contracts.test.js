'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { prepare } = require('../../src/v3/quality');
const { summarize, unavailable, CRITERIA } = require('../../src/v3/contract');
const { normalize, endpoint } = require('../../src/v3/ollamaProvider');
const { classification, mae, calibration, validateManifest, distance } = require('../../src/v3/benchmark');
const { groupSplit } = require('../../src/ml/groupSplit');

test('unknown is null, not zero; no image averaging or price surcharge', () => {
  const result = summarize([{ metrics: unavailable('occluded') }], 'clip');
  for (const m of result.images[0].metrics) {
    assert.equal(m.score, null); assert.equal(m.confidence, null); assert.equal(m.status, 'insufficient_data');
  }
  assert.equal(result.overallScore, null); assert.equal(result.aggregation.score, null);
  assert.equal(result.pricing.aiSurchargeApplied, false);
});
test('reject disguised text/SVG and truncated JPEG with 415', async () => {
  await assert.rejects(prepare(Buffer.from('<svg onload="alert(1)"></svg>')), { status: 415 });
  await assert.rejects(prepare(Buffer.from([255, 216, 255, ...new Array(40).fill(0)])), { status: 415 });
});
test('reject a decompression bomb by dimensions before decoding', async () => {
  const buffer = await sharp({ create: { width: 4100, height: 4000, channels: 3, background: '#aaa' } }).png().toBuffer();
  await assert.rejects(prepare(buffer), { status: 413 });
});
test('dark/white/low-resolution images request retake without inferring cleanliness', async () => {
  for (const [color, reason] of [['black', 'too_dark'], ['white', 'overexposed']]) {
    const buffer = await sharp({ create: { width: 100, height: 100, channels: 3, background: color } }).png().toBuffer();
    const result = await prepare(buffer);
    assert.equal(result.quality.usable, false);
    assert.ok(result.quality.warnings.includes(reason)); assert.ok(result.quality.warnings.includes('low_resolution'));
    assert.equal(result.quality.calibrated, false);
  }
});
test('normalization strips EXIF and enforces RGB/static output', async () => {
  const buffer = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#abc' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const result = await prepare(buffer), meta = await sharp(result.buffer).metadata();
  assert.equal(meta.orientation, undefined); assert.equal(meta.exif, undefined); assert.equal(meta.width, 200); assert.equal(meta.height, 300);
});
test('local VLM schema rejects missing/invalid evidence and never accepts self-reported scores', () => {
  assert.throws(() => normalize({ scene: 'room', criteria: {} }), { code: 'INVALID_MODEL_OUTPUT' });
  const criteria = Object.fromEntries(Object.keys(CRITERIA).map(key => [key,
    { state: 'concern', observation: 'Vết trên sàn', location: 'gần cửa', alternativeExplanation: 'có thể là bóng', score: 99, confidence: 1 }]));
  const result = normalize({ scene: 'room', criteria });
  assert.equal(result.metrics[0].score, null); assert.equal(result.metrics[0].confidence, null);
  assert.equal(result.metrics[0].evidence[0].alternativeExplanation, 'có thể là bóng');
  const notRoom = normalize({ scene: 'not_room', criteria });
  assert.ok(notRoom.metrics.every(m => m.candidate.state === 'unobservable' && m.evidence.length === 0));
});
test('VLM endpoint cannot send images off device or follow redirects', () => {
  const saved = process.env.AI_V3_OLLAMA_URL;
  try {
    for (const url of ['https://example.com', 'http://localhost:11434', 'http://127.0.0.1.evil.test', 'http://user:pass@127.0.0.1']) {
      process.env.AI_V3_OLLAMA_URL = url; assert.throws(endpoint, { code: 'LOCAL_PROVIDER_ONLY' });
    }
    process.env.AI_V3_OLLAMA_URL = 'http://127.0.0.1:11434'; assert.equal(endpoint().hostname, '127.0.0.1');
  } finally { if (saved === undefined) delete process.env.AI_V3_OLLAMA_URL; else process.env.AI_V3_OLLAMA_URL = saved; }
});
test('confusion/F1 counts abstention as missed truth; undefined precision stays null', () => {
  const result = classification(['concern', 'concern', 'clear'], ['concern', null, 'concern']);
  assert.equal(result.matrix.concern.abstain, 1); assert.equal(result.perClass.concern.precision, 0.5);
  assert.equal(result.perClass.concern.recall, 0.5); assert.equal(result.perClass.concern.f1, 0.5);
  assert.equal(result.perClass.clear.precision, null); assert.equal(result.abstentionRate, 1 / 3);
});
test('MAE/calibration exclude unknowns rather than converting them to zero', () => {
  assert.deepEqual(mae([[10, 20], [40, null], [null, 50]]), { n: 1, mae: 10 });
  assert.equal(calibration([{ confidence: null, correct: true }]).ece, null);
  assert.equal(calibration([{ confidence: 0.8, correct: true }, { confidence: 0.8, correct: false }]).ece, 0.30000000000000004);
  assert.equal(distance('0000000000000000', '000000000000000f'), 4);
});
test('manifest refuses missing data, room leakage, exact/near duplicates and one-reviewer labels', async () => {
  assert.equal((await validateManifest({ items: [] }, os.tmpdir())).ok, false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabclean-manifest-'));
  try {
    await sharp({ create: { width: 200, height: 200, channels: 3, background: 'green' } }).png().toFile(path.join(dir, 'a.png'));
    fs.copyFileSync(path.join(dir, 'a.png'), path.join(dir, 'b.png'));
    const labels = Object.fromEntries(Object.keys(CRITERIA).map(k => [k, { state: 'clear', score: 0 }]));
    const items = ['train', 'test'].map((split, i) => ({ id: String(i), roomId: 'same-room', split,
      file: i ? 'b.png' : 'a.png', challenge: 'many_ordered', annotators: ['one'], consensusReviewed: true, labels }));
    const result = await validateManifest({ unseenByLegacy: true, items }, dir);
    assert.equal(result.ok, false); assert.ok(result.errors.some(s => s.startsWith('ROOM_LEAKAGE')));
    assert.ok(result.errors.some(s => s.startsWith('DUPLICATE_OR_NEAR_DUPLICATE')));
    assert.ok(result.errors.some(s => s.startsWith('TWO_REVIEWERS_REQUIRED')));
    items[0].file = '../escape.png';
    assert.ok((await validateManifest({ unseenByLegacy: true, items }, dir)).errors.some(s => s.startsWith('PATH_OUTSIDE')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('same room with different labels and failed augmentation counts never splits across train/validation', () => {
  const labels = ['clean', 'dirty', 'clean', 'dirty', 'clean', 'dirty', 'clean', 'dirty'];
  const groups = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd'];
  const result = groupSplit(labels, groups, 0.5, 42);
  const train = new Set(result.trainIdx.map(i => groups[i]));
  assert.ok(result.valIdx.every(i => !train.has(groups[i])));
  assert.deepEqual(result, groupSplit(labels, groups, 0.5, 42));
  assert.throws(() => groupSplit(['clean'], ['a']), /at least two/);
  assert.throws(() => groupSplit(labels, groups.slice(1)), /Invalid split/);
});
