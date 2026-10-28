'use strict';
const fields = { dust: 'Độ bụi', clutter: 'Độ bừa bộn', litter: 'Rác thải', stains: 'Vết bẩn', floor: 'Mức bẩn của sàn', surfaces: 'Mức bẩn bề mặt' };
const annotations = [], controls = {};
function node(tag, text) { const n = document.createElement(tag); if (text) n.textContent = text; return n; }
for (const [key, name] of Object.entries(fields)) {
  const group = node('fieldset'); group.append(node('legend', name));
  const state = node('select'); state.setAttribute('aria-label', name + ' · khả năng quan sát');
  for (const [value, label] of [['unobservable', 'Không quan sát đủ'], ['uncertain', 'Không chắc chắn'], ['clear', 'Không có dấu hiệu bẩn đáng kể'], ['concern', 'Có dấu hiệu bẩn']]) {
    const option = node('option', label); option.value = value; state.append(option);
  }
  const scoreLabel = node('label', 'Điểm tham chiếu 0–100 (để trống nếu chưa có rubric phù hợp)');
  const score = node('input'); score.type = 'number'; score.min = '0'; score.max = '100'; score.step = '1'; score.disabled = true; scoreLabel.append(score);
  const evidenceLabel = node('label', 'Bằng chứng và vùng quan sát'); const evidence = node('textarea'); evidence.maxLength = 600; evidenceLabel.append(evidence);
  state.addEventListener('change', () => { score.disabled = ['unobservable', 'uncertain'].includes(state.value); if (score.disabled) score.value = ''; });
  group.append(state, scoreLabel, evidenceLabel); document.getElementById('criteria').append(group); controls[key] = { state, score, evidence };
}
let previewUrl;
document.getElementById('photo').addEventListener('change', event => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = event.target.files[0], preview = document.getElementById('preview');
  preview.hidden = !file; if (file) { previewUrl = URL.createObjectURL(file); preview.src = previewUrl; }
  // Starting a new image never carries previous scores into its labels.
  for (const control of Object.values(controls)) { control.state.value = 'unobservable'; control.score.value = ''; control.score.disabled = true; control.evidence.value = ''; }
  document.getElementById('overall').value = '';
});
document.getElementById('label-form').addEventListener('submit', event => {
  event.preventDefault();
  const file = document.getElementById('photo').files[0]; if (!file) return;
  const labels = {};
  for (const [key, control] of Object.entries(controls)) {
    labels[key] = { state: control.state.value, score: control.score.disabled || control.score.value === '' ? null : Number(control.score.value), evidence: control.evidence.value.trim() };
    if (['clear', 'concern'].includes(labels[key].state) && !labels[key].evidence) { document.getElementById('status').textContent = 'Cần ghi bằng chứng cho tiêu chí quan sát được.'; return; }
  }
  const record = { id: file.name, roomId: document.getElementById('room').value.trim(),
    reviewer: document.getElementById('reviewer').value.trim(), overallLabel: document.getElementById('overall').value || null, labels };
  if (!record.roomId || !record.reviewer) { document.getElementById('status').textContent = 'Mã phòng và mã người đánh giá không được để trống.'; return; }
  const existing = annotations.findIndex(a => a.id === record.id && a.reviewer === record.reviewer);
  if (existing >= 0) annotations[existing] = record; else annotations.push(record);
  document.getElementById('status').textContent = `Có ${annotations.length} bản nháp. Chưa xác nhận đồng thuận giữa hai người.`;
  document.getElementById('export').disabled = false;
});
document.getElementById('export').addEventListener('click', () => {
  const data = { type: 'independent-human-review-draft', consensusReviewed: false, annotations };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = node('a'); link.href = url; link.download = 'dabclean-independent-labels.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
