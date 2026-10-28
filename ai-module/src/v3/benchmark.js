'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { CRITERIA, STATES } = require('./contract');

const SPLITS = ['train', 'calibration', 'test'];
const CHALLENGES = ['many_ordered', 'few_disordered', 'maximalist_ordered', 'empty_stained',
  'normal_use', 'dark', 'shadow', 'pattern', 'small_stain', 'large_stain', 'other'];

async function fingerprint(file) {
  const buffer = fs.readFileSync(file);
  const { data } = await sharp(buffer, { limitInputPixels: 16000000 }).rotate().resize(9, 8, { fit: 'fill' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  let hash = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) hash = (hash << 1n) | BigInt(data[y * 9 + x] > data[y * 9 + x + 1]);
  return { sha256: crypto.createHash('sha256').update(buffer).digest('hex'), dhash: hash.toString(16).padStart(16, '0') };
}
function distance(a, b) { let v = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0; while (v) { n++; v &= v - 1n; } return n; }

async function validateManifest(manifest, root) {
  const errors = [], warnings = [], fingerprints = [], ids = new Set(), rooms = new Map();
  if (!Array.isArray(manifest.items) || !manifest.items.length) return { ok: false, errors: ['MISSING_REAL_LABELLED_DATASET'], warnings, fingerprints };
  for (const item of manifest.items) {
    if (!item.id || ids.has(item.id)) errors.push('DUPLICATE_OR_MISSING_ID'); ids.add(item.id);
    if (!item.roomId || !SPLITS.includes(item.split)) errors.push(`INVALID_ROOM_OR_SPLIT:${item.id}`);
    if (rooms.has(item.roomId) && rooms.get(item.roomId) !== item.split) errors.push(`ROOM_LEAKAGE:${item.roomId}`);
    rooms.set(item.roomId, item.split);
    if (!CHALLENGES.includes(item.challenge)) errors.push(`INVALID_CHALLENGE:${item.id}`);
    if (!Array.isArray(item.annotators) || new Set(item.annotators).size < 2) errors.push(`TWO_REVIEWERS_REQUIRED:${item.id}`);
    if (item.consensusReviewed !== true) errors.push(`CONSENSUS_REQUIRED:${item.id}`);
    for (const key of Object.keys(CRITERIA)) {
      const value = item.labels?.[key];
      if (!value || !STATES.includes(value.state) || !(value.score === null ||
          (Number.isFinite(value.score) && value.score >= 0 && value.score <= 100))) errors.push(`INVALID_LABEL:${item.id}:${key}`);
      if (value && ['unobservable', 'uncertain'].includes(value.state) && value.score !== null) errors.push(`UNOBSERVABLE_SCORE:${item.id}:${key}`);
    }
    if (typeof item.file !== 'string') { errors.push(`MISSING_FILE:${item.id}`); continue; }
    const file = path.resolve(root, item.file), relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { errors.push(`PATH_OUTSIDE_DATASET:${item.id}`); continue; }
    try {
      const real = fs.realpathSync(file), realRelative = path.relative(fs.realpathSync(root), real);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) throw new Error('symlink');
      fingerprints.push({ id: item.id, split: item.split, ...await fingerprint(file) });
    } catch { errors.push(`UNREADABLE_IMAGE:${item.id}`); }
  }
  for (let i = 0; i < fingerprints.length; i++) for (let j = i + 1; j < fingerprints.length; j++) {
    const a = fingerprints[i], b = fingerprints[j];
    if (a.sha256 === b.sha256 || distance(a.dhash, b.dhash) <= 6) {
      const note = `DUPLICATE_OR_NEAR_DUPLICATE:${a.id}:${b.id}`;
      if (a.split !== b.split) errors.push(note); else warnings.push(note);
    }
  }
  if (manifest.unseenByLegacy !== true) errors.push('LEGACY_TRAIN_CONTAMINATION_NOT_EXCLUDED');
  for (const challenge of CHALLENGES.slice(0, 5)) {
    if (!manifest.items.some(item => item.split === 'test' && item.challenge === challenge)) warnings.push(`MISSING_TEST_STRATUM:${challenge}`);
  }
  return { ok: errors.length === 0, errors, warnings, fingerprints };
}

