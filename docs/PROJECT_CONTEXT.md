# Ghi nhớ dự án DabClean / CleanNova

Cập nhật: 2026-10-29. Nguồn: khảo sát mã nguồn tại `D:/Documents/DabClean` theo yêu cầu chủ dự án. Đây là bản đồ dự án phục vụ các lần làm việc tiếp theo, không phải báo cáo nghiệm thu hay audit bảo mật đầy đủ. Đọc lại code và git diff trước khi sửa vì thông tin có thể thay đổi.

## Bổ sung sau triển khai AI V3 thử nghiệm (2026-10-29)

- V3.1 tiếp theo: xem `docs/AI_V31_REPORT.md`. Có sáu thanh luôn hiển thị (unknown riêng), `/api/ai/v3.1/analyze`, trọng số 20/20/15/20/15/10 và ngưỡng thử nghiệm 30/60. Thiếu tiêu chí hoặc vùng bẩn nặng bị trung bình che khuất thì không kết luận sạch tự động.
- Portable Ollama 0.40.12 và qwen3-vl:2b-instruct đã được tải vào ai-module/.cache, chạy CPU do GPU/driver lỗi PTX. Đã suy luận thật một ảnh phòng (~39,7s), một lượt thử ảnh khác timeout; chưa chứng minh accuracy. `npm run ollama:local` + `npm start` để mở demo. Runtime local/weights không commit.
- V3.1 chỉ mở score khi mapping từ nhãn người đánh giá có validation đúng model digest/prompt; hiện chưa có artifact thật. Các số trong unit test không phải ground truth ảnh. Công cụ nhập nhãn độc lập tại /label-v31.html; benchmark:v31 cần nhãn tổng thể và sáu tiêu chí, hiện bị chặn. Không tự push.

- Xem `docs/AI_V3_REPORT.md` để biết phạm vi thực sự, các file thay đổi, test pass/fail và giới hạn. Chưa có model sáu tiêu chí được huấn luyện/kiểm định; không tuyên bố V3 đã cải thiện độ chính xác.
- Thêm `/api/ai/v3/analyze`, CLIP local (Transformers.js/ONNX), adapter VLM Ollama loopback, worker timeout/giới hạn upload, UI tại `ai-module/public/v3.html` và scanner đặt lịch. Chưa hiệu chuẩn: điểm/confidence để null; CLIP chỉ có ứng viên bừa bộn thử nghiệm, năm tiêu chí còn lại từ chối đánh giá. V3 không đổi giá và không trung bình góc chụp. V2/model cũ giữ lại.
- Dataset thật tìm thấy ở `D:/folder anh/dataset`: 597 ảnh (200/198/199). Audit không có cặp trùng byte, có năm cặp dHash gần giống cần người duyệt; ba ảnh vượt 16 triệu pixel. Chưa có room/source provenance hoặc nhãn sáu tiêu chí độc lập.
- Node 22+ cho V3; `npm ci` riêng từng package. Trong ai-module có `npm run prepare:v3`, `npm test` (21 test), `npm run benchmark:v3`. Benchmark accuracy bị chặn vì chưa có dataset được gán nhãn/phân nhóm phù hợp. Không dùng smoke test thay benchmark.
- Sửa căn nhóm augmentation thất bại, yêu cầu `--groups` khi train và output directory mới. Không ghi đè model cũ. Các suite hồi quy nghiệp vụ vẫn có lỗi giống baseline; cần đọc báo cáo trước khi khẳng định pass toàn hệ thống.
- Cache/ảnh/log riêng tư ở `ai-module/.cache/` và `benchmark/private/` bị gitignore. Cấu hình V3 standalone thuộc ai-module/.env, tích hợp thuộc backend/.env. Không thêm secret thực vào ghi chú.

## Quy tắc làm việc

- Đọc và tuân thủ `AGENTS.md` ở gốc và `.agents/skills/cleannova-engineer/SKILL.md`.
- Ưu tiên tính đúng đắn, bảo mật, dữ liệu nhất quán và kiểm thử có thể tái lập.
- Không tự thay đổi giá, nghiệp vụ, state machine, API hoặc schema ngoài yêu cầu. Quy tắc nghiệp vụ chưa rõ cần được chủ dự án xác nhận.
- Không dùng kết quả in-memory để khẳng định MySQL đúng; không tuyên bố pass khi chưa chạy test.
- Không lưu secret, nội dung `.env`, token, mật khẩu hoặc dữ liệu cá nhân thực trong ghi chú.

