// Đo tốc độ: MobileNet chạy 9 ô riêng lẻ vs 1 lô 9 ô
const tf = require('@tensorflow/tfjs');
const mobilenet = require('@tensorflow-models/mobilenet');

(async () => {
  await tf.ready();
  const net = await mobilenet.load({ version: 1, alpha: 1.0 });

  // Tạo 9 tensor giả 224x224x3
  const mkTile = () => tf.randomUniform([224, 224, 3], 0, 255);

  // --- Cách 1: 9 lần riêng lẻ ---
  let t0 = Date.now();
  for (let i = 0; i < 9; i += 1) {
    const t = mkTile();
    const e = net.infer(t, true);
    await e.data();
    t.dispose(); e.dispose();
  }
  const sequential = Date.now() - t0;

  // --- Cách 2: 1 lô 9 ô ---
  const tiles = [];
  for (let i = 0; i < 9; i += 1) tiles.push(mkTile());
  t0 = Date.now();
  const batch = tf.stack(tiles);
  const emb = net.infer(batch, true);
  await emb.data();
  const batched = Date.now() - t0;
  batch.dispose(); emb.dispose();
  tiles.forEach(t => t.dispose());

  // --- Cách 3: lô nhưng chia nhỏ 3 ---
  t0 = Date.now();
  for (let g = 0; g < 3; g += 1) {
    const grp = [];
    for (let i = 0; i < 3; i += 1) grp.push(mkTile());
    const b = tf.stack(grp);
    const e = net.infer(b, true);
    await e.data();
    b.dispose(); e.dispose();
    grp.forEach(t => t.dispose());
  }
  const smallBatch = Date.now() - t0;

  console.log('  ' + 'Cach chay'.padEnd(30) + 'Thoi gian');
  console.log('  ' + '-'.repeat(44));
  console.log('  ' + '9 lan rieng le'.padEnd(30) + sequential + ' ms');
  console.log('  ' + '1 lo 9 o'.padEnd(30) + batched + ' ms  (' + (sequential / batched).toFixed(2) + 'x)');
  console.log('  ' + '3 lo x 3 o'.padEnd(30) + smallBatch + ' ms  (' + (sequential / smallBatch).toFixed(2) + 'x)');
  console.log('');
  console.log('  => Chay theo lo nhanh hon ' + (sequential / batched).toFixed(2) + ' lan');
})().catch(e => { console.error('LOI:', e.message); process.exit(1); });
