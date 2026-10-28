(function (root) {
  'use strict';
  const STATE_LABELS = { clear: 'Ứng viên: ít dấu hiệu', concern: 'Ứng viên: cần xem xét',
    uncertain: 'Chưa xác định', unobservable: 'Không quan sát đủ' };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const urls = new WeakMap();
  function clear(container) {
    (urls.get(container) || []).forEach(url => URL.revokeObjectURL(url));
    urls.delete(container); container.replaceChildren();
  }
  function render(container, result, files) {
    clear(container);
    const previews = []; urls.set(container, previews);
    const v31 = result.schemaVersion === '3.1';
    container.append(element('h3', '', `DabClean AI V${v31 ? '3.1' : '3'} · Phân tích từng ảnh`));
    container.append(element('p', 'v3-notice', v31
      ? 'Sáu thanh là thang mức độ bẩn qua ảnh, không phải phép đo vật lý. Điểm thiếu giữ trạng thái Chưa xác định. Trọng số và ngưỡng kết luận đang thử nghiệm.'
      : 'Bản thử nghiệm local. Điểm 0–100 và độ tin cậy chưa được hiệu chuẩn trên ảnh DabClean, nên chưa hiển thị phần trăm. Nhận định dưới đây cần được bạn kiểm tra trên ảnh.'));
    if (v31) renderConclusion(container, result.conclusion);
    container.append(element('p', '', result.aggregation.reason));
    for (const image of result.images) {
      const card = element('article', 'v3-image-card');
      card.append(element('h4', '', `Ảnh ${image.id} · ${image.filename}`));
      if (files[image.id - 1]) {
        const preview = element('img', 'v3-preview');
        const url = URL.createObjectURL(files[image.id - 1]); previews.push(url);
        preview.src = url; preview.alt = `Ảnh gốc số ${image.id}`; card.append(preview);
      }
      if (image.duplicateOf) card.append(element('p', 'v3-notice', `Trùng nội dung ảnh ${image.duplicateOf}; không phân tích lặp.`));
      const warnings = image.quality.warnings;
      const warningNames = { too_dark: 'quá tối', overexposed: 'quá sáng', low_detail_or_blur: 'ít chi tiết hoặc mờ', low_resolution: 'độ phân giải thấp' };
      card.append(element('p', 'v3-visibility', warnings.length
        ? `Cần chụp lại: ${warnings.map(w => warningNames[w] || w).join(', ')}.`
        : 'Ảnh qua sàng lọc độ sáng/chi tiết. Điều này chưa xác nhận mọi bề mặt đều nhìn rõ.'));
      const list = element('div', 'v3-metrics');
      for (const item of image.metrics) {
        const row = element('section', 'v3-metric');
        row.append(element('h5', '', item.label));
        // A missing observation NEVER becomes zero. Only calibrated numeric values may make a bar.
        if (v31) {
          const known = item.status === 'assessed' && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100
            && item.validation?.status === 'validated';
          const value = known ? item.score : null;
          row.append(element('strong', known ? 'v31-value' : 'v3-unknown', known ? `${value}%` : 'Chưa xác định'));
          const track = element('div', known ? 'v31-track' : 'v31-track v31-track-unknown');
          track.dataset.criterion = item.key;
          if (known) {
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
            track.setAttribute('aria-valuenow', String(value)); track.setAttribute('aria-label', item.label);
            const fill = element('div', 'v31-fill'); fill.style.width = `${value}%`;
            const policy = result.scoringPolicy;
            fill.style.backgroundColor = value >= policy.severeAt ? policy.colors.severe
              : value >= policy.veryDirtyAt ? policy.colors.high : value >= policy.slightlyDirtyAt ? policy.colors.medium : policy.colors.low;
            track.append(fill);
          } else { track.setAttribute('role', 'img'); track.setAttribute('aria-label', `${item.label}: Chưa xác định`); }
          row.append(track);
        } else if (item.status === 'assessed' && Number.isFinite(item.score) && result.calibrated === true) {
          const value = Math.max(0, Math.min(100, item.score));
          const meter = element('progress', 'v3-score'); meter.max = 100; meter.value = value;
          row.append(element('strong', '', `${value}/100`), meter);
        } else row.append(element('strong', 'v3-unknown', 'Không đủ dữ liệu để chấm điểm'));
        let details;
        if (item.candidate) {
          details = element('details', 'v31-hypothesis');
          details.append(element('summary', '', 'Nhận xét thử nghiệm · chưa xác nhận'));
          details.append(element('p', 'v3-candidate', STATE_LABELS[item.candidate.state] || 'Ứng viên chưa kiểm chứng'));
          details.append(element('p', '', item.candidate.description)); row.append(details);
        }
        for (const evidence of item.evidence || []) {
          if (evidence.kind === 'calibrated_visual_observation') row.append(element('p', '', `Bằng chứng: ${evidence.text}`));
          if (evidence.kind === 'model_observation_unverified') {
            const target = details || row;
            if (evidence.location) target.append(element('p', '', `Vị trí mô hình mô tả: ${evidence.location}`));
            if (evidence.alternativeExplanation) target.append(element('p', '', `Cách giải thích khác: ${evidence.alternativeExplanation}`));
          }
        }
        row.append(element('small', '', item.reason)); list.append(row);
      }
      card.append(list);
      if (v31 && result.images.length > 1) renderConclusion(card, image.conclusion);
      for (const note of image.limitations || []) card.append(element('p', 'v3-visibility', note));
      container.append(card);
    }
    container.append(element('p', 'v3-notice', 'Không vẽ vùng nhận diện khi chưa có mô hình định vị được kiểm chứng. Hãy chụp thêm góc sàn/bề mặt bị khuất hoặc ảnh cận cảnh vết bẩn.'));
    container.append(element('p', '', result.pricing.reason));
  }
  function renderConclusion(container, conclusion) {
    if (!conclusion) return;
    const panel = element('section', 'v31-conclusion');
    panel.append(element('h3', '', `Kết luận tổng thể: ${conclusion.label}`));
    if (conclusion.classification && Number.isFinite(conclusion.score)) panel.append(element('strong', '', `Điểm tổng hợp: ${conclusion.score}/100`));
    panel.append(element('p', '', conclusion.explanation));
    for (const warning of conclusion.warnings || []) panel.append(element('p', 'v31-warning', warning.message));
    panel.append(element('h4', '', 'Khu vực cần vệ sinh'));
    if (!conclusion.attentionAreas?.length) panel.append(element('p', '', 'Chưa xác định được vùng có vấn đề bằng bằng chứng đã kiểm chứng.'));
    for (const area of conclusion.attentionAreas || []) panel.append(element('p', '', `${area.location}: ${area.evidence}`));
    panel.append(element('h4', '', 'Gợi ý'));
    for (const suggestion of conclusion.suggestions || []) panel.append(element('p', '', suggestion));
    container.append(panel);
  }
  root.DabCleanAiV3 = { render, clear };
})(window);
