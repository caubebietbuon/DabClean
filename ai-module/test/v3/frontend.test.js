'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');
const { summarize, unavailable } = require('../../src/v3/contract');

test('renderer keeps hostile filename/model text inert and unknown scores have no bars', () => {
  const { document, window } = parseHTML('<html><body><div id="result"></div></body></html>');
  const evil = '<img src=x onerror="globalThis.pwned=true"><script>alert(1)</script>';
  const metric = unavailable('not calibrated');
  metric[0].candidate = { state: 'concern', description: evil };
  metric[0].evidence = [{ kind: 'model_observation_unverified', text: evil, location: evil, alternativeExplanation: evil }];
  const result = summarize([{ id: 1, filename: evil, quality: { warnings: ['too_dark'] }, metrics: metric }], 'clip');
  const context = vm.createContext({ window, document, URL: { createObjectURL: () => 'blob:local', revokeObjectURL() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../frontend/js/ai-v3.js'), 'utf8'), context);
  const container = document.getElementById('result'); window.DabCleanAiV3.render(container, result, []);
  assert.ok(container.textContent.includes(evil)); assert.equal(container.querySelector('script'), null);
  assert.equal(container.querySelector('[onerror]'), null); assert.equal(container.querySelector('progress'), null);
  assert.equal(container.querySelectorAll('.v3-metric').length, 6);
  assert.ok(container.textContent.includes('Không đủ dữ liệu')); assert.equal(context.pwned, undefined);
});
test('all inline booking/demo JavaScript parses; V3 no longer calls legacy price estimate', () => {
  const root = path.join(__dirname, '../../..');
  const html = fs.readFileSync(path.join(root, 'frontend/booking.html'), 'utf8');
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2]); count++;
  }
  assert.ok(count > 0); assert.ok(html.includes('ai.analyzeV31(formData)'));
  assert.ok(!html.includes('ai.estimate(formData)')); assert.ok(!html.includes('progressTimer'));
  new vm.Script(fs.readFileSync(path.join(root, 'frontend/api.js'), 'utf8'));
  new vm.Script(fs.readFileSync(path.join(root, 'ai-module/public/v3-demo.js'), 'utf8'));
});
