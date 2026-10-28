'use strict';
const fs = require('fs'), path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { validateManifest, report } = require('../src/v3/benchmark');
const { runAnalysis } = require('../src/v3/engine');

function overallMetrics(items, predictions) {
  const labels = ['sach', 'hoi-ban', 'rat-ban'];
  const matrix = Object.fromEntries(labels.map(key => [key, Object.fromEntries([...labels, 'abstain'].map(k => [k, 0]))]));
  let correct = 0, assessed = 0;
  items.forEach((item, i) => {
    const classification = predictions[i].conclusion.classification;
    matrix[item.overallLabel][labels.includes(classification) ? classification : 'abstain']++;
    if (labels.includes(classification)) { assessed++; if (classification === item.overallLabel) correct++; }
  });
  return { n: items.length, matrix, assessed, abstentionRate: items.length ? 1 - assessed / items.length : null,
    accuracyAllCases: items.length ? correct / items.length : null, accuracyAccepted: assessed ? correct / assessed : null };
}
async function main() {
  const manifestFile = path.resolve(process.argv[2] || path.join(__dirname, '../benchmark/manifest.json'));
  const output = path.resolve(process.argv[3] || path.join(__dirname, '../benchmark/latest-v31-report.json'));
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const validation = await validateManifest(manifest, path.dirname(manifestFile));
  const items = (manifest.items || []).filter(i => i.split === 'test');
  const errors = [...validation.errors];
  if (!items.length) errors.push('MISSING_HELD_OUT_TEST_ROOMS');
  if (items.some(i => !['sach', 'hoi-ban', 'rat-ban'].includes(i.overallLabel))) errors.push('MISSING_REVIEWED_OVERALL_LABELS');
  if (errors.length) {
    fs.writeFileSync(output, JSON.stringify({ status: 'blocked_missing_reference_data', errors, overall: null,
      sixFactorMetrics: null, accuracyClaim: null }, null, 2) + '\n');
    console.error('Benchmark blocked:', errors.join(', ')); process.exitCode = 2; return;
  }
  const predictions = [], runtimes = [];
  for (const item of items) {
    const result = await runAnalysis([{ filename: item.id, buffer: fs.readFileSync(path.resolve(path.dirname(manifestFile), item.file)) }], {
      provider: process.env.AI_V31_PROVIDER || 'ollama', workerPath: path.join(__dirname, '../src/v31/worker.js') });
    predictions.push(result.images[0]); runtimes.push({ id: item.id, ...result.runtime });
  }
  fs.writeFileSync(output, JSON.stringify({ status: 'executed_experimental', accuracyClaim: null,
    overall: overallMetrics(items, predictions), sixFactorMetrics: report(items, predictions), runtimes }, null, 2) + '\n');
  console.log('Wrote', output);
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { overallMetrics };