## Sản phẩm và kiến trúc

- Website đặt và quản lý dịch vụ vệ sinh; còn có dịch vụ chăm sóc trẻ em, người cao tuổi, bệnh nhân và vệ sinh sau xây dựng.
- Tên DabClean và CleanNova cùng tồn tại trong tài liệu, API adapter, database và mã nguồn; không tự đổi tên hàng loạt.
- Bốn nhóm truy cập: guest, customer, staff, admin. Guest là trạng thái chưa đăng nhập.
- Frontend: HTML/CSS/Vanilla JavaScript trong `frontend/`, không có package.json riêng ở thư mục này.
- Backend: Node.js/CommonJS, Express 4, MySQL2, JWT, bcryptjs, Multer, Socket.IO.
- Hai package độc lập: `backend/package.json` và `ai-module/package.json`; phải cài dependency riêng từng thư mục. Không có package.json ở gốc tại thời điểm khảo sát.
- Dữ liệu MySQL mặc định: `cleanova_db`; schema và seed ở `database/schema.sql`, `database/seed.sql`.

## Điểm vào và luồng request

- `backend/server.js`: nạp `backend/.env`, tạo HTTP server, gắn Socket.IO, mặc định cổng 5000, host `0.0.0.0`.
- `backend/src/app.js`: CORS, parser, API routers, frontend tĩnh, error handler. `/` trả `trangchu.html`; `/api/health` trả cả `mysql_connected`.
- Các API prefix: `/api/auth`, `/api/services`, `/api/bookings`, `/api/admin`, `/api/staff`, `/api/partner`, `/api/ai`, `/api/wallet`, `/api/vouchers`.
- Luồng thường gặp: `frontend/api.js` -> `backend/src/routes/` -> `middleware/` -> `controllers/` -> `models/` -> `config/db.js`.
- Adapter có hai alias `window.DabCleanAPI` và `window.CleanovaAPI`; hỗ trợ khóa phiên cả `dabclean_*` và `cleanova_*`, gửi Bearer JWT và xử lý 401/tài khoản vô hiệu hóa.
- Trang chính: `trangchu.html`, `services.html`, `booking.html`, `booking-care.html`, `my-bookings.html`, `profile.html`, `wallet.html`, `staff.html`, `admin.html`, `partner-register.html`.

## Các miền nghiệp vụ và file cần đọc

- Xác thực: `controllers/authController.js`, `models/userModel.js`, `middleware/authMiddleware.js`, `config/jwt.js` trong `backend/src/`.
- Middleware HTTP xác minh JWT rồi tải user hiện tại từ DB, chặn tài khoản inactive/deactivated. Admin router dùng `verifyToken` + `adminRequired`; staff router dùng `verifyToken` + `staffRequired` (staff/admin).
- Giá: `backend/src/services/pricingService.js`; controller đặt lịch gọi service này. Có dịch vụ thường, chăm sóc, sau xây dựng, add-on và tính chiết khấu nhân viên.
- Đặt lịch: `bookingController.js`, `bookingModel.js`; public quote/reviews, còn các route cá nhân yêu cầu JWT. Có hủy, đổi lịch, đánh giá, tip và thông báo.
- Schema có trạng thái đơn: `pending`, `assigned`, `confirmed`, `arrived`, `in_progress`, `completed`, `cancelled`. Đây là danh sách trạng thái, không phải xác nhận mọi chuyển đổi được phép.
- Staff: nhận ca, công việc được giao, checklist, ảnh công việc, xác nhận tiền mặt và cập nhật tiến độ trong `staffController.js`, `staffRoutes.js`, `utils/jobChecklist.js`, `middleware/jobPhotoUpload.js`.
- Tài chính: `walletModel.js`, `commissionPaymentModel.js`, `walletController.js`; ví customer, ví credit và earnings cho staff, ledger, chiết khấu nhận ca và quyết toán tiền công.
- Voucher: `voucherModel.js`, `voucherController.js`; schema lưu hạn dùng, giới hạn toàn hệ thống/từng khách, dịch vụ áp dụng, quyền dùng cùng gói định kỳ và lịch sử sử dụng.
- Đối tác: `partnerModel.js`, `partnerController.js` và các endpoint admin duyệt/từ chối hồ sơ.
- Realtime: `backend/src/services/socketService.js`, phòng `user_{id}` và `role_{role}`.
- Database có users, services, bookings, booking_job_photos, booking_notifications, reviews, audit_logs, partner_applications, staff_payout_logs, post_construction_configs, wallets, wallet_transactions, wallet_ledger_entries, staff_commission_payments, vouchers, voucher_usages, system_configs.

