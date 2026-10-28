# DabClean AI V3.1 — sáu thanh, scoring engine và kiểm chứng

Ngày 29/10/2026, workspace `D:/Documents/DabClean`. Phát triển tiếp trên V3 chưa commit. **Chưa có benchmark ảnh độc lập đủ nhãn để khẳng định độ chính xác sáu điểm hoặc ba mức sạch.** Không push GitHub. Không sửa bảng giá, schema hay nghiệp vụ đặt lịch/ví.

## Đã triển khai

- Endpoint mới `POST /api/ai/v3.1/analyze`, `GET /api/ai/v3.1/capabilities`; giữ `/v3`, `/scan`, `/estimate` và model MobileNet cũ.
- Giao diện luôn đủ sáu thanh cho từng ảnh: độ bụi, bừa bộn, rác, vết bẩn, mức bẩn sàn, mức bẩn bề mặt. Điểm hợp lệ hiển thị phần trăm, màu và bằng chứng. Thanh thiếu dữ liệu có nền sọc trung tính, nhãn **Chưa xác định**, không có số 0 hoặc giá trị ARIA giả.
- Kết luận SẠCH / HƠI BẨN / RẤT BẨN khi đủ điều kiện, hoặc CHƯA ĐỦ DỮ LIỆU. Có giải thích, khu vực cần vệ sinh và gợi ý dựa trên tiêu chí được chấp nhận. Nhận xét VLM chưa kiểm chứng nằm trong mục thu gọn, không trở thành vùng cần vệ sinh được xác nhận.
- Scoring engine ở backend: trọng số bụi/bừa bộn/rác/vết bẩn/sàn/bề mặt = 20/20/15/20/15/10%. Tổng làm tròn 0,1 trước phân loại: <30 sạch, <60 hơi bẩn, còn lại rất bẩn. Chính sách có version và `validatedOnImages:false`; ngưỡng màu lấy từ cùng chính sách, không dùng làm xác suất.
- Thiếu một tiêu chí, score sai kiểu/ngoài miền, thiếu bằng chứng, chưa hiệu chuẩn hoặc confidence được hiệu chuẩn dưới 0,60: không kết luận. Không chuẩn hóa lại trọng số cho phần dữ liệu còn lại. Không lấy điểm tự báo của model làm confidence.
- Quy tắc cảnh báo thử nghiệm: nếu một tiêu chí >=80 mà trung bình <60, yêu cầu kiểm tra và không công bố kết luận sạch/hơi bẩn tự động. Ngưỡng 80 và confidence 0,60 là chốt vận hành thử nghiệm, chưa phải ngưỡng học từ dữ liệu. Các biên và trường hợp điểm trung bình che khuất vùng bẩn đã được kiểm thử logic.
- Nhiều góc khác nhau vẫn kết luận riêng từng ảnh, không trung bình tùy tiện. Ảnh trùng nội dung không tăng số vùng quan sát. Một ảnh không được coi là đã quan sát toàn bộ phòng.

## Cách sinh điểm sáu tiêu chí

Không có công thức màu sắc, đếm vật thể, CLIP similarity × 100 hoặc band × 25. Pipeline V3.1 dùng VLM local xuất **quan sát có cấu trúc**, với mỗi tiêu chí gồm khả năng quan sát, tình trạng mơ hồ, band thứ tự -1/0/1/2/3/4, bằng chứng, vị trí và cách giải thích thay thế. Band chỉ là giả thuyết chưa hiệu chuẩn, không phải phần trăm.

Để một band được đổi thành score, cần artifact `human-band-regression-1` được fit từ nhãn người đánh giá:

