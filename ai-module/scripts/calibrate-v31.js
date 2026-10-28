'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { validateManifest } = require('../src/v3/benchmark');
const { buildArtifact } = require('../src/v31/calibration');

async function main() {
  if (process.argv.length < 5) throw new Error('Usage: node scripts/calibrate-v31.js <reviewed-manifest.json> <private-predictions.json> <new-artifact.json>');
  const [manifestFile, predictionsFile, output] = process.argv.slice(2).map(p => path.resolve(p));
  if (fs.existsSync(output)) throw new Error('Output exists; use a new versioned artifact path.');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const validation = await validateManifest(manifest, path.dirname(manifestFile));
  if (!validation.ok) throw new Error(validation.errors.join(', '));
  const predictions = JSON.parse(fs.readFileSync(predictionsFile, 'utf8'));
  if (predictions.schemaVersion !== '3.1-capture' || !Array.isArray(predictions.images)) throw new Error('Invalid capture format');
  const rows = [], seen = new Set(); let model;
  for (const prediction of predictions.images) {
    const item = manifest.items.find(i => i.id === prediction.id);
    if (!item || item.split === 'test' || seen.has(item.id)) throw new Error('Test contamination, missing ID or duplicate capture');
    seen.add(item.id);
    if (prediction.sha256 !== validation.fingerprints.find(f => f.id === item.id)?.sha256) throw new Error('Image content changed since inference');
    if (!prediction.model?.digest || !prediction.rawObservations) continue; // quality-rejected image is not a training sample
    model ||= prediction.model;
    if (JSON.stringify(model) !== JSON.stringify(prediction.model)) throw new Error('Mixed model identities/prompt versions');
    rows.push({ ...item, predictions: prediction.rawObservations });
  }
  const id = crypto.createHash('sha256').update(fs.readFileSync(manifestFile)).update(fs.readFileSync(predictionsFile)).digest('hex');
  const artifact = buildArtifact(rows, model, id);
  if (!Object.values(artifact.criteria).some(bins => Object.keys(bins).length)) throw new Error('Insufficient independent calibration support or validation errors too large; no artifact written.');
  fs.writeFileSync(output, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
  console.log('Wrote experimental calibration artifact:', output);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
