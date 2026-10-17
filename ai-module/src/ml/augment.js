// ============================================================
// CLEANOVA AI MODULE - Augmentation (tăng cường dữ liệu)
// ============================================================
// VÌ SAO CẦN?
// Ta có 1057 ảnh. Model Dense(256)->Dense(128) có ~290K tham số, đủ để
// overfit. Augmentation tạo nhiều biến thể từ cùng 1 ảnh -> model học
// đặc trưng BỀN VỮNG (mật độ rác) thay vì ghi nhớ từng ảnh cụ thể.
//
// ÁP DỤNG Ở ĐÂU?
// Ta áp dụng augmentation lên BUFFER ẢNH TRƯỚC khi trích embedding MobileNet.
// Nghĩa là mỗi ảnh gốc sinh ra N biến thể, mỗi biến thể có vector đặc trưng
// riêng -> tập train lớn hơn N lần.
//
// ⚠️ TRADE-OFF THỜI GIAN: mỗi biến thể = 1 lần chạy MobileNet. Trên CPU thuần
// JS, 1 lần ~1.8s. Với 1057 ảnh × 3 biến thể = 3171 lần ≈ 95 phút.
// Dùng --augment 0 để tắt khi cần train nhanh.
//
// LOẠI BIẾN ĐỔI (theo yêu cầu: crop/zoom + brightness jitter):
//   - flip ngang: ảnh phòng lật ngang vẫn là phòng đó (nhãn không đổi)
//   - crop/zoom: cắt 85-95% rồi phóng to — mô phỏng góc chụp khác
//   - brightness jitter: ±12% độ sáng — mô phỏng điều kiện ánh sáng khác
//
// RIÊNG rat-ban: thêm zoom SÂU vùng trung tâm (60-75%) — vì ảnh "rất bẩn"
// thường có đống rác ở giữa khung; zoom sâu giúp model học "mật độ đặc".
// ============================================================

const sharp = require('sharp');

// ------------------------------------------------------------
// Bộ sinh số ngẫu nhiên CÓ SEED — để kết quả tái lập được giữa các lần chạy
// ------------------------------------------------------------
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Sinh danh sách biến đổi cho 1 ảnh.
 *
 * @param {string} label - 'sach' | 'hoi-ban' | 'rat-ban'
 * @param {number} count - số biến thể cần sinh (KHÔNG tính ảnh gốc)
 * @param {number} seed  - seed để tái lập
 * @returns {Array<{type:string, params:object}>}
 */
function planAugmentations(label, count, seed) {
  const rng = makeRng(seed);
  const plans = [];

  // Với rat-ban, dành ~40% số biến thể cho zoom sâu trung tâm
  const deepZoomQuota = label === 'rat-ban' ? Math.max(1, Math.round(count * 0.4)) : 0;

  for (let i = 0; i < count; i += 1) {
    const bright = 0.88 + rng() * 0.24;          // 0.88 .. 1.12
    const flip = rng() < 0.5;

    if (i < deepZoomQuota) {
      // Zoom sâu vùng trung tâm — chỉ dành cho rat-ban
      const ratio = 0.60 + rng() * 0.15;          // giữ 60-75% khung
      plans.push({ type: 'deepZoom', params: { ratio, brightness: bright, flip } });
    } else {
      const ratio = 0.85 + rng() * 0.10;          // giữ 85-95% khung
      plans.push({ type: 'cropZoom', params: { ratio, brightness: bright, flip } });
    }
  }
  return plans;
}

/**
 * Áp dụng một biến đổi lên buffer ảnh, trả về buffer JPEG mới.
 *
 * @param {Buffer} buffer - ảnh gốc
 * @param {{type:string, params:object}} plan
 * @returns {Promise<Buffer>}
 */
async function applyAugmentation(buffer, plan) {
  const { ratio, brightness, flip } = plan.params;

  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const W = meta.width;
  const H = meta.height;

  // Vùng cắt: giữ `ratio` kích thước, canh giữa
  const cw = Math.max(1, Math.round(W * ratio));
  const ch = Math.max(1, Math.round(H * ratio));
  const left = Math.max(0, Math.round((W - cw) / 2));
  const top = Math.max(0, Math.round((H - ch) / 2));

  let pipe = sharp(buffer, { failOn: 'none' })
    .extract({ left, top, width: cw, height: ch })
    .resize(224, 224, { fit: 'fill' });   // MobileNet cần 224x224

  if (flip) pipe = pipe.flop();           // lật ngang

  // Brightness jitter: dùng modulate (sharp >= 0.30)
  pipe = pipe.modulate({ brightness });

  return pipe.removeAlpha().jpeg({ quality: 90 }).toBuffer();
}

module.exports = {
  makeRng,
  planAugmentations,
  applyAugmentation
};
