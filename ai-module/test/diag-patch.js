// Chẩn đoán: vì sao patch 3x3 chấm SAI lớp sạch?
// So sánh nhãn từng ô của ảnh sạch vs ảnh rất bẩn.
const fs = require('fs');
const path = require('path');

const { loadModel, readMetadata } = require('../predict');
const { loadBackbone } = require('../src/ml/backbone');
const { sliceIntoTiles, predictTiles, aggregateTiles } = require('../src/ml/patchScorer');
const { LABEL_DISPLAY } = require('../src/ml/labels');

const DATASET = path.join(__dirname, '..', 'dataset');

function listJpg(dir, n) {
  return fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f)).slice(0, n)
    .map(f => path.join(dir, f));
}

(async () => {
  const model = await loadModel();
  const net = await loadBackbone();
  const meta = readMetadata();
  console.log(`Model: Dense(${(meta.architecture?.hiddenUnits || []).join('->')}) · val_acc ${(meta.valAccuracy * 100).toFixed(1)}%`);
  console.log('');

  for (const cls of ['sach', 'rat-ban']) {
    const files = listJpg(path.join(DATASET, cls), 3);
    console.log(`═══ ${LABEL_DISPLAY[cls]} ═══`);

    for (const f of files) {
      const buf = fs.readFileSync(f);
      const tiles = await sliceIntoTiles(buf, 3);
      const { labels, probs } = await predictTiles(model, net, tiles);
      const agg = aggregateTiles(labels, probs);

      console.log(`  ${path.basename(f)}`);
      console.log(`    Nhan tung o: ${labels.map(l => l.slice(0, 4)).join(' | ')}`);
      console.log(`    -> ${agg.phanLoai} (${agg.diem} diem)  rat=${agg.chiTiet.soOSieuBan}/9 hoi=${agg.chiTiet.soOBan}/9`);
      console.log(`    Xac suat TB: sach=${(agg.doTinCay.sach * 100).toFixed(1)}% hoi=${(agg.doTinCay.hoiBan * 100).toFixed(1)}% rat=${(agg.doTinCay.ratBan * 100).toFixed(1)}%`);
    }
    console.log('');
  }
})().catch(e => { console.error('LOI:', e.message); console.error(e.stack); process.exit(1); });
