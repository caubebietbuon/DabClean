// ============================================================
// CLEANOVA AI MODULE - Patch Scorer (chấm độ bẩn theo vùng)
// ============================================================
// VÌ SAO CẦN CÁCH CHẤM NÀY?
//
// Cách cũ (whole): nén cả ảnh 224x224 -> 1 vector -> 1 xác suất duy nhất.
// Vấn đề: ảnh phòng NGẬP RÁC có thể chỉ chiếm 60-70% khung hình, phần còn
// lại là tường/trần sạch. Khi nén cả ảnh, đặc trưng "rác" bị pha loãng với
// đặc trưng "tường sạch" -> model đoán "hoi-ban" thay vì "rat-ban".
//
// Cách patch: chia ảnh thành lưới 3x3, chấm TỪNG Ô riêng biệt.
//   - Mỗi ô là vùng cục bộ, không bị pha loãng bởi phần sạch còn lại.
//   - Ảnh ngập rác: phần lớn các ô là rác -> tiLeSieuBan cao -> rat-ban.
//
// ⚠️ HẠN CHẾ ĐÃ ĐO ĐƯỢC CỦA PATCH THUẦN (rất quan trọng):
// Model được train trên TOÀN ẢNH PHÒNG (thấy bố cục: tường + sàn + đồ đạc).
// Khi chỉ đưa một MẢNG TƯỜNG trơn (1/9 khung, đã crop + phóng to), đặc trưng
// đó NẰM NGOÀI phân bố huấn luyện (distribution shift) -> model đoán bừa.
//
// Đo thực tế: ảnh sạch chỉ đạt 2/8 (25%) với patch thuần, vì 6/9 ô tường
// trơn bị nhãn "hoi-ban" — dù xác suất ratBan trung bình chỉ 7%.
//
// GIẢI PHÁP: TỔNG HỢP LAI (hybrid)
//   - "Sạch" phán đoán TỐT NHẤT bằng whole  (cả ảnh, đúng phân bố train).
//   - "Rất bẩn" phán đoán TỐT HƠN bằng patch (không bị pha loãng).
// Nên: dùng whole làm nền, chỉ NÂNG lên rat-ban khi patch chứng minh được
// có ≥ 1/3 số ô thực sự là rác. Không bao giờ hạ whole xuống hoi-ban.
// ============================================================

const tf = require('@tensorflow/tfjs');
const sharp = require('sharp');

const { IMAGE_SIZE } = require('./imageUtils');

// ------------------------------------------------------------
// Ngưỡng quyết định (theo yêu cầu)
// ------------------------------------------------------------
const TILE = 3;                  // lưới 3x3
const RATIO_RAT_BAN = 0.34;      // >= 34% ô là rat-ban -> cả ảnh là rat-ban
const RATIO_HOI_BAN = 0.34;      // >= 34% ô là bẩn     -> cả ảnh là hoi-ban
const W_RAT = 70;                // trọng số điểm cho tiLeSieuBan
const W_HOI = 30;                // trọng số điểm cho tiLeBan

// ------------------------------------------------------------
// Cắt ảnh thành lưới TILE x TILE, mỗi ô phóng to về 224x224
// ------------------------------------------------------------
/**
 * Cắt buffer ảnh thành lưới ô, mỗi ô là 1 buffer JPEG 224x224.
 *
 * TỐI ƯU HIỆU NĂNG: ta decode ảnh MỘT LẦN (một `sharp().raw()`) rồi cắt
 * từng ô bằng phép cắt mảng pixel thuần JS. Cách ngây thơ (gọi sharp() 9 lần,
 * mỗi lần decode lại toàn bộ ảnh) tốn gấp ~9 lần thời gian decode cho mỗi ảnh.
 *
 * @param {Buffer} buffer - ảnh gốc (bất kỳ định dạng sharp đọc được)
 * @param {number} tile   - số ô mỗi chiều (mặc định 3)
 * @param {number} overlap - tỉ lệ chồng lấn (0.15 = lấy dư 15% mỗi cạnh,
 *                           tránh cắt đúng ranh giới giữa 2 vùng bẩn)
 * @returns {Promise<Float32Array[]>} mỗi phần tử là pixel RGB đã resize 224x224
 */
