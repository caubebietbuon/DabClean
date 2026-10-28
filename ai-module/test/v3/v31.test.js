'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { parseHTML } = require('linkedom');
const { KEYS, POLICY, conclude, decorate } = require('../../src/v31/scoring');
const { buildArtifact, estimate } = require('../../src/v31/calibration');
const { normalize } = require('../../src/v31/ollamaProvider');
const { summarize, unavailable } = require('../../src/v3/contract');
const { overallMetrics } = require('../../scripts/benchmark-v31');

// Artificial fixtures exercise code paths ONLY; they are not labelled photographs or accuracy evidence.
function fixture(score) {
  return KEYS.map(key => ({ key, label: key, score, status: 'assessed', confidence: null,
    validation: { status: 'validated', calibrationId: 'UNIT-TEST-ONLY' },
    evidence: [{ kind: 'calibrated_visual_observation', text: 'UNIT TEST fixture', location: 'fixture' }] }));
}
test('V3.1 weights sum to one; all three classes and decimal boundaries use specified weights', () => {
  assert.equal(Object.values(POLICY.weights).reduce((a, b) => a + b), 1);
  for (const [score, label] of [[0, 'SẠCH'], [29.9, 'SẠCH'], [30, 'HƠI BẨN'], [59.9, 'HƠI BẨN'], [60, 'RẤT BẨN'], [100, 'RẤT BẨN']]) {
    assert.equal(conclude(fixture(score)).label, label); assert.equal(conclude(fixture(score)).score, score);
  }
  const metrics = fixture(10); metrics.find(m => m.key === 'dust').score = 20;
  assert.equal(conclude(metrics).score, 12);
});
test('missing, null, malformed, unsupported, or low-confidence criterion blocks the entire conclusion', () => {
  assert.equal(conclude(fixture(0).slice(1)).classification, null);
  for (const value of [null, NaN, Infinity, -1, 101, '0']) {
    const metrics = fixture(0); metrics[0].score = value;
    assert.equal(conclude(metrics).score, null);
  }
  const metrics = fixture(0); metrics[0].confidence = .2; metrics[0].confidenceStatus = 'calibrated';
  assert.equal(conclude(metrics).classification, null);
  metrics[0].confidence = 1; metrics[0].confidenceStatus = 'self_reported';
  assert.equal(conclude(metrics).classification, null);
  metrics[0].confidence = null; metrics[0].validation = null;
  assert.equal(conclude(metrics).classification, null);
});
test('severe isolated dirt is never averaged away into a clean conclusion', () => {
  const metrics = fixture(0); metrics[0].score = 80;
  const result = conclude(metrics);
  assert.equal(result.score, 16); assert.equal(result.status, 'review_required'); assert.equal(result.classification, null);
  assert.equal(result.warnings.length, 1); assert.equal(result.attentionAreas.length, 1);
});
test('missing evidence blocks numeric assessment even when a model supplied a number', () => {
  const metrics = fixture(0); metrics[0].evidence = [{ kind: 'model_observation_unverified', text: 'model guessed' }];
  const result = decorate(summarize([{ id: 1, metrics }], 'ollama'));
  assert.equal(result.images[0].metrics[0].score, null); assert.equal(result.conclusion.classification, null);
});
test('multiple angles are not averaged; exact duplicate does not change the one-image conclusion', () => {
  const one = { id: 1, metrics: fixture(30) };
  const two = { id: 2, metrics: fixture(60) };
  assert.equal(decorate(summarize([one, two], 'ollama')).conclusion.classification, null);
  assert.equal(decorate(summarize([one, { ...two, duplicateOf: 1 }], 'ollama')).conclusion.classification, 'hoi-ban');
});
test('supervised mapping learns human scores, not ordinal bands multiplied by 25', () => {
  const model = { name: 'unit-test-model', digest: 'unit-test-digest', promptVersion: 'unit-test-prompt' };
  const rows = [];
  for (const split of ['train', 'calibration']) for (let i = 0; i < 5; i++) rows.push({ id: `${split}-${i}`, roomId: `${split}-${i}`,
    split, annotators: ['unit-reviewer-a', 'unit-reviewer-b'], consensusReviewed: true,
    predictions: Object.fromEntries(KEYS.map(key => [key, { band: 2, observable: true, ambiguous: false, evidence: 'unit only' }])),
    labels: Object.fromEntries(KEYS.map(key => [key, { state: 'concern', score: 37 }])) });
  const artifact = buildArtifact(rows, model, 'unit-only');
  const observation = { band: 2, observable: true, ambiguous: false, evidence: 'unit only' };
  assert.equal(estimate(observation, 'dust', model, artifact).score, 37);
  assert.equal(estimate(observation, 'dust', { ...model, digest: 'changed' }, artifact), null);
  assert.equal(estimate({ ...observation, ambiguous: true }, 'dust', model, artifact), null);
  assert.equal(estimate(observation, 'dust', model, null), null);
  assert.equal(estimate({ ...observation, band: 3 }, 'dust', model, artifact), null);
  rows[5].roomId = rows[0].roomId; assert.throws(() => buildArtifact(rows, model, 'x'), /leakage/);
});
test('unvalidated VLM bands never become severity percentages; invisible criteria stay unknown', () => {
  const raw = { scene: 'room', criteria: Object.fromEntries(KEYS.map(key => [key, {
    observable: true, ambiguous: false, band: 4, evidence: 'model proposal', location: 'near door', alternative: 'shadow' }])) };
  const result = normalize(raw, { digest: 'unit', name: 'unit', promptVersion: 'unit' }, null);
  assert.ok(result.metrics.every(m => m.score === null && m.confidence === null));
  raw.criteria.dust.observable = false;
  const hidden = normalize(raw, {}, null); assert.equal(hidden.rawObservations.dust.band, -1);
  assert.equal(hidden.metrics[0].candidate, null);
  raw.criteria.floor.band = '4'; assert.throws(() => normalize(raw, {}, null), { code: 'INVALID_MODEL_OUTPUT' });
});
test('V3.1 always renders six UNKNOWN tracks without a zero or numeric ARIA value, safely', () => {
  const { document, window } = parseHTML('<div id="output"></div>');
  const context = vm.createContext({ document, window, URL: { revokeObjectURL() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../frontend/js/ai-v3.js'), 'utf8'), context);
  const metrics = unavailable('<img onerror=alert(1)>');
  const result = decorate(summarize([{ id: 1, filename: '<script>bad</script>', quality: { warnings: [] }, metrics }], 'ollama'));
  const container = document.getElementById('output'); window.DabCleanAiV3.render(container, result, []);
  assert.equal(container.querySelectorAll('.v31-track').length, 6);
  assert.equal(container.querySelectorAll('.v31-track-unknown').length, 6);
  assert.equal(container.querySelector('[aria-valuenow]'), null); assert.equal(container.querySelector('.v31-fill'), null);
  assert.ok(!container.textContent.includes('0%')); assert.equal(container.querySelector('script'), null);
  assert.ok(container.textContent.includes('CHƯA ĐỦ DỮ LIỆU'));
});
test('validated score fixtures render six percentage bars and reset cleanly to unknown', () => {
  const { document, window } = parseHTML('<div id="output"></div>');
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../frontend/js/ai-v3.js'), 'utf8'),
    vm.createContext({ document, window, URL: { revokeObjectURL() {} } }));
  const container = document.getElementById('output');
  const image = { id: 1, filename: 'unit-only', quality: { warnings: [] }, metrics: fixture(60) };
  window.DabCleanAiV3.render(container, decorate(summarize([image], 'ollama')), []);
  assert.equal(container.querySelectorAll('[aria-valuenow="60"]').length, 6);
  assert.ok(container.textContent.includes('RẤT BẨN'));
  image.metrics = unavailable('unknown'); window.DabCleanAiV3.render(container, decorate(summarize([image], 'ollama')), []);
  assert.equal(container.querySelectorAll('.v31-track-unknown').length, 6);
  assert.equal(container.querySelector('[aria-valuenow]'), null);
});
test('overall accuracy reports abstention and accepted coverage instead of silently dropping unknown cases', () => {
  const result = overallMetrics([{ overallLabel: 'sach' }, { overallLabel: 'rat-ban' }],
    [{ conclusion: { classification: 'sach' } }, { conclusion: { classification: null } }]);
  assert.equal(result.accuracyAllCases, .5); assert.equal(result.accuracyAccepted, 1);
  assert.equal(result.abstentionRate, .5); assert.equal(result.matrix['rat-ban'].abstain, 1);
});
