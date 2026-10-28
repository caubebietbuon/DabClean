'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { validateManifest, report } = require('../src/v3/benchmark');
const { runAnalysis } = require('../src/v3/engine');

async function main() {
  const manifestPath = path.resolve(process.argv[2] || path.join(__dirname, '../benchmark/manifest.json'));
  const output = path.resolve(process.argv[3] || path.join(__dirname, '../benchmark/latest-report.json'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validation = await validateManifest(manifest, path.dirname(manifestPath));
  const base = { generatedAt: new Date().toISOString(), validation, benchmarkStatus: 'blocked_missing_or_invalid_data',
    before: null, after: null, improvementClaim: null };
  if (!validation.ok) {
    fs.writeFileSync(output, JSON.stringify(base, null, 2) + '\n');
    console.error('Benchmark blocked:', validation.errors.join(', ')); process.exitCode = 2; return;
  }
  const items = manifest.items.filter(item => item.split === 'test');
  if (!items.length) throw new Error('No held-out test images');
  const before = [], after = [], timings = [];
  for (const item of items) {
    const buffer = fs.readFileSync(path.resolve(path.dirname(manifestPath), item.file));
    const started = performance.now();
    const v3 = await runAnalysis([{ filename: item.id, buffer }], { provider: process.env.AI_V3_PROVIDER || 'clip' });
    timings.push({ id: item.id, ...v3.runtime, wallMs: performance.now() - started });
    after.push(v3.images[0]);
    // Legacy has only 3 whole-scene labels. Compare on the exact same held-out images,
    // but never invent its six criterion scores. Log legacy output in a separate field.
    const legacy = await runAnalysis([{ filename: item.id, buffer }], {
      workerPath: path.join(__dirname, '../src/v3/legacyWorker.js')
    });
    before.push({ id: item.id, result: legacy.images[0], durationMs: legacy.durationMs });
  }
  fs.writeFileSync(output, JSON.stringify({ ...base, benchmarkStatus: 'executed_experimental',
    before: { outputs: before, criterionMetrics: null, reason: 'Legacy has no independent criterion heads.' },
    after: { ...report(items, after), timings },
    improvementClaim: 'Requires review: task support differs; do not compare a 3-label accuracy with criterion F1.' }, null, 2) + '\n');
  console.log('Wrote', output);
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1; });