async function sliceIntoTiles(buffer, tile = TILE, overlap = 0.15) {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const W = meta.width;
  const H = meta.height;
  if (!W || !H) throw new Error('Không đọc được kích thước ảnh');

  const tileW = W / tile;
  const tileH = H / tile;
  const padX = Math.round(tileW * overlap);
  const padY = Math.round(tileH * overlap);

  const rects = [];
  for (let r = 0; r < tile; r += 1) {
    for (let c = 0; c < tile; c += 1) {
      const left = Math.max(0, Math.round(c * tileW - padX));
      const top = Math.max(0, Math.round(r * tileH - padY));
      const right = Math.min(W, Math.round((c + 1) * tileW + padX));
      const bottom = Math.min(H, Math.round((r + 1) * tileH + padY));
      rects.push({
        left, top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top)
      });
    }
  }

  // Decode ảnh gốc MỘT LẦN duy nhất -> RGB [H,W,3]
  const base = sharp(buffer, { failOn: 'none' })
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = await base;
  const srcW = src.info.width;
  const srcH = src.info.height;
  const srcCh = src.info.channels;
  const srcData = src.data;

  // Scale lại toạ độ nếu ảnh đã bị xoay theo EXIF làm đổi kích thước
  const sx = srcW / W;
  const sy = srcH / H;

  // Cắt từng ô + nearest-neighbour resize về 224x224 (nhanh, đủ tốt cho
  // ảnh đưa vào MobileNet; MobileNet sẽ chuẩn hoá tiếp).
  const tiles = [];
  for (const rc of rects) {
    const cx = Math.round(rc.left * sx);
    const cy = Math.round(rc.top * sy);
    const cw = Math.max(1, Math.round(rc.width * sx));
    const ch = Math.max(1, Math.round(rc.height * sy));

    const out = new Float32Array(IMAGE_SIZE * IMAGE_SIZE * 3);
    for (let oy = 0; oy < IMAGE_SIZE; oy += 1) {
      const syi = cy + Math.min(ch - 1, Math.floor((oy * ch) / IMAGE_SIZE));
      const rowOff = syi * srcW;
      for (let ox = 0; ox < IMAGE_SIZE; ox += 1) {
        const sxi = cx + Math.min(cw - 1, Math.floor((ox * cw) / IMAGE_SIZE));
        const si = (rowOff + sxi) * srcCh;
        const di = (oy * IMAGE_SIZE + ox) * 3;
        out[di] = srcData[si];
        out[di + 1] = srcData[si + 1];
        out[di + 2] = srcData[si + 2];
      }
    }
    tiles.push(out);
  }

  return tiles;
}

// ------------------------------------------------------------
// Chấm từng ô -> nhãn của ô đó
// ------------------------------------------------------------
/**
 * Chạy model trên từng ô, trả về nhãn dự đoán của mỗi ô.
 *
 * @param {tf.LayersModel} model
 * @param {object} net - MobileNet backbone
 * @param {Float32Array[]} tilePixels - pixel RGB từng ô, đã resize 224x224
 * @returns {Promise<{labels:string[], probs:number[][]}>}
 */
async function predictTiles(model, net, tilePixels) {
  // Gom tất cả ô thành 1 tensor lô [n,224,224,3] -> MobileNet chạy 1 lần
  const tensors = tilePixels.map(
    px => tf.tensor3d(px, [IMAGE_SIZE, IMAGE_SIZE, 3], 'float32')
  );

  const batch = tf.stack(tensors);
  tensors.forEach(t => t.dispose());

  const emb = net.infer(batch, true);     // [n,1024]
  const probsTensor = model.predict(emb); // [n,3]
  const flat = Array.from(await probsTensor.data());

  batch.dispose();
  emb.dispose();
  probsTensor.dispose();

  const n = tilePixels.length;
  const probs = [];
  const labels = [];
  for (let i = 0; i < n; i += 1) {
    const p = [flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]];
    probs.push(p);
    // argmax: 0=sach, 1=hoi-ban, 2=rat-ban
    let best = 0;
    if (p[1] > p[best]) best = 1;
    if (p[2] > p[best]) best = 2;
    labels.push(['sach', 'hoi-ban', 'rat-ban'][best]);
  }
  return { labels, probs };
}

// ------------------------------------------------------------
// Tổng hợp kết quả các ô -> kết quả cả ảnh
// ------------------------------------------------------------
/**
 * @param {string[]} tileLabels - nhãn từng ô
 * @param {number[][]} tileProbs - xác suất từng ô
 * @returns {{diem:number, phanLoai:string, doTinCay:object, chiTiet:object}}
 */
