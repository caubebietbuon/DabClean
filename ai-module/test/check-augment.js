// Kiểm tra API sharp cần thiết cho augmentation
const sharp = require('sharp');

(async () => {
  const s = sharp();
  console.log('sharp version   :', sharp.versions.sharp);
  console.log('co modulate()   :', typeof s.modulate === 'function');
  console.log('co flop()       :', typeof s.flop === 'function');
  console.log('co extract()    :', typeof s.extract === 'function');

  // Thử thật: tạo ảnh rồi augment
  const src = sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 180, g: 150, b: 120 } }
  }).jpeg().toBuffer();

  const buf = await src;
  console.log('anh goc         :', buf.length, 'bytes');

  const out = await sharp(buf)
    .extract({ left: 20, top: 20, width: 360, height: 270 })
    .resize(224, 224, { fit: 'fill' })
    .flop()
    .modulate({ brightness: 1.05 })
    .removeAlpha()
    .jpeg({ quality: 90 })
    .toBuffer();

  console.log('sau augment     :', out.length, 'bytes');
  const meta = await sharp(out).metadata();
  console.log('kich thuoc      :', meta.width + 'x' + meta.height, meta.format);
  console.log('=> OK: moi API augmentation deu chay duoc');
})().catch(e => {
  console.error('LOI:', e.message);
  process.exit(1);
});
