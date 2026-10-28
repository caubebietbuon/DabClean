'use strict';
const fs = require('fs'), path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { validateManifest } = require('../src/v3/benchmark');
const { runAnalysis } = require('../src/v3/engine');

async function capture(manifestPath, output) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validation = await validateManifest(manifest, path.dirname(manifestPath));
  if (!validation.ok) throw new Error(validation.errors.join(', '));
  const images = [];
  for (const item of manifest.items.filter(i => i.split !== 'test')) {
    const result = await runAnalysis([{ filename: item.id, buffer: fs.readFileSync(path.resolve(path.dirname(manifestPath), item.file)) }], {
      provider: 'ollama', workerPath: path.join(__dirname, '../src/v31/worker.js') });
    const image = result.images[0];
    images.push({ id: item.id, sha256: validation.fingerprints.find(f => f.id === item.id).sha256,
      model: image.model, rawObservations: image.rawObservations, status: image.status });
    fs.writeFileSync(output, JSON.stringify({ schemaVersion: '3.1-capture', images }, null, 2) + '\n');
    console.log('Captured', item.id);
  }
}
if (require.main === module) {
  if (!process.argv[2] || !process.argv[3]) { console.error('Usage: node scripts/capture-v31.js <reviewed-manifest.json> <private-predictions.json>'); process.exitCode = 1; }
  else capture(path.resolve(process.argv[2]), path.resolve(process.argv[3])).catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { capture };
