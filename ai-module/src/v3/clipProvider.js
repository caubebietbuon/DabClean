'use strict';
const path = require('path');
const { GROUPS, PROMPT_VERSION } = require('./prompts');
const { CRITERIA, metric, unavailable, LIMITATION } = require('./contract');
let loading;

async function load() {
  if (!loading) loading = (async () => {
    const { pipeline, env, RawImage } = await import('@huggingface/transformers');
    env.cacheDir = process.env.AI_V3_CACHE_DIR || path.join(__dirname, '../../.cache/v3');
    env.allowRemoteModels = process.env.AI_V3_OFFLINE !== 'true';
    const classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32',
      { dtype: 'q8', device: 'cpu' });
    return { classifier, RawImage };
  })().catch(err => { loading = null; throw err; });
  return loading;
}

async function analyze(buffer) {
  const { classifier, RawImage } = await load();
  const image = await RawImage.fromBlob(new Blob([buffer], { type: 'image/jpeg' }));
  const candidates = Object.values(GROUPS).flat().map(pair => pair[1]);
  // One image encoding, all text candidates. Scores are relative to THIS prompt set only.
  const output = await classifier(image, candidates, { hypothesis_template: 'A photo of {}.' });
  const values = new Map(output.map(item => [item.label, item.score]));
  const rank = key => GROUPS[key].map(([state, description]) => ({ state, description,
    similarity: values.get(description) })).sort((a, b) => b.similarity - a.similarity);
  const scene = rank('scene');
  const room = scene[0].state === 'room';
  if (!room) return { scene: { status: 'uncertain_or_non_room', candidate: scene[0] },
    metrics: unavailable('Ảnh không khớp ứng viên không gian nội thất; chụp toàn cảnh phòng rõ hơn.'), observations: [] };
  return {
    scene: { status: 'candidate', candidate: scene[0] },
    metrics: Object.keys(CRITERIA).map(key => {
      const ranked = rank(key);
      // Whole-image CLIP is not a dust/stain/surface detector. Smoke testing produced
      // spurious stains on a sofa scene: abstain instead of exposing an invented finding.
      if (key !== 'clutter') return metric(key, null,
        'CLIP toàn ảnh chưa có detector được kiểm chứng cho tiêu chí này. Cần ảnh cận cảnh, model chuyên biệt và nhãn tham chiếu; không suy từ mô tả tương đồng.');
      const result = metric(key, { ...ranked[0], source: 'clip_image_text_similarity', promptVersion: PROMPT_VERSION });
      result.evidence = [];
      result.reason = LIMITATION + ' CLIP chỉ đối chiếu mô tả toàn ảnh; ứng viên này chưa phải phát hiện đã xác nhận.';
      return result;
    }),
    observations: [],
    limitations: ['CLIP chưa định vị vật thể, không phân đoạn sàn, không xác minh quan hệ không gian hoặc bụi/vết bẩn nhỏ. Không dùng điểm tương đồng làm confidence.']
  };
}
module.exports = { analyze, load };
