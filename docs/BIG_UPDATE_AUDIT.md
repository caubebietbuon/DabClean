# DABCLEAN BIG UPDATE — BÁO CÁO AUDIT TOÀN DIỆN HỆ THỐNG
**Phiên bản:** 1.0.0  
**Thời điểm thực hiện:** 2026-10-17  
**Phạm vi:** Toàn bộ repository DabClean (Frontend, Backend, Database, Security, Pricing, Booking, Staff, Admin, AI)

---

## 1. TỔNG QUAN HỆ THỐNG VÀ KIẾN TRÚC HIỆN TẠI

- **Frontend:** Pure HTML5, CSS3 (Design system Emerald Green & Light/Minimal), Vanilla JavaScript ES6+. Không dùng React, Vue, jQuery, Tailwind.
- **Backend:** Node.js & Express.js RESTful API, xác thực JSON Web Token (JWT), mã hóa mật khẩu bcryptjs, kiểm soát phân quyền 4 vai trò (Guest, Customer, Staff, Admin).
- **Database:** MySQL quan hệ (`cleanova_db`) kết hợp cơ chế kiểm tra kết nối fail-safe.
- **Mô-đun AI:** Phân tích ảnh phòng dựa trên mô hình TensorFlow.js (`ai-module`), kèm cơ chế fallback an toàn (HTTP 503) khi module chưa cài dependency, không làm sập server chính.

---

## 2. BẢNG TỔNG HỢP CÁC LỖI & KHIẾM KHUYẾT XÁC MINH (AUDIT FINDINGS)

| Mã ID | Tên vấn đề / Lỗ hổng | Mức độ | File & Hàm liên quan | Trạng thái |
| :--- | :--- | :---: | :--- | :---: |
| **AUD-01** | Chưa có phân hệ Ví DabClean (Wallets, Ledger, Sandbox, Thanh toán ví, Hoàn tiền) | **CRITICAL** | Database, Backend API, Frontend (Chưa tồn tại) | Cần phát triển mới |
| **AUD-02** | Lệch tên cột trong bảng `staff_payout_logs` gây lỗi crash SQL khi Admin quyết toán | **HIGH** | `backend/src/controllers/adminController.js`: `payoutStaffWage` | Cần sửa |
| **AUD-03** | Khuyến mãi / Voucher hardcode trong code, thiếu bảng vouchers & kiểm soát concurrency | **HIGH** | `backend/src/services/pricingService.js`, `bookingController.js` | Cần chuẩn hóa |
| **AUD-04** | Dịch vụ bổ sung (Add-ons) trên `booking.html` chưa được backend tính toán & lưu trữ | **MEDIUM** | `frontend/booking.html` vs `backend/src/services/pricingService.js` | Cần đồng bộ |
| **AUD-05** | Báo cáo tài chính Dashboard Admin chưa tách biệt doanh thu, tiền thu, tiền công, ví và hoàn tiền | **MEDIUM** | `backend/src/models/bookingModel.js`: `getStats()`, `adminController.js` | Cần nâng cấp |
| **AUD-06** | Thiếu Rate Limiting cho endpoint Đăng ký và Đổi mật khẩu | **MEDIUM** | `backend/src/controllers/authController.js` | Cần bổ sung |
| **AUD-07** | Thiếu quản lý danh mục Voucher trên Admin Dashboard | **MEDIUM** | `frontend/admin.html`, `backend/src/controllers/adminController.js` | Cần bổ sung |
| **AUD-08** | Phương thức thanh toán `wallet` chưa được hỗ trợ trong Booking Controller & Frontend | **HIGH** | `backend/src/controllers/bookingController.js`, `frontend/booking.html` | Cần tích hợp |
| **AUD-09** | Trùng lặp phương thức `getQuote` trong `frontend/api.js` | **LOW** | `frontend/api.js`: lines 215 & 276 | Cần dọn dẹp |

---

## 3. CHI TIẾT TỪNG LỖI & PHƯƠNG ÁN XỬ LÝ

### 3.1. AUD-01 (CRITICAL) — XÂY DỰNG PHÂN HỆ VÍ CLEANNOVA (PHASE 4)
- **Vị trí:** Cơ sở dữ liệu, API Backend, Giao diện Khách hàng & Quản trị.
- **Mô tả:** Hệ thống hiện tại hoàn toàn chưa có chức năng Ví điện tử DabClean:
  - Chưa có bảng `wallets`, `wallet_transactions`, `wallet_ledger_entries`.
  - Chưa có API nạp tiền sandbox, thanh toán đơn hàng bằng số dư ví, hoàn tiền về ví khi hủy đơn.
  - Chưa có cơ chế bảo vệ giao dịch bất biến (double-entry ledger / idempotency key) chống trừ tiền 2 lần hoặc race condition.
  - Chưa có trang giao diện Ví DabClean cho khách hàng và tab quản lý ví cho Quản trị viên.
