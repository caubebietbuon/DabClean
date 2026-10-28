'use strict';
document.getElementById('scan').addEventListener('submit', async event => {
  event.preventDefault();
  const files = Array.from(document.getElementById('images').files);
  const status = document.getElementById('status'), button = document.getElementById('submit');
  const result = document.getElementById('result');
  if (files.length > 4 || files.some(file => file.size > 6 * 1024 * 1024)) {
    status.textContent = 'Chỉ nhận tối đa 4 ảnh, mỗi ảnh 6 MB.'; return;
  }
  button.disabled = true; DabCleanAiV3.clear(result);
  status.textContent = 'Đang phân tích local. Lần đầu cần chuẩn bị model, không có phần trăm tiến trình giả.';
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const body = new FormData(); files.forEach(file => body.append('images', file));
    const version = document.getElementById('version').value === '3.1' ? '3.1' : '3';
    const response = await fetch(`/api/ai/v${version}/analyze`, { method: 'POST', body, signal: controller.signal });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'Phân tích thất bại.');
    DabCleanAiV3.render(result, json.data, files); status.textContent = 'Đã xử lý từng ảnh. Kiểm tra nhận định và giới hạn dưới đây.';
  } catch (err) { status.textContent = err.name === 'AbortError' ? 'Quá thời gian chờ; thử ít ảnh hơn.' : err.message; }
  finally { clearTimeout(timeout); button.disabled = false; }
});
