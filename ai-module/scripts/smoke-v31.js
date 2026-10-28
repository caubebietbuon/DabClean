'use strict';
const fs = require('fs'), path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { runAnalysis } = require('../src/v3/engine');
async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-v31.js <real-photo> [private-output.json]');
  const file = path.resolve(process.argv[2]);
  const result = await runAnalysis([{ filename: path.basename(file), buffer: fs.readFileSync(file) }], {
    provider: process.env.AI_V31_PROVIDER || 'ollama', workerPath: path.join(__dirname, '../src/v31/worker.js') });
  const output = path.resolve(process.argv[3] || path.join(__dirname, '../.cache/v31-smoke.json'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ type: 'real_inference_smoke_not_accuracy_benchmark', groundTruth: null, result }, null, 2) + '\n');
  console.log(JSON.stringify({ output, model: result.images[0].model, conclusion: result.conclusion.label,
    numericCriteria: result.images[0].metrics.filter(m => m.score !== null).length, runtime: result.runtime }));
}
main().catch(e => { console.error(e.code || '', e.message); process.exitCode = 1; });
