'use strict';
const sharp = require('sharp');
const crypto = require('crypto');

// These are conservative operational screening limits, NOT learned cleanliness thresholds.
const POLICY = Object.freeze({ maxPixels: 16000000, maxEdge: 1600, minEdge: 160,
  darkFraction: 0.85, brightFraction: 0.85, minimumLaplacianVariance: 8 });

function failure(status, code, message) {
  return Object.assign(new Error(message), { status, statusCode: status, code });
}

function recognized(buffer) {
  return buffer.length >= 12 && (
    (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ||
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP')
  );
}

async function prepare(buffer) {
  if (!recognized(buffer)) throw failure(415, 'IMAGE_FORMAT', 'V3 chỉ nhận ảnh JPEG, PNG hoặc WebP có định dạng thật hợp lệ.');
  let meta, canonical;
  try {
    meta = await sharp(buffer, { limitInputPixels: POLICY.maxPixels, failOn: 'warning' }).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > POLICY.maxPixels) {
      throw failure(413, 'IMAGE_PIXELS', 'Ảnh vượt quá giới hạn 16 triệu pixel.');
    }
    if ((meta.pages || 1) > 1) throw failure(415, 'ANIMATED_IMAGE', 'Vui lòng chọn ảnh tĩnh.');
    canonical = await sharp(buffer, { limitInputPixels: POLICY.maxPixels, failOn: 'warning' })
      .rotate().resize(POLICY.maxEdge, POLICY.maxEdge, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).toColourspace('srgb').jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    if (err.status) throw err;
    throw failure(/pixel limit/i.test(err.message) ? 413 : 415, 'IMAGE_DECODE', 'Không đọc được ảnh hoặc ảnh vượt giới hạn pixel.');
  }
  const { data, info } = await sharp(canonical).resize(256, 256, { fit: 'inside' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  let dark = 0, bright = 0, sum = 0, sum2 = 0, n = 0;
  for (const value of data) { if (value < 20) dark++; if (value > 245) bright++; }
  for (let y = 1; y < info.height - 1; y++) for (let x = 1; x < info.width - 1; x++) {
    const i = y * info.width + x;
    const lap = data[i - 1] + data[i + 1] + data[i - info.width] + data[i + info.width] - 4 * data[i];
    sum += lap; sum2 += lap * lap; n++;
  }
  const variance = n ? Math.max(0, sum2 / n - (sum / n) ** 2) : 0;
  const warnings = [];
  if (Math.min(meta.width, meta.height) < POLICY.minEdge) warnings.push('low_resolution');
  if (dark / data.length > POLICY.darkFraction) warnings.push('too_dark');
  if (bright / data.length > POLICY.brightFraction) warnings.push('overexposed');
  if (variance < POLICY.minimumLaplacianVariance) warnings.push('low_detail_or_blur');
  return {
    buffer: canonical, hash: crypto.createHash('sha256').update(canonical).digest('hex'),
    quality: { width: meta.width, height: meta.height, warnings, usable: warnings.length === 0,
      measurements: { darkFraction: dark / data.length, brightFraction: bright / data.length, laplacianVariance: variance },
      method: 'luminance_and_laplacian_screening_v1', calibrated: false,
      note: 'Độ sáng và chi tiết chỉ dùng sàng lọc chất lượng ảnh, không dùng tính độ bẩn. Vùng khuất cần người dùng chụp bổ sung.' }
  };
}
module.exports = { prepare, POLICY, failure };
