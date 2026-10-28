'use strict';
const { CRITERIA, metric } = require('../v3/contract');
const KEYS = Object.keys(CRITERIA);
const POLICY = Object.freeze({ version: 'six-factor-experimental-1', validatedOnImages: false,
  weights: { dust: .20, clutter: .20, litter: .15, stains: .20, floor: .15, surfaces: .10 },
  slightlyDirtyAt: 30, veryDirtyAt: 60, severeAt: 80, minConfidence: .60,
  colors: { low: '#16803c', medium: '#a16207', high: '#c2410c', severe: '#b91c1c', unknown: '#64748b' } });

function classify(score) {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return score < 30 ? 'sach' : score < 60 ? 'hoi-ban' : 'rat-ban';
}
const LABELS = { sach: 'SẠCH', 'hoi-ban': 'HƠI BẨN', 'rat-ban': 'RẤT BẨN' };
function accepted(m) {
  return m?.status === 'assessed' && Number.isFinite(m.score) && m.score >= 0 && m.score <= 100
    && m.validation?.status === 'validated' && m.validation?.calibrationId
    && Array.isArray(m.evidence) && m.evidence.some(e => e.kind === 'calibrated_visual_observation' && e.text)
    && (m.confidence === null || (m.confidenceStatus === 'calibrated' && Number.isFinite(m.confidence) && m.confidence >= POLICY.minConfidence && m.confidence <= 1));
}
function conclude(input) {
  const metrics = KEYS.map(key => input.find(m => m.key === key) || metric(key, null, 'Thiếu tiêu chí trong kết quả mô hình.'));
  const missing = metrics.filter(m => !accepted(m)).map(m => m.key);
  const warnings = metrics.filter(m => accepted(m) && m.score >= POLICY.severeAt)
    .map(m => ({ key: m.key, message: `${m.label}: mức bẩn nghiêm trọng theo thang thử nghiệm.`, evidence: m.evidence }));
  const unknown = { status: 'insufficient_data', score: null, classification: null,
    label: 'CHƯA ĐỦ DỮ LIỆU', missing, warnings, explanation: 'Cần đủ sáu tiêu chí có bằng chứng và điểm đã qua kiểm tra hiệu chuẩn. Không thay điểm thiếu bằng 0 hoặc chuẩn hóa lại trọng số.',
    attentionAreas: [], suggestions: ['Chụp thêm ảnh rõ nét của sàn và ảnh cận cảnh các bề mặt bị khuất.'] };
  if (missing.length) return unknown;
  const score = Math.round(metrics.reduce((sum, m) => sum + m.score * POLICY.weights[m.key], 0) * 10) / 10;
  const classification = classify(score);
  // A severe localized issue must not disappear in a weighted average.
  if (warnings.length && classification !== 'rat-ban') return { ...unknown, status: 'review_required', score,
    explanation: 'Điểm trung bình che khuất ít nhất một tiêu chí từ 80 trở lên. Cần kiểm tra vùng bẩn nghiêm trọng trước khi kết luận.',
    attentionAreas: warnings.flatMap(w => w.evidence.map(e => ({ criterion: w.key, location: e.location || 'Vùng được mô tả trong ảnh', evidence: e.text }))) };
  const tasks = { dust: 'Lau bụi các bề mặt quan sát được.', clutter: 'Sắp xếp vật dụng đang chắn lối đi hoặc để mất trật tự.',
    litter: 'Thu gom phần rác đã xác định rõ.', stains: 'Xử lý vết bẩn bằng phương pháp phù hợp vật liệu.',
    floor: 'Làm sạch phần sàn có dấu hiệu bẩn.', surfaces: 'Lau sạch bàn, kệ hoặc mặt tủ có dấu hiệu bẩn.' };
  const concerns = metrics.filter(m => m.score >= POLICY.slightlyDirtyAt);
  return { status: 'assessed_experimental', score, classification, label: LABELS[classification], missing: [], warnings,
    explanation: 'Tổng sáu điểm × trọng số thử nghiệm (20/20/15/20/15/10), làm tròn 0,1 trước khi phân loại. Chính sách 30/60 chưa được kiểm định trên benchmark ảnh độc lập.',
    attentionAreas: concerns.flatMap(m => m.evidence.map(e => ({ criterion: m.key, location: e.location || 'Vùng được mô tả trong ảnh', evidence: e.text }))),
    suggestions: concerns.length ? concerns.map(m => tasks[m.key]) : ['Duy trì vệ sinh định kỳ các vùng quan sát được; kết quả không xác nhận vùng khuất.'] };
}
function decorate(result) {
  const images = result.images.map(image => {
    const metrics = KEYS.map(key => (image.metrics || []).find(m => m.key === key) || metric(key));
    return { ...image, metrics: metrics.map(m => accepted(m) ? m : { ...m, score: null, status: 'insufficient_data' }),
      conclusion: conclude(metrics) };
  });
  const unique = images.filter(image => !image.duplicateOf);
  const overall = unique.length === 1 ? unique[0].conclusion : {
    status: 'insufficient_data', score: null, classification: null, label: 'CHƯA ĐỦ DỮ LIỆU',
    explanation: 'Có nhiều góc chụp; chưa xác định vùng trùng để kết luận toàn phòng. Xem kết luận từng ảnh.',
    attentionAreas: [], suggestions: [], warnings: [] };
  return { ...result, schemaVersion: '3.1', scoringPolicy: POLICY, images,
    overallScore: overall.score, conclusion: overall, calibrated: images.some(i => i.metrics.some(accepted)),
    aggregation: { method: unique.length === 1 ? 'single_unique_image' : 'per_image_only', score: overall.score,
      reason: unique.length === 1 ? 'Kết luận chỉ áp dụng vùng quan sát trong một ảnh.' : 'Không trung bình điểm hoặc đếm trùng vùng giữa các góc chụp.' } };
}
module.exports = { POLICY, KEYS, LABELS, accepted, classify, conclude, decorate };
