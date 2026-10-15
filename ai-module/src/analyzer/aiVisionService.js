// ============================================================
// CLEANOVA AI VISION SERVICE - Phân tích đa ảnh (Multiple Images)
// Hỗ trợ cả Cloud AI (Gemini 1.5/2.0 Flash, OpenAI GPT-4o) & Built-in Heuristics
// ============================================================
const { analyzeImage, buildRecommendations } = require('./imageAnalyzer');
const { calculatePrice, resolveDirtLevel } = require('../pricing/priceCalculator');

/**
 * Đóng vai trò chuyên gia đánh giá vệ sinh Cleanova phân tích đa ảnh.
 *
 * @param {Array<{ buffer: Buffer, originalname: string, mimetype: string, size: number }>} files
 * @param {object} options { areaSize, urgency, extras }
 */
async function analyzeMultipleImages(files, options = {}) {
  if (!files || files.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 ảnh không gian cần phân tích.');
  }

  // 1. Thử gọi Cloud AI Vision nếu có cấu hình API KEY (OpenAI hoặc Google Gemini)
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await callGeminiVision(files, options);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn('[AI Vision] Lỗi gọi Gemini Vision, chuyển sang phân tích nội bộ:', err.message);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openAiResult = await callOpenAiVision(files, options);
      if (openAiResult) return openAiResult;
    } catch (err) {
      console.warn('[AI Vision] Lỗi gọi OpenAI Vision, chuyển sang phân tích nội bộ:', err.message);
    }
  }

  // 2. Phân tích nội bộ đa ảnh (Built-in Computer Vision Heuristics)
  return analyzeWithBuiltinMultiImage(files, options);
}

/**
 * Phân tích đa ảnh sử dụng bộ xử lý Computer Vision nội bộ
 */
async function analyzeWithBuiltinMultiImage(files, options = {}) {
  const perImageAnalysis = [];
  let totalScore = 0;
  const combinedSignals = { clutter: 0, stains: 0, dust: 0, brightness: 0, debris: 0 };

  const roomNames = ['Phòng khách', 'Phòng ngủ', 'Phòng bếp', 'Phòng tắm / Toilet', 'Ban công / Khu giặt', 'Hành lang / Cầu thang'];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = { filename: file.originalname, mimetype: file.mimetype, size: file.size };
    const singleAnalysis = await analyzeImage(file.buffer, meta);

    const score = Math.round(singleAnalysis.overallScore);
    totalScore += score;

    // Cộng dồn tín hiệu thị giác
    for (const key of Object.keys(combinedSignals)) {
      combinedSignals[key] += (singleAnalysis.signals[key] || 0);
    }

    // Nhận diện loại phòng dự đoán từ tên file hoặc thứ tự
    let roomType = roomNames[i % roomNames.length];
    const lowerName = file.originalname.toLowerCase();
    if (lowerName.includes('bep') || lowerName.includes('kitchen')) roomType = 'Phòng bếp';
    else if (lowerName.includes('khach') || lowerName.includes('living')) roomType = 'Phòng khách';
    else if (lowerName.includes('ngu') || lowerName.includes('bed')) roomType = 'Phòng ngủ';
    else if (lowerName.includes('tam') || lowerName.includes('ve sinh') || lowerName.includes('bath') || lowerName.includes('wc')) roomType = 'Phòng tắm & WC';
    else if (lowerName.includes('ban cong') || lowerName.includes('balcony')) roomType = 'Ban công & Lô gia';

    // Xác định vấn đề cụ thể
    const issues = [];
    if (singleAnalysis.signals.stains > 40) issues.push('Vết ố mảng bám trên bề mặt');
    if (singleAnalysis.signals.clutter > 45) issues.push('Đồ đạc bừa bộn cần sắp xếp');
    if (singleAnalysis.signals.dust > 45) issues.push('Bụi bặm trên đồ gỗ / đồ nội thất');
    if (singleAnalysis.signals.debris > 35) issues.push('Cặn bẩn, tóc, rác vụn trên sàn');
    if (singleAnalysis.signals.brightness > 60) issues.push('Khu vực thiếu sáng, ẩm thấp');
    if (issues.length === 0) issues.push('Không gian tương đối sạch sẽ, cần quét dọn tiêu chuẩn');

    const severity = score >= 70 ? 'high' : (score >= 40 ? 'medium' : 'low');

    perImageAnalysis.push({
      index: i + 1,
      filename: file.originalname,
      roomType,
      issues: issues.join(', '),
      score,
      severity,
      signals: singleAnalysis.signals
    });
  }

  // Tính trung bình các chỉ số
  const n = files.length;
  const avgScore = Math.round(totalScore / n);
  for (const key of Object.keys(combinedSignals)) {
    combinedSignals[key] = Math.round(combinedSignals[key] / n);
  }

  // Thang điểm 1 đến 5 (1: Rất sạch - 5: Cực kỳ bẩn/Cần dọn dẹp ngay)
  let rating1to5 = 1;
  let ratingLabel = 'Rất sạch (1/5)';
  if (avgScore >= 80) {
    rating1to5 = 5;
    ratingLabel = 'Cực kỳ bẩn / Cần dọn dẹp ngay (5/5)';
  } else if (avgScore >= 65) {
    rating1to5 = 4;
    ratingLabel = 'Bẩn nhiều / Cần dọn sâu (4/5)';
  } else if (avgScore >= 45) {
    rating1to5 = 3;
    ratingLabel = 'Bẩn vừa / Cần vệ sinh định kỳ (3/5)';
  } else if (avgScore >= 25) {
    rating1to5 = 2;
    ratingLabel = 'Bẩn nhẹ / Tương đối sạch (2/5)';
  }

  // Báo giá & Khuyến nghị
  const compositeAnalysis = {
    analyzer: 'cleanova-vision-multi',
    overallScore: avgScore,
    signals: combinedSignals,
    findings: perImageAnalysis.map(p => ({ label: `${p.roomType}: ${p.issues}`, score: p.score, severity: p.severity }))
  };

  const dirtLevel = resolveDirtLevel(avgScore);
  const quote = calculatePrice(compositeAnalysis, {
    areaSize: options.areaSize,
    urgency: options.urgency,
    extras: options.extras
  });

  const recommendations = buildRecommendations(combinedSignals, dirtLevel.level);

  // Thêm khuyến nghị theo từng phòng
  perImageAnalysis.forEach(p => {
    if (p.severity === 'high') {
      recommendations.unshift(`[${p.roomType}] Mức độ bẩn ${p.score}/100: Ưu tiên xử lý ${p.issues.toLowerCase()}.`);
    }
  });

  // Ước lượng thời gian cần thiết
  let estimatedHours = '2 - 3 giờ';
  if (avgScore >= 75 || files.length >= 4) {
    estimatedHours = '4 - 6 giờ (2 nhân viên)';
  } else if (avgScore >= 50 || files.length >= 2) {
    estimatedHours = '3 - 4 giờ';
  }

  quote.estimatedHours = estimatedHours;
  if (quote.recommendedService) {
    quote.recommendedService.estimatedHours = estimatedHours;
  }

  const summary = `AI Cleanova Vision đã phân tích tổng hợp ${files.length} không gian. Đánh giá độ bẩn chung đạt ${rating1to5}/5 sao (${dirtLevel.label}, ${avgScore}/100 điểm). Đề xuất gói "${quote.recommendedService?.name || 'Tổng vệ sinh'}" với thời lượng ước tính khoảng ${estimatedHours}.`;

  return {
    success: true,
    data: {
      rating1to5,
      ratingLabel,
      overallScore: avgScore,
      dirtScore: avgScore,
      dirtLevel,
      totalImages: files.length,
      spaces: perImageAnalysis,
      analysis: compositeAnalysis,
      quote,
      recommendations,
      summary,
      estimatedHours
    }
  };
}

