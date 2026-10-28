'use strict';
const fs = require('fs');
const { KEYS } = require('./scoring');

// Supervised ordinal-band regression. Values come from human reference scores, never band*25.
// No artifact is bundled: without independent reviewed annotations the score stays null.
const VERSION = 'human-band-regression-1';
const LIMITS = Object.freeze({ minTrain: 5, minValidation: 5, maxMae: 15, maxError: 25 });
function buildArtifact(rows, model, id) {
  if (!model?.digest || !model.promptVersion || !id) throw new Error('Model digest, prompt version and calibration ID required');
  const roomSplits = new Map(), ids = new Set();
  for (const row of rows) {
    if (!row.roomId || !row.id || ids.has(row.id) || !['train', 'calibration'].includes(row.split)) throw new Error('Invalid sample provenance');
    if (row.consensusReviewed !== true || !Array.isArray(row.annotators) || new Set(row.annotators).size < 2) throw new Error('Two independent reviewers and consensus required');
    if (roomSplits.has(row.roomId) && roomSplits.get(row.roomId) !== row.split) throw new Error('Room leakage');
    ids.add(row.id); roomSplits.set(row.roomId, row.split);
  }
  const criteria = {};
  for (const key of KEYS) {
    const bins = {};
    for (let band = 0; band <= 4; band++) {
      const valid = rows.filter(r => r.predictions?.[key]?.band === band && r.predictions[key].observable === true
        && r.predictions[key].ambiguous === false && r.predictions[key].evidence
        && Number.isFinite(r.labels?.[key]?.score) && r.labels[key].score >= 0 && r.labels[key].score <= 100
        && ['clear', 'concern'].includes(r.labels[key].state));
      const train = valid.filter(r => r.split === 'train'), validation = valid.filter(r => r.split === 'calibration');
      if (new Set(train.map(r => r.roomId)).size < LIMITS.minTrain || new Set(validation.map(r => r.roomId)).size < LIMITS.minValidation) continue;
      const score = train.reduce((sum, r) => sum + r.labels[key].score, 0) / train.length;
      const errors = validation.map(r => Math.abs(r.labels[key].score - score));
      const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
      const maxError = Math.max(...errors);
      if (mae <= LIMITS.maxMae && maxError <= LIMITS.maxError) bins[band] = { score: Math.round(score * 10) / 10,
        trainRooms: new Set(train.map(r => r.roomId)).size, validationRooms: new Set(validation.map(r => r.roomId)).size,
        validationMae: mae, validationMaxError: maxError };
    }
    // Reject inversions instead of asserting a monotonic relation unsupported by labels.
    const values = Object.values(bins);
    if (values.some((bin, i) => i && bin.score < values[i - 1].score)) criteria[key] = {};
    else criteria[key] = bins;
  }
  return { version: VERSION, id, model, limits: LIMITS, criteria,
    testValidated: false, note: 'Calibration-set acceptance only; independent test performance and threshold calibration are not established.' };
}
function loadArtifact(file) {
  if (!file) return null;
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (artifact.version !== VERSION || !artifact.id || !artifact.model?.digest || !artifact.criteria) throw new Error('Invalid calibration artifact');
  return artifact;
}
function estimate(observation, key, model, artifact) {
  if (!artifact || artifact.model.digest !== model?.digest || artifact.model.promptVersion !== model?.promptVersion
    || artifact.model.name !== model?.name || !observation?.observable || observation.ambiguous !== false
    || !observation.evidence || !Number.isInteger(observation.band)) return null;
  const bin = artifact.criteria[key]?.[observation.band];
  if (!bin || !Number.isFinite(bin.score) || bin.score < 0 || bin.score > 100
    || !(bin.trainRooms >= LIMITS.minTrain) || !(bin.validationRooms >= LIMITS.minValidation)
    || !(bin.validationMae >= 0 && bin.validationMae <= LIMITS.maxMae)
    || !(bin.validationMaxError >= 0 && bin.validationMaxError <= LIMITS.maxError)) return null;
  return { score: bin.score, validation: { status: 'validated', calibrationId: artifact.id,
    method: VERSION, validationMae: bin.validationMae, validationRooms: bin.validationRooms,
    testValidated: false } };
}
module.exports = { buildArtifact, loadArtifact, estimate, VERSION, LIMITS };
