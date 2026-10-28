'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { runAnalysis } = require('../src/v3/engine');

async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-v3.js <real-image-file> [output.json]');
  const buffer = fs.readFileSync(process.argv[2]);
  const files = [{ filename: path.basename(process.argv[2]), buffer }];
  const after = await runAnalysis(files, { provider: process.env.AI_V3_PROVIDER || 'clip' });
  let before = null, baselineError = null;
  try { before = await runAnalysis(files, { workerPath: path.join(__dirname, '../src/v3/legacyWorker.js') }); }
  catch (err) { baselineError = err.code; }
  const report = { type: 'execution_smoke_only', groundTruth: null, accuracyClaim: null,
    generatedAt: new Date().toISOString(), before, baselineError, after };
  const output = process.argv[3] || path.join(__dirname, '../.cache/smoke-comparison.json');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, baselineError, legacyMs: before?.durationMs,
    v3Runtime: after.runtime, criteria: after.images[0].metrics.map(m => ({ key: m.key, score: m.score, status: m.status })) }));
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