function aggregateTiles(tileLabels, tileProbs) {
  const total = tileLabels.length;
  const nRat = tileLabels.filter(l => l === 'rat-ban').length;
  const nHoi = tileLabels.filter(l => l === 'hoi-ban').length;
  const nSach = tileLabels.filter(l => l === 'sach').length;

  const tiLeSieuBan = total ? nRat / total : 0;
  const tiLeBan = total ? (nRat + nHoi) / total : 0;

  // Quyết định nhãn cả ảnh
  let phanLoai;
  if (tiLeSieuBan >= RATIO_RAT_BAN) phanLoai = 'rat-ban';
  else if (tiLeBan >= RATIO_HOI_BAN) phanLoai = 'hoi-ban';
  else phanLoai = 'sach';

  // Điểm 0..100 theo công thức yêu cầu
  const diem = Math.round(tiLeSieuBan * W_RAT + tiLeBan * W_HOI);
  const diemFinal = Math.max(0, Math.min(100, diem));

  // Xác suất trung bình (để hiển thị độ tin cậy từng lớp)
  const avg = [0, 0, 0];
  for (const p of tileProbs) {
    avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2];
  }
  if (total) { avg[0] /= total; avg[1] /= total; avg[2] /= total; }

  return {
    diem: diemFinal,
    phanLoai,
    doTinCay: {
      sach: Math.round(avg[0] * 10000) / 10000,
      hoiBan: Math.round(avg[1] * 10000) / 10000,
      ratBan: Math.round(avg[2] * 10000) / 10000
    },
    chiTiet: {
      soOSieuBan: nRat,
      soOBan: nHoi,
      soOSach: nSach,
      tongSo: total,
      tiLeSieuBan: Math.round(tiLeSieuBan * 1000) / 1000,
      tiLeBan: Math.round(tiLeBan * 1000) / 1000,
      nhanTungO: tileLabels
    }
  };
}

/**
 * TỔNG HỢP LAI: kết hợp phán đoán whole (cả ảnh) với patch (theo vùng).
 *
 * Nguyên tắc:
 *   1. WHOLE là nền — nó đáng tin cho "sạch" vì đúng phân bố huấn luyện.
 *   2. PATCH chỉ có quyền NÂNG mức bẩn lên, không hạ xuống.
 *      Lý do: patch giỏi phát hiện "có rác ở đâu đó" (nâng lên rat-ban),
 *      nhưng dở khi kết luận "cả ảnh sạch" (ô tường trơn bị nhầm hoi-ban).
 *   3. Nâng lên rat-ban chỉ khi patch chứng minh được ≥ 1/3 số ô là rác.
 *
 * @param {{diem:number, phanLoai:string, doTinCay:object}} whole
 *        kết quả chấm cả ảnh
 * @param {{diem:number, phanLoai:string, doTinCay:object, chiTiet:object}} patch
 *        kết quả chấm theo vùng
 * @returns {{diem:number, phanLoai:string, doTinCay:object, chiTiet:object, nguon:string}}
 */
function combineWholeAndPatch(whole, patch) {
  const RANK = { sach: 0, 'hoi-ban': 1, 'rat-ban': 2 };
  const wRank = RANK[whole.phanLoai] ?? 0;
  const pRank = RANK[patch.phanLoai] ?? 0;

  const tiLeSieuBan = patch.chiTiet ? patch.chiTiet.tiLeSieuBan : 0;

  // Chỉ nâng lên rat-ban khi patch thực sự thấy rác ở ≥ 1/3 số ô
  const patchDuManh = pRank === 2 && tiLeSieuBan >= RATIO_RAT_BAN;

  let phanLoai;
  let nguon;

  if (patchDuManh && wRank < 2) {
    // Patch phát hiện rác rõ ràng mà whole bỏ sót -> nâng lên rat-ban
    phanLoai = 'rat-ban';
    nguon = 'patch (nâng từ ' + whole.phanLoai + ')';
  } else {
    // Mặc định tin whole — nó đúng phân bố train
    phanLoai = whole.phanLoai;
    nguon = 'whole';
  }

  // Điểm: lấy MAX giữa hai cách khi patch mạnh hơn, còn lại dùng whole.
  // Không BAO GIỜ để patch kéo điểm whole xuống (đó là lỗi distribution shift).
  let diem = whole.diem;
  if (patchDuManh) diem = Math.max(whole.diem, patch.diem);

  return {
    diem: Math.round(diem * 10) / 10,
    phanLoai,
    doTinCay: whole.doTinCay,
    chiTiet: {
      whole: {
        diem: whole.diem,
        phanLoai: whole.phanLoai,
        doTinCay: whole.doTinCay
      },
      patch: patch.chiTiet || null,
      nangCap: patchDuManh && wRank < 2,
      nguon
    }
  };
}

/**
 * Chấm điểm 1 ảnh THEO VÙNG (patch 3x3).
 *
 * @param {tf.LayersModel} model
 * @param {object} net
 * @param {Buffer} buffer - ảnh gốc
 * @param {object} opts { tile }
 * @returns {Promise<{diem, phanLoai, doTinCay, chiTiet}>}
 */
async function scoreByPatch(model, net, buffer, opts = {}) {
  const tile = opts.tile || TILE;
  const tiles = await sliceIntoTiles(buffer, tile);
  const { labels, probs } = await predictTiles(model, net, tiles);
  return aggregateTiles(labels, probs);
}

module.exports = {
  TILE,
  RATIO_RAT_BAN,
  RATIO_HOI_BAN,
  W_RAT,
  W_HOI,
  sliceIntoTiles,
  predictTiles,
  aggregateTiles,
  combineWholeAndPatch,
  scoreByPatch
};