## Module AI

- `ai-module/` chạy độc lập mặc định cổng 5100, đồng thời router được backend gắn tại `/api/ai` qua `backend/src/routes/aiRoutes.js`.
- TensorFlow.js + MobileNet transfer learning; code ML ở `ai-module/src/ml/`, cấu hình nghiệp vụ ở `src/config/businessRules.js`, tính giá ở `src/pricing/priceCalculator.js`.
- Nhãn theo thứ tự cố định: `sach`, `hoi-ban`, `rat-ban`; không đổi thứ tự tùy tiện vì tương ứng output của model.
- Model hiện có ở `ai-module/model-do-ban2/`: model.json, weights.bin, metadata.json. Dataset bị gitignore.
- Metadata ghi backbone mobilenet-v1-1.0, ảnh 224, embedding 1024; datasetCounts là 200/416/441. Các chỉ số trong metadata là kết quả đã lưu, chưa được chạy lại trong lần khảo sát này.
- README AI còn mô tả dataset 597 ảnh, khác metadata hiện có; cần đối chiếu khi làm việc về chất lượng model.

## Khởi chạy và kiểm thử

- Trong `backend/`: `npm install`, `npm start`, `npm run dev`, `npm test` (chạy `test-comprehensive.js`).
- Trong `ai-module/`: `npm install`, `npm start`, `npm run dev`, `npm run train`, `npm run predict -- <image>`, `npm run evaluate`, `npm run check-formats`.
- Chưa thấy script lint trong hai package; AI không có script test trong package.json.
- Backend có test-comprehensive, test-guest-access, test-rbac-staff, test-return-url, test-14-bugs-verify, test-commission-flow, test-staff-wallet-commission, test-two-staff-wallets, test-realtime-notifications (đều .js).
- Gốc có test-wallet-system.js, test-post-construction.js, test-job-photos-flow.js, test-legal-documents-flow.js, test-homepage-verify.js, test-english-coverage.js, test-care-redesign.js.
- Đọc từng test trước khi chạy: nhiều test gọi server localhost:5000 và có thể tạo/sửa dữ liệu. Chọn DB test phù hợp và kiểm tra điều kiện chạy trước.
- Skill nhắc `ai-module/test/analyze.test.js`, nhưng file đó không có trong danh sách hiện tại; dùng file thực tế, không giả định lệnh trong skill còn đúng.

## Điểm cần xác minh khi sửa lần sau

- `config/db.js` tự gọi `initDatabase()` khi import và có migration tự động. `server.js` không await khởi tạo DB trước listen; chưa kiểm thử tác động của cửa sổ khởi động này.
- MySQL/init lỗi trong production gọi process.exit(1); dev/test tự fallback in-memory, chưa yêu cầu cờ bật rõ ràng như AGENTS.md quy định. README vẫn quảng bá fallback tự động.
- JWT secret thiếu/thuộc blacklist: production thoát khi getJwtSecret được gọi; dev/test sinh ngẫu nhiên. Cần kiểm tra thời điểm kiểm tra secret khi audit startup.
- AI có bảng giá riêng; không giả định đồng nhất với giá đặt lịch backend.
- Socket.IO đọc claims JWT để tham gia phòng; cần kiểm tra lại trạng thái/role hiện tại và vòng đời các phòng khi audit phân quyền realtime.
- README và docs/BIG_UPDATE_PROGRESS.md có các khẳng định hoàn thành/pass từ trước. Không dùng chúng thay cho kiểm thử hiện tại; một số đường dẫn tài liệu trỏ máy cũ.
- Khảo sát này không sửa code ứng dụng, không khởi động server, không chạy test, không xác minh MySQL hoặc đánh giá lại model. Chỉ bổ sung file ghi nhớ này; không cần migration, thay .env hay cài dependency.
