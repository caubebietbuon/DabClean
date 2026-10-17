// Kiểm tra modelFactory bản sâu: kiến trúc, số tham số, chạy thử forward
const tf = require('@tensorflow/tfjs');
const { buildHeadModel } = require('../src/ml/modelFactory');

(async () => {
  await tf.ready();

  const model = buildHeadModel();
  model.summary();

  // Kiểm tra layer đúng như thiết kế
  const names = model.layers.map(l => l.name);
  console.log('');
  console.log('Layers:', names.join(' -> '));

  const checks = [];
  const has = (n) => names.includes(n);
  checks.push(['có Dense(256)', has('dense_256_relu')]);
  checks.push(['có Dropout 0.5', has('dropout_1')]);
  checks.push(['có Dense(128)', has('dense_128_relu')]);
  checks.push(['có Dropout 0.3', has('dropout_2')]);
  checks.push(['có Dense(3) softmax', has('dense_3_softmax')]);

  // Đếm tham số: 1024*256+256 + 256*128+128 + 128*3+3
  const expect = (1024 * 256 + 256) + (256 * 128 + 128) + (128 * 3 + 3);
  const actual = model.countParams();
  checks.push([`số tham số = ${expect}`, actual === expect]);

  // Forward thử với input giả [2, 1024]
  const input = tf.randomNormal([2, 1024]);
  const out = model.predict(input);
  const shape = out.shape;
  checks.push(['output shape [2,3]', JSON.stringify(shape) === '[2,3]']);

  const probs = Array.from(await out.data());
  const sum0 = probs[0] + probs[1] + probs[2];
  checks.push(['softmax tổng = 1', Math.abs(sum0 - 1) < 1e-4]);

  input.dispose();
  out.dispose();
  model.dispose();

  console.log('');
  console.log('='.repeat(60));
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? 'V' : 'X'} ${label}`);
    if (!ok) failed += 1;
  }
  console.log('='.repeat(60));
  console.log(failed === 0
    ? `  TAT CA ${checks.length} KIEM TRA DEU DAT`
    : `  CO ${failed}/${checks.length} KHONG DAT`);
  process.exitCode = failed === 0 ? 0 : 1;
})().catch(e => {
  console.error('LOI:', e.message);
  console.error(e.stack);
  process.exit(1);
});
