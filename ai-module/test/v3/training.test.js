'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const tf = require('@tensorflow/tfjs');

test('actual augmentation failures retain exact sample-to-room alignment (regression)', async t => {
  const backbone = require('../../src/ml/backbone');
  const augment = require('../../src/ml/augment');
  // Stub only feature extraction; this test verifies data lineage, not model accuracy.
  t.mock.method(backbone, 'extractEmbeddingBatch', async batch => tf.zeros([batch.shape[0], 1024]));
  t.mock.method(augment, 'planAugmentations', () => [0, 1]);
  let counter = 0;
  t.mock.method(augment, 'applyAugmentation', async raw => {
    if (++counter === 1) throw new Error('one variant failed');
    return sharp(raw).resize(224, 224).jpeg().toBuffer();
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dabclean-lineage-'));
  let result;
  try {
    const file = path.join(dir, 'fixture.png');
    await sharp({ create: { width: 224, height: 224, channels: 3, background: '#abc' } }).png().toFile(file);
    const { buildEmbeddingDataset } = require('../../src/ml/dataset');
    result = await buildEmbeddingDataset([
      { file, labelIndex: 0, label: 'sach', roomId: 'room-a' },
      { file, labelIndex: 1, label: 'hoi-ban', roomId: 'room-b' }
    ], { augmentPerImage: 2, batchSize: 2 });
    assert.deepEqual(result.groupIds, ['room-a', 'room-b', 'room-a', 'room-b', 'room-b']);
    assert.equal(result.groupIds.length, result.xs.shape[0]); assert.equal(result.groupIds.length, result.ys.shape[0]);
    assert.equal(result.augmentInfo.augmented, 3);
  } finally { result?.xs.dispose(); result?.ys.dispose(); fs.rmSync(dir, { recursive: true, force: true }); }
});
