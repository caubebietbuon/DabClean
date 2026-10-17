// ============================================================
// DABCLEAN AI MODULE - Định nghĩa nhãn & quy đổi điểm
// ============================================================
// THỨ TỰ NHÃN LÀ BẤT BIẾN (immutable):
//   index 0 -> sach
//   index 1 -> hoi-ban
//   index 2 -> rat-ban
//
// Lớp output của model là softmax 3 units, nên vị trí này quyết định ý
// nghĩa xác suất. Nếu đổi thứ tự, PHẢI train lại model.
// ============================================================

const LABELS = ['sach', 'hoi-ban', 'rat-ban'];

// Tên thư mục dataset tương ứng (dataset/sach, dataset/hoi-ban, dataset/rat-ban)
const LABEL_TO_FOLDER = {
  'sach': 'sach',
  'hoi-ban': 'hoi-ban',
  'rat-ban': 'rat-ban'
};

// Nhãn hiển thị tiếng Việt
const LABEL_DISPLAY = {
  'sach': 'Sạch',
  'hoi-ban': 'Hơi bẩn',
  'rat-ban': 'Rất bẩn'
};

// Màu gợi ý cho UI
const LABEL_COLOR = {
  'sach': '#10B981',
  'hoi-ban': '#F59E0B',
  'rat-ban': '#EF4444'
};

// ------------------------------------------------------------
// QUY ĐỔI XÁC SUẤT -> ĐIỂM 0..100
// ------------------------------------------------------------
// Mỗi lớp có một "điểm neo" đại diện. Điểm cuối là TRUNG BÌNH CÓ TRỌNG SỐ
// theo xác suất softmax, nhờ vậy điểm biến thiên MƯỢT (ví dụ 1 ảnh
// 60% sạch + 40% hơi bẩn sẽ ra ~30 điểm) thay vì nhảy bậc thô.
//
//   sạch     -> ~10 điểm
//   hơi bẩn  -> ~50 điểm
//   rất bẩn  -> ~90 điểm
const CLASS_ANCHOR_SCORE = {
  'sach': 10,
  'hoi-ban': 50,
  'rat-ban': 90
};

/**
 * Từ vector xác suất softmax -> điểm 0..100.
 * @param {number[]} probs - [p_sach, p_hoi_ban, p_rat_ban]
 * @returns {number} điểm đã làm tròn 1 chữ số thập phân
 */
function probsToScore(probs) {
  let score = 0;
  for (let i = 0; i < LABELS.length; i += 1) {
    score += (probs[i] || 0) * CLASS_ANCHOR_SCORE[LABELS[i]];
  }
  return Math.round(score * 10) / 10;
}

/**
 * Xác suất -> tên lớp có xác suất cao nhất.
 * @param {number[]} probs
 * @returns {string} 'sach' | 'hoi-ban' | 'rat-ban'
 */
function probsToLabel(probs) {
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[best]) best = i;
  }
  return LABELS[best];
}

/**
 * Đóng gói độ tin cậy theo đúng format yêu cầu của API.
 * @param {number[]} probs
 * @returns {{sach:number, hoiBan:number, ratBan:number}}
 */
function probsToConfidence(probs) {
  const round = (v) => Math.round((v || 0) * 10000) / 10000; // 4 chữ số thập phân
  return {
    sach: round(probs[0]),
    hoiBan: round(probs[1]),
    ratBan: round(probs[2])
  };
}

module.exports = {
  LABELS,
  LABEL_TO_FOLDER,
  LABEL_DISPLAY,
  LABEL_COLOR,
  CLASS_ANCHOR_SCORE,
  probsToScore,
  probsToLabel,
  probsToConfidence
};