- **Phương án sửa:**
  1. Thiết kế bảng `wallets` (id, user_id, balance, status, currency, created_at, updated_at).
  2. Thiết kế bảng `wallet_transactions` (id, wallet_id, transaction_code, type [topup, payment, refund, adjustment], amount, status, description, reference_type, reference_id, idempotency_key, created_at, completed_at).
  3. Thiết kế bảng `wallet_ledger_entries` (sổ cái bất biến: id, transaction_id, wallet_id, entry_type [debit/credit], amount, balance_after, note, created_at).
  4. Backend Wallet Service xử lý giao dịch trong MySQL Transaction với `SELECT ... FOR UPDATE` chống race condition.
  5. Xây dựng API nạp tiền Sandbox an toàn, thanh toán đơn booking bằng ví và hoàn tiền tự động theo quy định.
  6. Xây dựng trang giao diện Ví khách hàng (`wallet.html` / tích hợp thanh toán) và tab Quản lý ví trên Admin.
- **Test cần chạy:** Unit test ledger, concurrency test nạp/trừ tiền đồng thời, idempotency test, test số dư âm bị từ chối.

---

### 3.2. AUD-02 (HIGH) — LỆCH TÊN CỘT TRONG `staff_payout_logs`
- **Vị trí:** `backend/src/controllers/adminController.js` (hàm `payoutStaffWage`).
- **Nguyên nhân gốc:** Câu lệnh SQL thực thi:
  `INSERT INTO staff_payout_logs (booking_id, staff_id, amount, settled_by, notes) VALUES (?, ?, ?, ?, ?)`
  Trong khi `database/schema.sql` và `backend/src/config/db.js` định nghĩa các cột:
  `admin_id` (thay vì `settled_by`), `note` (thay vì `notes`), và `action` ('approve', 'pay', 'adjust').
  Khi chạy trên MySQL thật, request sẽ báo lỗi 500: `Unknown column 'settled_by' in 'field list'`.
- **Phương án sửa:**
  Đổi câu lệnh SQL thành:
  `INSERT INTO staff_payout_logs (booking_id, staff_id, admin_id, amount, action, note) VALUES (?, ?, ?, ?, 'pay', ?)`
  Đồng thời cập nhật model và đảm bảo schema đồng bộ.
- **Test cần chạy:** Integration test Admin payout cho nhân viên trên MySQL thật.

---

### 3.3. AUD-03 (HIGH) — CHUẨN HÓA VOUCHER VÀ KHUYẾN MÃI
- **Vị trí:** `backend/src/services/pricingService.js`, `backend/src/controllers/bookingController.js`.
- **Nguyên nhân gốc:** Mã `DABCLEAN20` hiện được hardcode trực tiếp trong mã nguồn. Chưa có bảng dữ liệu quản lý các mã khuyến mãi động, hạn sử dụng, điều kiện giá trị đơn tối thiểu, mức giảm tối đa và số lần sử dụng tối đa.
- **Phương án sửa:**
  1. Tạo bảng `vouchers` (id, code, description, discount_type [percent, fixed], discount_value, max_discount, min_order_value, usage_limit, used_count, user_limit, start_date, end_date, is_active, created_at).
  2. Tạo bảng `voucher_usages` để theo dõi khách hàng nào đã dùng mã nào cho đơn nào.
  3. Cập nhật `pricingService.js` để kiểm tra voucher từ Database với khóa dòng (row-level locking) chống vượt hạn mức khi có request đồng thời.
  4. Cung cấp API quản lý Voucher cho Admin.
- **Test cần chạy:** Test voucher hợp lệ, hết hạn, chưa kích hoạt, không đủ đơn tối thiểu, vượt hạn mức, và race condition khi nhiều khách cùng dùng lượt cuối.

---

### 3.4. AUD-04 (MEDIUM) — ĐỒNG BỘ DỊCH VỤ BỔ SUNG (ADD-ONS)
- **Vị trí:** `frontend/booking.html` vs `backend/src/services/pricingService.js`.
- **Nguyên nhân gốc:** `booking.html` cho phép khách chọn các dịch vụ bổ sung (+100k khử khuẩn nano, +200k giặt sofa hơi nóng, +120k tẩy cặn canxi, +80k vệ sinh tủ lạnh) nhưng backend `pricingService.js` chưa nhận mảng `addons` nên không tính vào tổng tiền đơn hàng.
- **Phương án sửa:**
  1. Thêm cấu hình bảng giá add-ons chuẩn tại `pricingService.js`.
  2. Bổ sung trường `addons` (JSON) và `addon_amount` (DECIMAL) vào bảng `bookings`.
  3. Backend xác thực các add-on hợp lệ và tính tiền chính xác, ghi nhận vào đơn hàng.