1. Dữ liệu ảnh thật có hai người đánh giá độc lập và adjudication, nhóm phòng không giao nhau giữa train/calibration/test; kiểm tra hash và ứng viên gần trùng bằng validator hiện có.
2. Capture quan sát VLM trên train/calibration. Ghép đúng SHA256 ảnh và cùng model name/digest/prompt version; không sử dụng ảnh test để fit.
3. Theo từng tiêu chí và band, score là trung bình **nhãn tham chiếu của người đánh giá trên train**, được kiểm tra trên phòng calibration riêng. Yêu cầu thử nghiệm hiện tại: ít nhất 5 phòng train và 5 phòng calibration cho mỗi band được mở, MAE calibration <=15 và sai số lớn nhất <=25. Các điều kiện này chưa thay cho benchmark độc lập hoặc khoảng tin cậy thống kê.
4. Nếu các band đi ngược thứ tự mức độ, không mở mapping tiêu chí đó. Model/prompt thay đổi, band thiếu dữ liệu, quan sát mơ hồ, vùng không thấy hoặc artifact sai phiên bản đều trả score null. Artifact lỗi cấu hình báo lỗi thay vì tạo kết quả dự phòng.
5. Không tạo confidence từ MAE hoặc từ lời model. Khi chưa ước lượng confidence phù hợp, trường này giữ null; việc chấp nhận score dựa trên kiểm tra mapping calibration, không giả định confidence=100%.

**Hiện chưa có artifact thật được fit hoặc đưa vào phục vụ.** Vì thiếu nhãn tham chiếu độc lập, lượt quét hiện tại hiển thị đủ sáu thanh Chưa xác định và không ép ra một trong ba nhãn. Unit fixtures có số chỉ dùng kiểm tra code, không phải ảnh benchmark và không được dùng làm kết quả AI thật.

## Model và thử nghiệm thực tế