/**
 * Gọi Google Gemini Vision API (khi có GEMINI_API_KEY)
 */
async function callGeminiVision(files, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const promptText = `
Dưới đây là ${files.length} bức ảnh về các không gian cần dọn dẹp của khách hàng. Hãy đóng vai trò là chuyên gia đánh giá vệ sinh cao cấp của Cleannova:
1. Phân tích độ bẩn, lộn xộn của từng không gian trong ảnh (nêu rõ phòng nào, vấn đề gì: bụi bẩn, rác, đồ đạc bừa bộn, vết ố dầu mỡ...).
2. Đánh giá mức độ bẩn chung theo thang điểm từ 1 đến 5 (1: Rất sạch - 5: Cực kỳ bẩn/Cần dọn dẹp ngay).
3. Đưa ra gợi ý dịch vụ dọn dẹp phù hợp nhất của Cleannova (Dọn dẹp theo giờ, Tổng vệ sinh Deep Cleaning, Giặt sofa/nệm, Vệ sinh văn phòng...) kèm ước lượng thời gian cần thiết.

Bắt buộc trả về đúng định dạng JSON hợp lệ duy nhất:
{
  "rating1to5": <số từ 1 đến 5>,
  "overallScore": <số từ 0 đến 100>,
  "spaces": [
    {
      "index": 1,
      "roomType": "Tên phòng",
      "issues": "Chi tiết vấn đề nhận diện",
      "score": <số 0-100>,
      "severity": "low|medium|high"
    }
  ],
  "signals": {
    "stains": <0-100>,
    "clutter": <0-100>,
    "dust": <0-100>,
    "debris": <0-100>,
    "brightness": <0-100>
  },
  "recommendedServiceName": "Tên dịch vụ đề xuất",
  "estimatedHours": "X - Y giờ",
  "reason": "Lý do đề xuất dịch vụ",
  "summary": "Đoạn văn tóm tắt đánh giá"
}
`;

  const contents = [
    {
      parts: [
        { text: promptText },
        ...files.map(f => ({
          inlineData: {
            mimeType: f.mimetype || 'image/jpeg',
            data: f.buffer.toString('base64')
          }
        }))
      ]
    }
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'application/json' } })
  });

  if (!res.ok) {
    throw new Error(`Gemini Vision API status ${res.status}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Không nhận được nội dung từ Gemini');

  const parsed = JSON.parse(text);
  const avgScore = parsed.overallScore || 50;
  const dirtLevel = resolveDirtLevel(avgScore);

  const compositeAnalysis = {
    analyzer: 'gemini-vision',
    overallScore: avgScore,
    signals: parsed.signals || { stains: 50, clutter: 50, dust: 50, debris: 50, brightness: 50 },
    findings: (parsed.spaces || []).map(s => ({ label: `${s.roomType}: ${s.issues}`, score: s.score, severity: s.severity }))
  };

  const quote = calculatePrice(compositeAnalysis, {
    areaSize: options.areaSize,
    urgency: options.urgency,
    extras: options.extras
  });

  quote.estimatedHours = parsed.estimatedHours || '3 - 4 giờ';

  return {
    success: true,
    data: {
      rating1to5: parsed.rating1to5 || 3,
      ratingLabel: `${parsed.rating1to5 || 3}/5 sao`,
      overallScore: avgScore,
      dirtScore: avgScore,
      dirtLevel,
      totalImages: files.length,
      spaces: parsed.spaces || [],
      analysis: compositeAnalysis,
      quote,
      recommendations: [parsed.reason, parsed.summary].filter(Boolean),
      summary: parsed.summary || 'Đã hoàn tất phân tích bằng AI Vision.',
      estimatedHours: parsed.estimatedHours || '3 - 4 giờ'
    }
  };
}

/**
 * Gọi OpenAI GPT-4o Vision API (khi có OPENAI_API_KEY)
 */
async function callOpenAiVision(files, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const promptText = `
Dưới đây là ${files.length} bức ảnh về các không gian cần dọn dẹp của khách hàng. Hãy đóng vai trò là chuyên gia đánh giá vệ sinh cao cấp của Cleannova:
1. Phân tích độ bẩn, lộn xộn của từng không gian trong ảnh (nêu rõ phòng nào, vấn đề gì: bụi bẩn, rác, đồ đạc bừa bộn, vết ố...).
2. Đánh giá mức độ bẩn chung theo thang điểm từ 1 đến 5 (1: Rất sạch - 5: Cực kỳ bẩn/Cần dọn dẹp ngay).
3. Đưa ra gợi ý dịch vụ dọn dẹp phù hợp nhất của Cleannova kèm ước lượng thời gian cần thiết.

Trả về JSON:
{
  "rating1to5": <1-5>,
  "overallScore": <0-100>,
  "spaces": [{ "index": 1, "roomType": "...", "issues": "...", "score": 50, "severity": "low|medium|high" }],
  "signals": { "stains": 40, "clutter": 50, "dust": 40, "debris": 30, "brightness": 60 },
  "recommendedServiceName": "...",
  "estimatedHours": "X - Y giờ",
  "reason": "...",
  "summary": "..."
}
`;

  const content = [
    { type: 'text', text: promptText },
    ...files.map(f => ({
      type: 'image_url',
      image_url: { url: `data:${f.mimetype || 'image/jpeg'};base64,${f.buffer.toString('base64')}` }
    }))
  ];

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }]
    })
  });

  if (!res.ok) throw new Error(`OpenAI API status ${res.status}`);

  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const avgScore = parsed.overallScore || 50;
  const dirtLevel = resolveDirtLevel(avgScore);

  const compositeAnalysis = {
    analyzer: 'openai-vision',
    overallScore: avgScore,
    signals: parsed.signals || { stains: 50, clutter: 50, dust: 50, debris: 50, brightness: 50 },
    findings: (parsed.spaces || []).map(s => ({ label: `${s.roomType}: ${s.issues}`, score: s.score, severity: s.severity }))
  };

  const quote = calculatePrice(compositeAnalysis, {
    areaSize: options.areaSize,
    urgency: options.urgency,
    extras: options.extras
  });

  quote.estimatedHours = parsed.estimatedHours || '3 - 4 giờ';

  return {
    success: true,
    data: {
      rating1to5: parsed.rating1to5 || 3,
      ratingLabel: `${parsed.rating1to5 || 3}/5 sao`,
      overallScore: avgScore,
      dirtScore: avgScore,
      dirtLevel,
      totalImages: files.length,
      spaces: parsed.spaces || [],
      analysis: compositeAnalysis,
      quote,
      recommendations: [parsed.reason, parsed.summary].filter(Boolean),
      summary: parsed.summary || 'Đã hoàn tất phân tích qua AI Vision.',
      estimatedHours: parsed.estimatedHours || '3 - 4 giờ'
    }
  };
}

module.exports = {
  analyzeMultipleImages
};
