# CLEANOVA BIG UPDATE — BÁO CÁO TIẾN ĐỘ THỰC HIỆN TOÀN DIỆN
**Ngày hoàn tất:** 2026-10-17  
**Trạng thái chung:** **COMPLETED** (Hoàn thành 100% tất cả các Phase của Big Update)  
**Tác giả thực hiện:** Senior Full-stack Developer, Software Architect, Database & Security Engineer  

---

## 1. TỔNG QUAN TIẾN ĐỘ THEO CÁC PHASE

| Phase | Nội dung công việc | Trạng thái | Ghi chú & Bằng chứng nghiệm thu |
| :---: | :--- | :---: | :--- |
| **Phase 0** | Audit toàn bộ repository & Lập kế hoạch chi tiết | **Completed** | Đã tạo [`docs/BIG_UPDATE_AUDIT.md`](file:///c:/Users/tiend/Downloads/cleannova/docs/BIG_UPDATE_AUDIT.md) xác minh 9 lỗi cốt lõi. |
| **Phase 1** | Bảo mật & Ổn định Backend (JWT, Rate limit, SQL fix) | **Completed** | Khắc phục truy vấn quyết toán tiền công (`staff_payout_logs`), bảo vệ JWT secret, chống brute-force registration. |
| **Phase 2** | Database Schema & Migration an toàn (Ví, Voucher, Addons) | **Completed** | Migration bảng `wallets`, `wallet_transactions`, `wallet_ledger_entries`, `vouchers`, `voucher_usages`, `addons`. |
| **Phase 3** | Chuẩn hóa Dịch vụ, Add-ons & Dynamic Voucher Engine | **Completed** | Backend `pricingService.js` tính add-on thực tế, `voucherModel.js` xác thực mã động và ghi nhận lịch sử sử dụng. |
| **Phase 4** | Xây dựng Ví CleanNova (Ledger, Topup, Pay, Refund) | **Completed** | Sổ cái bất biến, khóa hàng `SELECT ... FOR UPDATE`, nạp sandbox, thanh toán đơn, hoàn tiền 100% tự động khi hủy đơn. |
| **Phase 5** | Hoàn thiện Đặt lịch, State Machine & Phân công Staff | **Completed** | Tích hợp phương thức thanh toán `'wallet'`, tự động chuyển trạng thái `paid`, trừ tiền nguyên tử, hoàn tiền khi hủy. |
| **Phase 6** | Tiền công, Doanh thu & Báo cáo Dashboard thực | **Completed** | Bổ sung 4 chỉ số tài chính thực tế (`stat-collected`, `stat-staff-wages`, `stat-wallet-bal`, `stat-net-profit`) từ MySQL. |
| **Phase 7** | Trung tâm Thông báo & Đồng bộ Giao diện UI/UX | **Completed** | Giao diện Ví [`frontend/wallet.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/wallet.html), menu ví trên Navbar, Tab 7 & Tab 8 trong Admin Dashboard. |
| **Phase 8** | Kiểm thử hồi quy toàn diện & Nghiệm thu | **Completed** | Chạy 8 bộ test suite: **169/169 tests PASS (100%)**. |

---

## 2. DANH SÁCH FILE ĐÃ SỬA HOẶC TẠO MỚI

### A. Tài liệu & Báo cáo kỹ thuật:
1. [`docs/BIG_UPDATE_AUDIT.md`](file:///c:/Users/tiend/Downloads/cleannova/docs/BIG_UPDATE_AUDIT.md): Báo cáo audit chuyên sâu 9 lỗ hổng, phân loại mức độ nghiêm trọng, nguyên nhân gốc, bước tái hiện và giải pháp.
2. [`docs/BIG_UPDATE_PROGRESS.md`](file:///c:/Users/tiend/Downloads/cleannova/docs/BIG_UPDATE_PROGRESS.md): Tài liệu theo dõi tiến độ tổng thể chuẩn Master Prompt.

### B. Database Schema & Migration:
3. [`database/schema.sql`](file:///c:/Users/tiend/Downloads/cleannova/database/schema.sql): Bổ sung định nghĩa các bảng `wallets`, `wallet_transactions`, `wallet_ledger_entries`, `vouchers`, `voucher_usages`; thêm cột `addons`, `addon_amount` và cập nhật ENUM `payment_method` hỗ trợ `'wallet'`.
4. [`backend/src/config/db.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/config/db.js): Tích hợp migration idempotent tự động tạo bảng, alter cột an toàn trong `initDatabase()`, seed dữ liệu voucher mẫu và tự động tạo ví cho user.

### C. Backend Models, Controllers & Services:
5. [`backend/src/models/walletModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/walletModel.js) *(Mới)*: Mô hình sổ cái kép (double-entry immutable ledger), chống race condition với `SELECT ... FOR UPDATE`, xử lý nạp tiền sandbox, thanh toán đơn hàng nguyên tử và hoàn tiền tự động.
6. [`backend/src/controllers/walletController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/walletController.js) *(Mới)*: Controller điều khiển các endpoint ví khách hàng, lịch sử giao dịch và đối soát ví của Admin.
7. [`backend/src/routes/walletRoutes.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/routes/walletRoutes.js) *(Mới)*: Định tuyến `/api/wallet/*` với xác thực JWT và kiểm tra quyền hạn.
8. [`backend/src/models/voucherModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/voucherModel.js) *(Mới)*: Kiểm tra thời hạn, hạn mức toàn hệ thống, hạn mức mỗi khách hàng, giá trị đơn tối thiểu, tính số tiền chiết khấu và ghi nhận lịch sử vào `voucher_usages`.
9. [`backend/src/controllers/voucherController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/voucherController.js) *(Mới)*: Endpoint kiểm tra mã công khai, tra cứu voucher còn hiệu lực và API cho Admin quản lý tạo/sửa voucher.
10. [`backend/src/routes/voucherRoutes.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/routes/voucherRoutes.js) *(Mới)*: Định tuyến `/api/vouchers/*`.
11. [`backend/src/services/pricingService.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/services/pricingService.js): Bổ sung danh mục dịch vụ bổ sung chuẩn (`standardAddons`: khử khuẩn Nano Bạc, giặt rèm/ghế sofa, tẩy cặn canxi, vệ sinh tủ lạnh chuyên sâu), tính phí add-on thực tế và tích hợp voucher engine động.
12. [`backend/src/controllers/bookingController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/bookingController.js): Hỗ trợ thanh toán bằng ví, kiểm tra số dư nguyên tử, lưu add-on vào database, kích hoạt hoàn tiền ví 100% khi khách hủy đơn hợp lệ.
13. [`backend/src/controllers/adminController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/adminController.js): Sửa lỗi truy vấn bảng lịch sử quyết toán tiền công thợ (`staff_payout_logs`) (Lỗi AUD-02).
14. [`backend/src/controllers/authController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/authController.js): Tự động tạo ví ban đầu kèm giao dịch khởi tạo cho người dùng mới khi đăng ký.
15. [`backend/src/models/bookingModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/bookingModel.js): Bổ sung thống kê tài chính thực tế trong `getStats()` (Tổng giá trị đặt lịch, Thực thu, Tiền công đã chi, Tiền đã hoàn, Tổng số dư ví, Lợi nhuận ròng ước tính).
16. [`backend/src/middleware/authMiddleware.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/middleware/authMiddleware.js): Chuẩn hóa export cả `requireRole`, `adminRequired`, `staffRequired` đảm bảo tính tương thích ngược cho toàn bộ route.
17. [`backend/src/app.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/app.js): Đăng ký router `/api/wallet` và `/api/vouchers`.

### D. Frontend & UI/UX:
18. [`frontend/wallet.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/wallet.html) *(Mới)*: Trang giao diện Ví CleanNova chuyên nghiệp chuẩn Light/Minimal, hiển thị số dư, huy hiệu trạng thái, modal nạp tiền Sandbox với các nút chọn nhanh (+100k, +200k, +500k, +1M), bộ lọc lịch sử giao dịch.
19. [`frontend/api.js`](file:///c:/Users/tiend/Downloads/cleannova/frontend/api.js): Tích hợp module API `CleanovaAPI.wallet` và `CleanovaAPI.vouchers`.
20. [`frontend/booking.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/booking.html): Bổ sung tùy chọn thanh toán "Ví CleanNova", kiểm tra số dư ví theo thời gian thực, cảnh báo nạp tiền nếu thiếu số dư, gửi mảng `addons` và mã voucher động lên backend.
21. [`frontend/admin.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/admin.html): Thêm 4 thẻ chỉ số tài chính thực tế, bổ sung Tab 7 ("Ví & Giao dịch") và Tab 8 ("Quản lý Voucher").
22. [`frontend/trangchu.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/trangchu.html), [`frontend/main.js`](file:///c:/Users/tiend/Downloads/cleannova/frontend/main.js), [`frontend/my-bookings.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/my-bookings.html), [`frontend/services.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/services.html): Cập nhật liên kết điều hướng đồng bộ tới `wallet.html`.

### E. Test Suites:
23. [`test-wallet-system.js`](file:///c:/Users/tiend/Downloads/cleannova/test-wallet-system.js) *(Mới)*: Bộ kiểm thử tự động 10 kịch bản cho Ví CleanNova và Dynamic Voucher Engine.

---

## 3. THAY ĐỔI SCHEMA & MIGRATION DATABASE THỰC TẾ

Migration được thiết kế **idempotent**, thực hiện an toàn qua `initDatabase()` trong [`backend/src/config/db.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/config/db.js):

1. **Bảng `wallets`:**
   - Cột: `id`, `user_id` (UNIQUE), `balance` (DECIMAL(12,2)), `currency` ('VND'), `status` ('active','locked'), `created_at`, `updated_at`.
   - Khóa ngoại: `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`.
2. **Bảng `wallet_transactions`:**
   - Cột: `id`, `wallet_id`, `transaction_code` (UNIQUE), `type` ('topup','payment','refund','payout','adjustment'), `amount`, `balance_before`, `balance_after`, `status` ('pending','completed','failed','cancelled'), `description`, `reference_type` ('booking','topup_sandbox','manual_adj'), `reference_id`, `idempotency_key` (UNIQUE), `created_at`, `completed_at`.
3. **Bảng `wallet_ledger_entries` (Sổ cái bất biến - Double Entry):**
   - Cột: `id`, `transaction_id`, `wallet_id`, `entry_type` ('debit','credit'), `amount`, `account_head` ('customer_wallet','cleanova_revenue','staff_wage_payable','refund_expense','external_gateway'), `notes`, `created_at`.
4. **Bảng `vouchers` & `voucher_usages`:**
   - Bảng `vouchers`: `code` (UNIQUE), `name`, `discount_type` ('percent','fixed'), `discount_value`, `max_discount_amount`, `min_order_amount`, `total_usage_limit`, `used_count`, `per_user_limit`, `start_date`, `end_date`, `is_active`.
   - Bảng `voucher_usages`: `voucher_id`, `user_id`, `booking_id`, `discount_amount`, `used_at`.
5. **Cập nhật Bảng `bookings`:**
   - Thêm cột `addons` (JSON, DEFAULT `('[]')`).
   - Thêm cột `addon_amount` (DECIMAL(12,2), DEFAULT 0.00).
   - Cập nhật cột `payment_method` thành: `ENUM('cash', 'momo', 'vnpay', 'bank_transfer', 'wallet')`.

---

## 4. DANH SÁCH API MỚI & CẬP NHẬT

### Hệ thống Ví CleanNova:
- `GET /api/wallet/my`: Lấy thông tin ví và số dư khả dụng của khách hàng hiện tại.
- `GET /api/wallet/transactions`: Lấy lịch sử giao dịch ví (hỗ trợ phân trang, lọc theo type và status).
- `POST /api/wallet/topup`: Nạp tiền vào ví qua môi trường Sandbox có khóa Idempotency Key chống nạp trùng.
- `POST /api/wallet/pay-booking`: Thanh toán trực tiếp đơn đặt lịch bằng số dư ví.
- `GET /api/wallet/admin/wallets`: Admin tra cứu danh sách ví toàn hệ thống kèm tổng số dư ví.
- `GET /api/wallet/admin/transactions`: Admin tra cứu lịch sử giao dịch ví toàn hệ thống.
- `POST /api/wallet/admin/refund`: Admin thực hiện hoàn tiền vào ví khách hàng với lý do kiểm toán rõ ràng.

### Hệ thống Voucher:
- `GET /api/vouchers/active`: Danh sách mã ưu đãi đang mở cho khách hàng.
- `POST /api/vouchers/check`: Xác thực mã ưu đãi theo thời gian thực đối với giá trị đơn hàng, dịch vụ và khách hàng.
- `GET /api/vouchers/admin/all`: Admin quản trị toàn bộ voucher trong hệ thống.
- `POST /api/vouchers/admin/create`: Admin tạo mã ưu đãi mới với đầy đủ hạn mức.
- `PATCH /api/vouchers/admin/:id/toggle`: Admin bật/tắt kích hoạt mã ưu đãi.

### Hệ thống Đặt lịch & Báo cáo:
- `POST /api/bookings`: Hỗ trợ `payment_method: "wallet"`, tự động trừ ví nguyên tử và ghi nhận voucher usage vào DB.
- `PATCH /api/bookings/:id/cancel`: Tự động hoàn tiền 100% vào Ví CleanNova nếu đơn đã thanh toán qua ví.
- `GET /api/bookings/admin/stats`: Trả về dữ liệu thống kê tài chính thực tế từ MySQL (Gross Booking Value, Tiền thực thu, Tiền công thợ, Tiền hoàn, Số dư ví, Lợi nhuận ròng).

---

## 5. KẾT QUẢ KIỂM THỬ THỰC TẾ (100% PASS)

Tất cả các bộ kiểm thử đã được chạy trên môi trường thực tế kết nối MySQL Server:

| Bộ kiểm thử (Test Suite) | Mục tiêu kiểm thử | Số ca test | Kết quả |
| :--- | :--- | :---: | :---: |
| [`test-wallet-system.js`](file:///c:/Users/tiend/Downloads/cleannova/test-wallet-system.js) | Ví CleanNova, Ledger, Idempotency, Pay Booking, Auto-refund, Admin Oversight | 10 | **10/10 PASS** |
| [`test-care-redesign.js`](file:///c:/Users/tiend/Downloads/cleannova/test-care-redesign.js) | Dịch vụ chăm sóc người già/trẻ em/người bệnh, bảng giá ca/ngày/tháng, điều phối thợ | 35 | **35/35 PASS** |
| [`test-homepage-verify.js`](file:///c:/Users/tiend/Downloads/cleannova/test-homepage-verify.js) | Giao diện trang chủ, thẻ dịch vụ, bộ lọc danh mục, bảng giá, FAQ, form báo giá | 22 | **22/22 PASS** |
| [`test-post-construction.js`](file:///c:/Users/tiend/Downloads/cleannova/test-post-construction.js) | Vệ sinh sau xây dựng theo m², trọn gói, công thợ theo ngày, duyệt báo giá Admin | 47 | **47/47 PASS** |
| [`backend/test-rbac-staff.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-rbac-staff.js) | Phân quyền RBAC, Staff chỉ xem đơn được giao, Admin quản trị an toàn | 10 | **10/10 PASS** |
| [`backend/test-comprehensive.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-comprehensive.js) | Unit pricing, Stored XSS prevention, JWT fail-safe, Anti-bruteforce, Concurrency | 21 | **21/21 PASS** |
| [`backend/test-guest-access.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-guest-access.js) | Khách vãng lai xem dịch vụ công khai, chặn tạo đơn khi chưa login | 12 | **12/12 PASS** |
| [`backend/test-return-url.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-return-url.js) | Chống Open-Redirect, chặn giả mạo URL chuyển hướng sau login | 12 | **12/12 PASS** |
| **TỔNG CỘNG** | **Toàn bộ hệ thống CleanNova** | **169** | **169/169 PASS (100%)** |

---

## 6. PHÂN LOẠI TÌNH TRẠNG CHỨC NĂNG

### A. Đã triển khai và đã kiểm thử tự động (Tested & Verified):
- [x] Đăng ký, Đăng nhập, Bảo vệ bí mật JWT, Chống bruteforce.
- [x] Khách vãng lai xem bảng giá và danh mục dịch vụ công khai.
- [x] Vệ sinh nhà cửa, Dọn dẹp sau xây dựng (theo m², trọn gói, thuê nhân công theo ngày).
- [x] Dịch vụ chăm sóc tại nhà (Trẻ em, Người cao tuổi, Hỗ trợ người bệnh).
- [x] Hệ thống Add-ons tính phí chuẩn hóa từ backend (`pricingService.js`).
- [x] Dynamic Voucher Engine (`vouchers`, `voucher_usages`, hạn mức toàn hệ thống và hạn mức mỗi user).
- [x] Ví CleanNova:
  - Sổ cái bất biến (`wallet_ledger_entries`).
  - Giao dịch có mã duy nhất và Idempotency Key chống race condition.
  - Nạp tiền Sandbox tự động ghi có.
  - Thanh toán đơn hàng bằng ví với cơ chế khóa hàng `SELECT ... FOR UPDATE`.
  - Tự động hoàn tiền 100% vào ví khi khách hủy đơn đã thanh toán.
  - Trang giao diện Ví khách hàng [`frontend/wallet.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/wallet.html).
  - Quản lý ví & giao dịch trong Admin Dashboard.
- [x] Báo cáo tài chính Admin Dashboard với số liệu thực tế truy vấn từ MySQL.

### B. Chưa triển khai hoặc cần thẩm định pháp lý trước khi đưa vào Production:
- [ ] Tích hợp Cổng thanh toán thực tế bên ngoài (MoMo QR API / VNPAY API / VietQR PayOS): Hiện đang sử dụng module Sandbox Topup mô phỏng quy chuẩn webhook có chữ ký điện tử. Để tích hợp thực tế tại Việt Nam, chủ dự án cần đăng ký hợp đồng thương mại điện tử với VNPAY hoặc MoMo để cấp `Merchant ID` và `Secret Key`.
- [ ] Giữ tiền thật của người dùng: Cần thẩm định giấy phép trung gian thanh toán hoặc ví điện tử trước khi áp dụng tiền thật theo quy định của Ngân hàng Nhà nước Việt Nam.

---

## 7. HƯỚNG DẪN VẬN HÀNH DỰ ÁN

### 1. Cấu hình biến môi trường (`backend/.env`):
```ini
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=123456
DB_NAME=cleanova_db
DB_PORT=3306
JWT_SECRET=c8f5e19a32c253de9a130f142857448eb520468bd93322409f481be1cb68f804
JWT_EXPIRES_IN=7d
```

### 2. Cài đặt dependencies & Khởi chạy server:
```powershell
cd backend
npm install
node server.js
```

### 3. Chạy toàn bộ kiểm thử xác minh:
```powershell
# Chạy bộ test Ví CleanNova
node test-wallet-system.js

# Chạy các bộ test nghiệp vụ
node test-care-redesign.js
node test-post-construction.js
node test-homepage-verify.js
node backend/test-comprehensive.js
node backend/test-rbac-staff.js
node backend/test-guest-access.js
node backend/test-return-url.js
```

### 4. Tài khoản Demo kiểm thử:
1. **Khách hàng:** `demo@nova.app` / `NovaDemo2026!` (Đã có sẵn ví số dư kiểm thử).
2. **Quản trị viên:** `admin@cleanova.vn` / `Admin@Cleanova2026!`.
3. **Nhân viên:** `staff1@cleanova.vn` / `Staff@Cleanova2026!`.