- **Test cần chạy:** Test tạo đơn có 1 hoặc nhiều add-on, so khớp giá giữa Frontend và Backend.

---

### 3.5. AUD-05 (MEDIUM) — TÁCH BẠCH BÁO CÁO DOANH THU & TÀI CHÍNH
- **Vị trí:** `backend/src/models/bookingModel.js` (`getStats`), `adminController.js`.
- **Nguyên nhân gốc:** Hàm `getStats` chỉ tính `total_revenue = SUM(total_price) WHERE status = 'completed'`. Chưa tách bạch:
  - Tổng giá trị đơn hàng (Gross Booking Value).
  - Số tiền thực thu (Collected Cash / Bank / Wallet).
  - Tiền thù lao nhân viên (Staff Wages).
  - Tiền giảm giá khuyến mãi (Discounts / Vouchers).
  - Số dư ký quỹ trong ví người dùng (Customer Wallet Balances).
  - Khoản tiền hoàn lại (Refunds).
  - Lợi nhuận gộp ước tính (Gross Margin = Thu - Tiền công).
- **Phương án sửa:** Mở rộng truy vấn `getStats()` để truy vấn số liệu thật từ các bảng `bookings`, `wallets`, `staff_payout_logs` và trả về báo cáo phân tích tài chính đa chiều cho Admin Dashboard.

---

### 3.6. AUD-06 (MEDIUM) — BẢO VỆ RATE LIMITING CHO CÁC ENDPOINT NHẠY CẢM
- **Vị trí:** `backend/src/controllers/authController.js`.
- **Mô tả:** Endpoint `/api/auth/login` đã có rate limiting chống brute-force (5 lần sai/15 phút). Tuy nhiên `/api/auth/register` và `/api/auth/change-password` chưa có giới hạn tần suất gọi.
- **Phương án sửa:** Bổ sung rate limiting dạng trượt (sliding window) theo IP/Client cho đăng ký và đổi mật khẩu.

---

## 4. KẾ HOẠCH THỰC HIỆN THEO CÁC PHASE

1. **Phase 1: Sửa lỗi bảo mật & Ổn định Backend:**
   - Sửa lỗi câu lệnh SQL trong `adminController.js` (`staff_payout_logs`).
   - Thêm rate limiting cho Register & Change Password.
   - Kiểm tra và đảm bảo toàn bộ input validation và chống XSS.
2. **Phase 2: Database Schema & Safe Migrations:**
   - Tạo migration bổ sung các bảng: `wallets`, `wallet_transactions`, `wallet_ledger_entries`, `vouchers`, `voucher_usages`.
   - Bổ sung cột `addons` vào `bookings`.
   - Cập nhật cả `schema.sql` và migration tự động trong `db.js`.
3. **Phase 3: Chuẩn hóa Pricing, Add-ons & Voucher Engine:**
   - Xây dựng bảng Voucher và Voucher Service.
   - Hỗ trợ Add-ons trong Pricing Engine và tính toán đồng nhất.
4. **Phase 4: Xây dựng Hệ thống Ví DabClean (Trọng tâm):**
   - Backend Wallet Service với Sổ cái bất biến & Idempotency.
   - API Khách hàng: Xem số dư, lịch sử giao dịch, nạp tiền sandbox, thanh toán đơn booking bằng ví, hoàn tiền.
   - API Quản trị: Tra cứu ví, lịch sử giao dịch, kiểm toán tài chính.
   - Giao diện Ví khách hàng và tích hợp phương thức thanh toán "Ví DabClean" vào `booking.html`.
5. **Phase 5: Booking State Machine & Phân công nhân viên:**
   - Hoàn thiện State Machine, kiểm tra phân công nhân viên, chống xung đột lịch.
6. **Phase 6: Báo cáo tài chính & Đối soát Dashboard:**
   - Tách bạch GBV, Thực thu, Tiền công, Số dư ví, Lợi nhuận trên Admin Dashboard.
7. **Phase 7: Hoàn thiện UI/UX & Notifications:**
   - Kiểm tra và cập nhật các liên kết, menu, badge số dư ví, thông báo giao dịch.
8. **Phase 8: Kiểm thử toàn diện & Nghiệm thu:**
   - Chạy toàn bộ các test suites hiện có và test mới cho Ví, Voucher, Add-ons.
   - Báo cáo kết quả và cập nhật `docs/BIG_UPDATE_PROGRESS.md`.