- Đã tải portable Ollama **0.40.12** từ [release chính thức](https://github.com/ollama/ollama/releases/tag/v0.40.12), kiểm tra SHA256 archive `21814944f3e50d3f07b6bb3af75baddb96f59e91353c332ac9c5063b3bfd1041` trước giải nén. Runtime ở `ai-module/.cache/ollama`, weights ở `.cache/ollama-models`; archive tải về đã được dọn sau giải nén. Không thêm binary/model vào Git, không sửa PATH, không cài service khởi động cùng Windows.
- Đã pull và chạy thật [qwen3-vl:2b-instruct](https://ollama.com/library/qwen3-vl:2b-instruct), digest `afc393e3572c07db0bc84aa460d928a16c75f3fbb9ca9e0dccc4fbd2dafb573e`, prompt `six-factor-observations-1`. Model card công bố Apache-2.0; [Ollama hỗ trợ structured JSON](https://docs.ollama.com/capabilities/structured-outputs). Khả năng được nhà cung cấp mô tả không phải kết quả benchmark của DabClean.
- GPU GTX 1050 Ti/driver hiện tại gặp lỗi PTX toolchain khi tải model; đã chạy lại riêng Ollama bằng CPU, không đổi driver. Máy 16 GB RAM. Một lần đo `llama-server` working set khoảng 3,23 GB; client worker RSS khoảng 84 MB **không bao gồm model server**.
- Một ảnh phòng thật có sẵn ở `D:/folder anh/dataset/sach/sach-001.jpg` được xử lý thành công trong **39.721 ms** trên CPU. Có quan sát cho các tiêu chí, nhưng ví dụ model vừa mô tả bụi nhẹ vừa đưa band 0 và dùng lại nhận xét cho nhiều vùng: chưa đáng tin để suy ra score. Không dùng tên thư mục `sach` làm ground truth sáu tiêu chí.
- Các lượt thử trước đó có lỗi GPU và một timeout CPU với prompt dài; lượt thử ảnh `hoi-ban-001.jpg` cũng chạm giới hạn request 120 giây, nên vòng thử dừng trước ảnh `rat-ban-001.jpg`. Không có kết quả thay thế giả. Runtime 39,7 giây là một smoke observation, không phải latency trung bình hoặc độ chính xác.
- CLIP V3 vẫn sẵn để đối chiếu/rollback; V3.1 mặc định Ollama và không tự chuyển sang CLIP hay dịch vụ cloud khi lỗi. Ảnh chỉ gửi loopback tới model cùng máy chủ. Ollama bật `OLLAMA_NO_CLOUD=1`. Lần chạy CLI đầu tiên tạo khóa local mặc định trong `C:/Users/admin/.ollama`; runtime không được dùng để gửi ảnh lên cloud.

## Dữ liệu và benchmark

Dataset ba nhãn cũ đã audit ở V3: 597 ảnh, chưa có nhãn điểm sáu tiêu chí, nhãn tổng thể được đánh giá độc lập hoặc thông tin nhóm phòng đầy đủ. Không tự sinh nhãn để lấp chỗ trống.

Thêm công cụ gán nhãn local tại `http://127.0.0.1:5100/label-v31.html`: người đánh giá mở ảnh trong trình duyệt, điền sáu trạng thái/điểm/bằng chứng và nhãn tổng thể. Không có score mặc định; vùng không quan sát được không nhận số. Export là bản nháp của **một** reviewer, chưa tự biến thành consensus. Hai người làm độc lập, sau đó đối chiếu theo [quy trình dataset](../ai-module/benchmark/README.md) để tạo reviewed manifest. Tool không upload hoặc tự lưu ảnh.

Manifest V3.1 cần bổ sung `overallLabel` (`sach`, `hoi-ban`, `rat-ban`) cho mỗi ảnh test, nhãn này do người đánh giá xác lập, không tự tính từ công thức thử nghiệm. Bao phủ cặp nhiều đồ gọn/lộn xộn, ít đồ sạch/bẩn, hoa văn/bụi-vết bẩn, ánh sáng rõ/tối-mờ. Giữ roomId của các góc/cặp cùng phòng trong cùng split. Giữ ảnh test chưa từng dùng huấn luyện/fit/calibration.

`npm run benchmark:v31` hiện trả **blocked_missing_reference_data**, thiếu dataset thật có nhãn và phòng test độc lập. `overall`, `sixFactorMetrics` và `accuracyClaim` là null. Chưa có số accuracy ba mức, MAE sáu tiêu chí, confidence calibration hoặc tỷ lệ từ chối trên tập test đại diện. Không công bố số đó từ unit fixtures.

Harness sẵn đo confusion ba lớp gồm cột abstain, accuracy toàn bộ/riêng các ca được chấp nhận, tỷ lệ từ chối, MAE có coverage cho sáu điểm, các metric và challenge của V3. Phiên bản mapping và chính sách cần đánh giá trên cùng bộ ảnh rồi mới hiệu chỉnh/phê duyệt cho vận hành.

## Kiểm thử và giới hạn

- `npm test` trong ai-module: **32 pass, 0 fail**. Bao gồm 21 test V3 trước đó và test V3.1: trọng số, biên 29.9/30/59.9/60, null/sai kiểu, thiếu dữ liệu, confidence thấp, bằng chứng giả, cảnh báo vùng bẩn nặng, nhiều ảnh, fit mapping từ nhãn tham chiếu, đổi model, leakage, sáu track unknown, sáu track có số bằng fixture, reset kết quả, XSS và metric accuracy/abstention.
- HTTP V3.1 chạy worker thật trên ảnh tối trả sáu tiêu chí thiếu dữ liệu và kết luận chưa đủ dữ liệu, không cần tạo kết quả model giả. V3 vẫn được kiểm tra hồi quy trong cùng suite.
- Dependency audit ai-module: không có cảnh báo đã biết. Không thêm dependency npm cho V3.1; không cần lặp lại clean-install chỉ vì thêm JS/HTML. VLM native là dependency local tùy chọn được ghi rõ riêng.
- Benchmark accuracy thật **chưa chạy được** do thiếu nhãn; chưa huấn luyện/fitting mapping thật. MySQL và toàn bộ booking browser flow chưa được kiểm thử trong lượt này.
- Đã chạy lại sáu suite nghiệp vụ trên server test in-memory tách biệt: comprehensive 19 pass/2 fail; guest 11 pass/1 fail; RBAC 9/10 pass; return-url 12 pass/0 fail; wallet dừng ở assertion truy vấn ví; ảnh công việc 7 pass/14 fail. Tên các dòng fail trùng baseline đã lưu từ bản trước V3; không sửa hoặc vô hiệu hóa test. Đây không phải kết quả MySQL thật và không phải toàn hệ thống đều pass.
- Đã quét ảnh phòng thật qua trình duyệt và endpoint V3.1: thấy đủ sáu thanh chưa xác định, kết luận chưa đủ dữ liệu, giải thích và gợi ý chụp bổ sung; không có số dự phòng giả. Renderer được kiểm tra cả nhánh có số bằng unit fixture và nhánh unknown bằng suy luận thật.
- Không có detection/segmentation đã kiểm định, đo lượng bụi vật lý, xác minh đầy đủ vật thể-vị trí hay hợp nhất hình học các góc chụp. VLM nhỏ có hallucination và CPU có thể timeout. Pipeline giới hạn tài nguyên, hiển thị lỗi và từ chối điểm thiếu cơ sở; không giải quyết những giới hạn đó bằng sáu số tự đặt.

## Chạy, hiệu chuẩn, triển khai và rollback

```powershell
# Working directory: D:/Documents/DabClean/ai-module
npm run ollama:local
# Terminal khác, cùng thư mục:
npm start
# Mở http://127.0.0.1:5100/v3.html
```

Hai tiến trình local đã được khởi động để kiểm tra. Helper Ollama mặc định CPU (đã thử trên máy này), chỉ đặt env cho tiến trình con, loopback, cloud tắt, một model và một lượt xử lý. Dùng `-- --gpu` sau khi tự kiểm tra tương thích GPU; không tự cập nhật driver. Máy khác cần tải portable runtime chính thức, giải nén vào `.cache/ollama`, chạy helper rồi pull model bằng CLI/API local theo [hướng dẫn Windows chính thức](https://docs.ollama.com/windows). Model tải khoảng 1,9 GB; ngoài ra có runtime và RAM/CPU local. Không có phí API cloud, vẫn có chi phí phần cứng và gán nhãn.

```powershell
npm test
npm run smoke:v31 -- "D:\folder anh\dataset\sach\sach-001.jpg"
# Sau khi có reviewed manifest thật, giữ captures/artifact riêng tư:
npm run capture:v31 -- ./benchmark/private/challenge.json ./benchmark/private/captures.json
npm run calibrate:v31 -- ./benchmark/private/challenge.json ./benchmark/private/captures.json ./benchmark/private/calibration-v1.json
npm run benchmark:v31 -- ./benchmark/private/challenge.json ./benchmark/private/results-v31.json
```

Cấu hình `AI_V31_PROVIDER=ollama`, `AI_V31_ENABLED=true`; chỉ đặt `AI_V31_CALIBRATION_FILE` khi có artifact thật đúng model/prompt, rồi restart server và benchmark lại. Standalone đọc `ai-module/.env`; backend tích hợp đọc `backend/.env`. Không cần đổi secret, migration hoặc bảng giá.

Để rollback, chọn V3 trong demo hoặc gọi lại API `/v3/analyze`; tắt `/v3.1` bằng `AI_V31_ENABLED=false`. Trang booking hiện gọi V3.1; nếu cần rollback scanner booking, đổi lời gọi về `analyzeV3` (hàm và endpoint vẫn giữ). Không có fallback âm thầm, không thay đổi tiền cuối cùng dựa vào nhận xét AI.

## File thay đổi trong bước V3.1

- Mới: `ai-module/src/v31/{scoring,calibration,ollamaProvider,worker,routes}.js`.
- Mới: `ai-module/scripts/{capture-v31,calibrate-v31,benchmark-v31,smoke-v31,serve-ollama-local}.js`.
- Mới: `ai-module/public/label-v31.html`, `ai-module/public/label-v31.js`, `ai-module/test/v3/v31.test.js`, `ai-module/benchmark/latest-v31-report.json`, báo cáo này.
- Cập nhật: `ai-module/src/v3/{routes,worker,ollamaProvider}.js` để tái sử dụng upload/worker/provider và giữ contract V3; `ai-module/src/routes/aiRoutes.js` mount endpoint mới.
- Cập nhật UI: `frontend/js/ai-v3.js`, `frontend/css/ai-v3.css`, `frontend/api.js`, `frontend/booking.html`, `ai-module/public/v3.html`, `ai-module/public/v3-demo.js`.
- Cập nhật test/cấu hình/tài liệu: `ai-module/test/v3/{frontend,http}.test.js`, `ai-module/package.json`, `ai-module/.env.example`, README và PROJECT_CONTEXT. Các thay đổi V3 chưa commit từ lượt trước vẫn được giữ.