// Classification has a separate abstention column; never count abstention as a correct negative.
function classification(truth, predicted) {
  const matrix = Object.fromEntries(STATES.map(label => [label, Object.fromEntries([...STATES, 'abstain'].map(k => [k, 0]))]));
  truth.forEach((label, i) => matrix[label][STATES.includes(predicted[i]) ? predicted[i] : 'abstain']++);
  const perClass = {};
  for (const label of STATES) {
    const tp = matrix[label][label], support = Object.values(matrix[label]).reduce((a, b) => a + b, 0);
    const positives = STATES.reduce((sum, key) => sum + matrix[key][label], 0);
    const precision = positives ? tp / positives : null, recall = support ? tp / support : null;
    perClass[label] = { support, precision, recall,
      f1: support ? (precision && recall ? 2 * precision * recall / (precision + recall) : 0) : null };
  }
  const abstentions = predicted.filter(value => !STATES.includes(value)).length;
  return { matrix, perClass, count: truth.length, abstentionRate: truth.length ? abstentions / truth.length : null };
}
function mae(pairs) {
  const valid = pairs.filter(([truth, value]) => Number.isFinite(truth) && Number.isFinite(value));
  return { n: valid.length, mae: valid.length ? valid.reduce((sum, [truth, value]) => sum + Math.abs(truth - value), 0) / valid.length : null };
}
function calibration(samples, bins = 10) {
  const valid = samples.filter(s => Number.isFinite(s.confidence) && s.confidence >= 0 && s.confidence <= 1 && typeof s.correct === 'boolean');
  const diagram = Array.from({ length: bins }, (_, i) => {
    const values = valid.filter(s => Math.min(bins - 1, Math.floor(s.confidence * bins)) === i);
    return { lower: i / bins, upper: (i + 1) / bins, n: values.length,
      confidence: values.length ? values.reduce((sum, s) => sum + s.confidence, 0) / values.length : null,
      accuracy: values.length ? values.filter(s => s.correct).length / values.length : null };
  });
  return { n: valid.length, ece: valid.length ? diagram.reduce((sum, bin) => sum + bin.n * Math.abs((bin.confidence || 0) - (bin.accuracy || 0)), 0) / valid.length : null,
    reliabilityDiagram: diagram };
}

function report(items, predictions) {
  const metrics = {};
  for (const key of Object.keys(CRITERIA)) {
    const truth = items.map(item => item.labels[key].state);
    const outputs = predictions.map(p => p.metrics.find(m => m.key === key));
    metrics[key] = {
      accepted: classification(truth, outputs.map(m => m?.status === 'assessed' ? m.candidate?.state : null)),
      // Report experimental semantic candidates separately from validated predictions.
      experimentalCandidates: classification(truth, outputs.map(m => m?.candidate?.state)),
      severity: mae(items.map((item, i) => [item.labels[key].score, outputs[i]?.score])),
      calibration: calibration(outputs.map((m, i) => ({ confidence: m?.confidence,
        correct: m?.candidate?.state === truth[i] })))
    };
  }
  const challengeRate = (challenge, erroneousState) => {
    const positions = items.map((item, i) => item.challenge === challenge ? i : -1).filter(i => i >= 0);
    const candidates = positions.filter(i => predictions[i].metrics.find(m => m.key === 'clutter')?.candidate?.state === erroneousState).length;
    return { n: positions.length, experimentalErrorRate: positions.length ? candidates / positions.length : null };
  };
  return { metrics, challenge: { manyOrderedFlaggedClutter: challengeRate('many_ordered', 'concern'),
    fewDisorderedCalledClear: challengeRate('few_disordered', 'clear') } };
}
module.exports = { validateManifest, fingerprint, distance, classification, mae, calibration, report, CHALLENGES };
