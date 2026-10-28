'use strict';

const CRITERIA = Object.freeze({
  dust: 'Bụi bẩn nhìn thấy', clutter: 'Bừa bộn', litter: 'Rác thải',
  stains: 'Vết bẩn', floor: 'Vệ sinh sàn – mức bẩn', surfaces: 'Vệ sinh bề mặt – mức bẩn'
});
const STATES = ['clear', 'concern', 'unobservable', 'uncertain'];
const LIMITATION = 'Chưa có benchmark đa tiêu chí độc lập và hiệu chuẩn trên dữ liệu DabClean; không quy đổi nhận định thành điểm 0–100 hoặc xác suất tin cậy.';

function metric(key, candidate = null, reason = LIMITATION) {
  return {
    key, label: CRITERIA[key], status: 'insufficient_data', score: null, confidence: null,
    confidenceStatus: 'not_calibrated', candidate, evidence: [], reason
  };
}

function unavailable(reason) {
  return Object.keys(CRITERIA).map(key => metric(key, null, reason));
}

function summarize(images, provider) {
  return {
    schemaVersion: '3.0', provider, experimental: true, calibrated: false,
    overallScore: null,
    images,
    aggregation: {
      method: 'per_image_only', score: null,
      reason: 'Chưa xác định được vùng trùng giữa các góc chụp; không cộng, lấy trung bình hoặc đếm vết bẩn qua nhiều ảnh.'
    },
    pricing: {
      status: 'manual_quote_required', aiSurchargeApplied: false,
      reason: 'Chọn dịch vụ, diện tích và tùy chọn để lấy báo giá từ pricing engine hiện có. Nhận định chưa hiệu chuẩn không làm thay đổi giá.'
    },
    limitations: [LIMITATION, 'Không đánh giá vùng khuất, không đo lượng bụi vật lý, không xác nhận vi khuẩn hoặc nấm mốc từ ảnh.'],
    privacy: { inference: 'local', persistedImages: false, externalImageTransfer: false }
  };
}

module.exports = { CRITERIA, STATES, LIMITATION, metric, unavailable, summarize };
