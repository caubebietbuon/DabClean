# DABCLEAN BIG UPDATE — BÁO CÁO TIẾN ĐỘ THỰC HIỆN TOÀN DIỆN
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
| **Phase 4** | Xây dựng Ví DabClean (Ledger, Topup, Pay, Refund) | **Completed** | Sổ cái bất biến, khóa hàng `SELECT ... FOR UPDATE`, nạp sandbox, thanh toán đơn, hoàn tiền 100% tự động khi hủy đơn. |
| **Phase 5** | Hoàn thiện Đặt lịch, State Machine & Phân công Staff | **Completed** | Tích hợp phương thức thanh toán `'wallet'`, tự động chuyển trạng thái `paid`, trừ tiền nguyên tử, hoàn tiền khi hủy. |
| **Phase 6** | Tiền công, Doanh thu & Báo cáo Dashboard thực | **Completed** | Bổ sung 4 chỉ số tài chính thực tế (`stat-collected`, `stat-staff-wages`, `stat-wallet-bal`, `stat-net-profit`) từ MySQL. |
| **Phase 8** | Kiểm thử hồi quy toàn diện & Nghiệm thu | **Completed** | Chạy 8 bộ test suite: **169/169 tests PASS (100%)**. |
| **Phase 9** | Staff Wallet Commission & Admin Revenue Fix | **Completed** | Tích hợp chiết khấu hoa hồng nhân viên (Gross/Net), Sổ cái Staff Wallet, Quyết toán thù lao nguyên tử, Rút tiền thợ, 10 chỉ số tài chính Admin độc lập, Bảng phân rã theo ngày: **27/27 tests PASS**. |
| **Phase 10** | Hệ thống Hai Ví Nhân Viên DabClean | **Completed** | Tách bạch Ví Tín Dụng (Credit Wallet - ví trên, khấu trừ hoa hồng, cho phép âm, kiểm tra điều kiện bắt buộc >= 100k) và Ví Thu Nhập (Earnings Wallet - ví dưới, nhận công đơn online, rút tiền, chuyển sang ví trên). Kiểm thử toàn diện 13 kịch bản: **31/31 tests PASS (100%)**. |

---

## 2. DANH SÁCH FILE ĐÃ SỬA HOẶC TẠO MỚI

### A. Tài liệu & Báo cáo kỹ thuật:
1. [`docs/BIG_UPDATE_AUDIT.md`](file:///c:/Users/tiend/Downloads/cleannova/docs/BIG_UPDATE_AUDIT.md): Báo cáo audit chuyên sâu 9 lỗ hổng, phân loại mức độ nghiêm trọng, nguyên nhân gốc, bước tái hiện và giải pháp.
2. [`docs/BIG_UPDATE_PROGRESS.md`](file:///c:/Users/tiend/Downloads/cleannova/docs/BIG_UPDATE_PROGRESS.md): Tài liệu theo dõi tiến độ tổng thể chuẩn Master Prompt.

### B. Database Schema & Migration:
3. [`database/schema.sql`](file:///c:/Users/tiend/Downloads/cleannova/database/schema.sql): Bổ sung định nghĩa các bảng `wallets`, `wallet_transactions`, `wallet_ledger_entries`, `vouchers`, `voucher_usages`, `system_configs`; cập nhật `bookings` (`commission_rate`, `platform_commission`, `staff_net_wage`), cập nhật `staff_payout_logs` (`gross_wage`, `commission_rate`, `platform_commission`, `net_wage`), mở rộng ENUM `wallet_transactions.type` (`'wage'`, `'withdrawal'`).
4. [`backend/src/config/db.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/config/db.js): Tích hợp migration idempotent tự động tạo bảng, alter cột an toàn trong `initDatabase()`, seed `staff_commission_rate = 0.20`, và hỗ trợ dynamic column backfill.

### C. Backend Models, Controllers & Services:
5. [`backend/src/services/pricingService.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/services/pricingService.js): Bổ sung hàm chuẩn `calculateCommission(grossWage, commissionRate)` làm tròn số nguyên (`Math.round`), trả về `grossWage`, `commissionRate`, `platformCommission`, `staffNetWage` cho mọi loại dịch vụ.
6. [`backend/src/models/bookingModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/bookingModel.js): Lưu snapshot hoa hồng bất biến khi tạo/duyệt đơn; nâng cấp `getStats()` phân rã 10 chỉ số tài chính độc lập theo ngày, tránh tích Descartes; hỗ trợ `getCommissionConfig()` và `updateCommissionConfig()`.
7. [`backend/src/models/walletModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/walletModel.js): Thêm `payoutWage({ bookingId, adminId, note })` ghi có nguyên tử vào ví nhân viên (`staff_net_wage`) kèm sổ cái và log đối soát; thêm `withdraw()` tạo lệnh rút tiền thợ; thêm `getStaffWageSummary()`.
8. [`backend/src/controllers/walletController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/walletController.js): Bổ sung endpoint `withdraw` (tương thích cả camelCase và snake_case) và `getStaffWageSummary`.
9. [`backend/src/controllers/adminController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/adminController.js): Ủy quyền thanh toán công thợ qua `WalletModel.payoutWage`; kết nối bộ lọc ngày vào `BookingModel.getStats`; thêm API xem và cấu hình hoa hồng nhân viên.
10. [`backend/src/routes/walletRoutes.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/routes/walletRoutes.js): Khai báo `POST /api/wallet/withdraw` và `GET /api/wallet/staff/summary`.
11. [`backend/src/routes/adminRoutes.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/routes/adminRoutes.js): Khai báo `GET/PUT /api/admin/config/commission` và hỗ trợ cả `POST` lẫn `PATCH` cho `/bookings/:id/payout`.
12. [`backend/src/models/voucherModel.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/models/voucherModel.js): Quản trị voucher và ghi nhận sử dụng.
13. [`backend/src/controllers/voucherController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/voucherController.js): Điều khiển voucher API.
14. [`backend/src/routes/voucherRoutes.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/routes/voucherRoutes.js): Định tuyến `/api/vouchers/*`.
15. [`backend/src/controllers/bookingController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/bookingController.js): Hỗ trợ thanh toán ví, hoàn tiền, lưu addons và snapshot thù lao.
16. [`backend/src/controllers/authController.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/controllers/authController.js): Khởi tạo ví tự động khi đăng ký.
17. [`backend/src/middleware/authMiddleware.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/middleware/authMiddleware.js): Chuẩn hóa RBAC và export.
18. [`backend/src/app.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/app.js): Đăng ký routers.

### D. Frontend & UI/UX:
19. [`frontend/api.js`](file:///c:/Users/tiend/Downloads/cleannova/frontend/api.js): Bổ sung `DabCleanAPI.admin.getCommissionConfig`, `DabCleanAPI.admin.updateCommissionConfig`, `DabCleanAPI.wallet.withdraw`, `DabCleanAPI.wallet.getStaffSummary`, và bộ lọc tham số trong `DabCleanAPI.admin.getStats`.
20. [`frontend/staff.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/staff.html): Thêm tab "👛 Ví & Thù Lao", 5 thẻ chỉ số tài chính thợ (Số dư khả dụng, Chờ thanh toán, Tiền công gộp, Chiết khấu đã trích, Thực nhận ròng), bảng phân rã thù lao chi tiết theo đơn, bảng lịch sử sổ cái ví, và Modal rút tiền về tài khoản ngân hàng.
21. [`frontend/admin.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/admin.html): Tái cấu trúc Dashboard tài chính với 10 chỉ số phân định rõ ràng; thanh công cụ lọc khoảng thời gian (Hôm nay, 7 ngày, Tháng này, Toàn bộ, Tùy chỉnh); bảng phân tích tài chính theo ngày; Modal cấu hình tỷ lệ chiết khấu nhân viên.
22. [`frontend/wallet.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/wallet.html): Giao diện Ví khách hàng.
23. [`frontend/booking.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/booking.html): Tích hợp thanh toán ví.

### E. Test Suites:
24. [`backend/test-staff-wallet-commission.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-staff-wallet-commission.js) *(Mới)*: Bộ kiểm thử 27 ca test bao phủ toàn bộ luồng chiết khấu nhân viên, công thức toán học, snapshot bất biến, ví thợ, rút tiền, và 10 chỉ số Admin Dashboard.
25. [`test-wallet-system.js`](file:///c:/Users/tiend/Downloads/cleannova/test-wallet-system.js): Kiểm thử Ví khách hàng và Sổ cái.

---

## 3. THAY ĐỔI SCHEMA & MIGRATION DATABASE THỰC TẾ

Migration được thiết kế **idempotent**, thực hiện an toàn qua `initDatabase()` trong [`backend/src/config/db.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/src/config/db.js):

1. **Bảng `system_configs` (Cấu hình hệ thống):**
   - Cột: `id`, `config_key` (UNIQUE), `config_value` (JSON), `description`, `updated_by`, `updated_at`.
   - Seed mặc định: `'staff_commission_rate'` = `{"rate": 0.20}` (Chiết khấu 20%).
2. **Cập nhật Bảng `bookings` (Snapshot thù lao & hoa hồng):**
   - Thêm cột `commission_rate` (DECIMAL(5,4), DEFAULT 0.2000).
   - Thêm cột `platform_commission` (DECIMAL(12,2), DEFAULT 0.00).
   - Thêm cột `staff_net_wage` (DECIMAL(12,2), DEFAULT 0.00).
3. **Cập nhật Bảng `staff_payout_logs` (Đối soát quyết toán 4 giá trị):**
   - Thêm cột `gross_wage` (DECIMAL(12,2)).
   - Thêm cột `commission_rate` (DECIMAL(5,4)).
   - Thêm cột `platform_commission` (DECIMAL(12,2)).
   - Thêm cột `net_wage` (DECIMAL(12,2)).
4. **Mở rộng Bảng `wallet_transactions`:**
   - Cập nhật ENUM `type` thành: `'topup', 'payment', 'refund', 'payout', 'adjustment', 'wage', 'withdrawal'`.
5. **Bảng `wallets` & `wallet_ledger_entries`:**
   - Bảng `wallets`: Hỗ trợ ví cho cả Khách hàng (Customer) và Nhân viên (Staff).
   - Bảng `wallet_ledger_entries`: Ghi nhận biến động kép, tài khoản nguồn `staff_wage_payable` chuyển sang tài khoản đích `customer_wallet` (hoặc `staff_wallet`).

---

## 4. CÔNG THỨC NGHIỆP VỤ TÀI CHÍNH & 10 CHỈ SỐ ADMIN DASHBOARD

### A. Công thức tính chiết khấu thù lao nhân viên:
```javascript
platform_commission = Math.round(employee_gross_earnings * commission_rate);
employee_net_earnings = employee_gross_earnings - platform_commission;
```
- Sử dụng số nguyên VNĐ (`Math.round`) để tránh sai số dấu phẩy động.
- Tỷ lệ mặc định: `0.20` (20%), chặn trong khoảng `[0, 1]`.
- **Snapshot bất biến:** Khi đơn đặt lịch được tạo hoặc báo giá được Admin duyệt, 3 giá trị `commission_rate`, `platform_commission`, và `staff_net_wage` được đóng băng vào bảng `bookings`. Các thay đổi cấu hình tỷ lệ trong tương lai không làm sai lệch số liệu lịch sử.

### B. Định nghĩa 10 chỉ số tài chính Admin Dashboard:
1. **Tổng thanh toán gộp (`gross_payments`):** Tổng số tiền khách hàng đã thanh toán cho các đơn dịch vụ hợp lệ (`SUM(total_price)` của đơn `paid` hoặc `completed`). Không tính tiền nạp ví.
2. **Hoàn tiền đơn dịch vụ (`service_refunds`):** Tổng số tiền đã hoàn trả cho các đơn dịch vụ bị hủy (`SUM(total_price)` của đơn `cancelled` mà trước đó đã thanh toán).
3. **Thực thu dịch vụ ròng (`net_receipts`):** `gross_payments - service_refunds`.
4. **Tổng tiền công gộp thợ (`staff_gross_wages`):** Tổng tiền công thợ trước khi khấu trừ chiết khấu (`SUM(staff_wage)`).
5. **Chiết khấu nền tảng trích từ thợ (`platform_commission`):** Phần doanh thu DabClean giữ lại từ thù lao của nhân viên (`SUM(platform_commission)`).
6. **Tổng tiền công ròng thợ (`staff_net_wages`):** Tổng số tiền thợ thực nhận sau chiết khấu (`SUM(staff_net_wage)`).
7. **Tiền công phải trả thợ (`staff_payable`):** Tiền công ròng của các đơn đã hoàn thành nhưng Admin chưa bấm quyết toán giải ngân vào ví thợ.
8. **Tiền công đã chi trả thợ (`staff_settled`):** Tổng tiền công ròng đã được chuyển thành công vào Staff Wallet của thợ (`SUM(net_wage)` từ `staff_payout_logs`).
9. **Lợi nhuận gộp nền tảng (`platform_profit`):** `net_receipts - staff_gross_wages` (Doanh thu thuần từ dịch vụ sau khi trừ toàn bộ nghĩa vụ công thợ).
10. **Nợ tiền gửi khách hàng chờ sử dụng (`customer_wallet_liabilities`):** Tổng số dư hiện hữu trong tất cả ví khách hàng (`SUM(balance)` từ `wallets` của `role = customer`). Đây là tiền ký quỹ chưa phát sinh dịch vụ, **tuyệt đối không được tính vào doanh thu dịch vụ**.

---

## 5. KẾT QUẢ KIỂM THỬ THỰC TẾ (100% PASS)

Tất cả các bộ kiểm thử đã được chạy trên môi trường thực tế kết nối MySQL Server:

| Bộ kiểm thử (Test Suite) | Mục tiêu kiểm thử | Số ca test | Kết quả |
| :--- | :--- | :---: | :---: |
| [`backend/test-staff-wallet-commission.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-staff-wallet-commission.js) | Chiết khấu hoa hồng thợ, Snapshot bất biến, Sổ cái ví thợ, Rút tiền, 10 chỉ số Admin, Bộ lọc ngày | 27 | **27/27 PASS** |
| [`test-wallet-system.js`](file:///c:/Users/tiend/Downloads/cleannova/test-wallet-system.js) | Ví DabClean, Ledger, Idempotency, Pay Booking, Auto-refund, Admin Oversight | 10 | **10/10 PASS** |
| [`test-care-redesign.js`](file:///c:/Users/tiend/Downloads/cleannova/test-care-redesign.js) | Dịch vụ chăm sóc người già/trẻ em/người bệnh, bảng giá ca/ngày/tháng, điều phối thợ | 35 | **35/35 PASS** |
| [`test-homepage-verify.js`](file:///c:/Users/tiend/Downloads/cleannova/test-homepage-verify.js) | Giao diện trang chủ, thẻ dịch vụ, bộ lọc danh mục, bảng giá, FAQ, form báo giá | 22 | **22/22 PASS** |
| [`test-post-construction.js`](file:///c:/Users/tiend/Downloads/cleannova/test-post-construction.js) | Vệ sinh sau xây dựng theo m², trọn gói, công thợ theo ngày, duyệt báo giá Admin | 47 | **47/47 PASS** |
| [`backend/test-rbac-staff.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-rbac-staff.js) | Phân quyền RBAC, Staff chỉ xem đơn được giao, Admin quản trị an toàn | 10 | **10/10 PASS** |
| [`backend/test-comprehensive.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-comprehensive.js) | Unit pricing, Stored XSS prevention, JWT fail-safe, Anti-bruteforce, Concurrency | 21 | **21/21 PASS** |
| [`backend/test-guest-access.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-guest-access.js) | Khách vãng lai xem dịch vụ công khai, chặn tạo đơn khi chưa login | 12 | **12/12 PASS** |
| [`backend/test-return-url.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-return-url.js) | Chống Open-Redirect, chặn giả mạo URL chuyển hướng sau login | 12 | **12/12 PASS** |
| **TỔNG CỘNG** | **Toàn bộ hệ thống DabClean** | **196** | **196/196 PASS (100%)** |

---

## 6. PHÂN LOẠI TÌNH TRẠNG CHỨC NĂNG

### A. Đã triển khai và đã kiểm thử tự động (Tested & Verified):
- [x] Đăng ký, Đăng nhập, Bảo vệ bí mật JWT, Chống bruteforce.
- [x] Khách vãng lai xem bảng giá và danh mục dịch vụ công khai.
- [x] Vệ sinh nhà cửa, Dọn dẹp sau xây dựng (theo m², trọn gói, thuê nhân công theo ngày).
- [x] Dịch vụ chăm sóc tại nhà (Trẻ em, Người cao tuổi, Hỗ trợ người bệnh).
- [x] Hệ thống Add-ons tính phí chuẩn hóa từ backend (`pricingService.js`).
- [x] Dynamic Voucher Engine (`vouchers`, `voucher_usages`, hạn mức toàn hệ thống và hạn mức mỗi user).
- [x] Ví DabClean (Customer Wallet & Staff Wallet):
  - Sổ cái bất biến (`wallet_ledger_entries`).
  - Giao dịch có mã duy nhất và Idempotency Key chống race condition.
  - Nạp tiền Sandbox tự động ghi có.
  - Thanh toán đơn hàng bằng ví với cơ chế khóa hàng `SELECT ... FOR UPDATE`.
  - Tự động hoàn tiền 100% vào ví khi khách hủy đơn đã thanh toán.
  - Quyết toán thù lao thợ nguyên tử vào Staff Wallet với Idempotency Key `WAGE-BOOKING-${id}`.
  - Rút tiền từ Staff Wallet về tài khoản ngân hàng.
  - Giao diện Ví khách hàng [`frontend/wallet.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/wallet.html).
  - Tab "Ví & Thù Lao" trong Portal nhân viên [`frontend/staff.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/staff.html).
- [x] Báo cáo tài chính Admin Dashboard:
  - 10 chỉ số tài chính phân định rạch ròi, loại bỏ hoàn toàn sự mập mờ của "Tổng doanh thu".
  - Tiền nạp ví khách hàng được ghi nhận là Nghĩa vụ nợ (`customer_wallet_liabilities`), không tính lẫn vào doanh thu dịch vụ.
  - Bộ lọc thời gian: Hôm nay, 7 ngày, Tháng này, Toàn bộ, Khoảng ngày tùy chọn.
  - Bảng phân tích chi tiết theo ngày tránh phép nhân tích Descartes.
  - Modal điều chỉnh tỷ lệ chiết khấu nhân viên và lưu lịch sử kiểm toán.

### B. Vấn đề cần xác nhận từ Chủ sở hữu (Owner Confirmation Needed):
- [ ] **Chính sách Tỷ lệ Chiết khấu Nhân viên:** Mặc định hệ thống đang áp dụng `20%` (`0.20`). Đề nghị Chủ dự án / Ban Giám đốc xác nhận tỷ lệ này đã phù hợp với hợp đồng cộng tác viên hay cần áp dụng tỷ lệ khác theo từng loại hình dịch vụ.
- [ ] **Tích hợp Cổng thanh toán thực tế bên ngoài (MoMo QR API / VNPAY API / VietQR PayOS):** Hiện đang sử dụng module Sandbox Topup mô phỏng quy chuẩn webhook có chữ ký điện tử. Để tích hợp thực tế tại Việt Nam, chủ dự án cần đăng ký hợp đồng thương mại điện tử với VNPAY hoặc MoMo để cấp `Merchant ID` và `Secret Key`.
- [ ] **Quy định pháp lý về ví và rút tiền:** Cần hoàn thiện thỏa thuận dịch vụ (Terms of Service) và chính sách chiết khấu thù lao cho thợ trước khi triển khai thực tế.

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
# Chạy bộ test Hệ thống Hai Ví Nhân Viên DabClean (Mới nhất)
node backend/test-two-staff-wallets.js

# Chạy bộ test Chiết khấu thù lao thợ & Doanh thu Admin
node backend/test-staff-wallet-commission.js

# Chạy bộ test Ví DabClean
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
2. **Quản trị viên:** `admin@cleanova.vn` / `Admin@DabClean2026!`.
3. **Nhân viên:** `staff@cleanova.vn` / `Staff@DabClean2026!` (Đầy đủ Ví Tín Dụng & Ví Thu Nhập).

---

## 5. CHI TIẾT KỸ THUẬT: HỆ THỐNG HAI VÍ NHÂN VIÊN DABCLEAN

### A. Kiến trúc Hai Ví (Dual-Wallet Architecture):
1. **Ví Tín Dụng — Credit Wallet (`wallet_type = 'credit'`):**
   - **Mục đích:** Nhân viên nạp tiền trước để duy trì quyền nhận đơn và thanh toán chiết khấu hoa hồng cho DabClean.
   - **Điều kiện nhận đơn bắt buộc:** Số dư ví tín dụng phải bằng hoặc lớn hơn 100.000 VNĐ (`creditBalance >= 100000`). Số dư đúng 100.000 VNĐ là **Đủ điều kiện**; 99.999 VNĐ, 0 VNĐ hoặc âm là **KHÔNG đủ điều kiện**.
   - **Xử lý số dư âm:** Cho phép số dư âm khi chiết khấu bị trừ vượt quá số dư hiện tại (ghi nhận nợ chiết khấu sàn). Khi nạp tiền, hệ thống tự động bù khoản âm trước khi tạo số dư dương khả dụng.
   - **Idempotency:** Mỗi đơn hoàn thành chỉ khấu trừ chiết khấu đúng 1 lần với khóa duy nhất `COMMISSION-BOOKING-${booking.id}`.

2. **Ví Thu Nhập — Earnings Wallet (`wallet_type = 'earnings'`):**
   - **Mục đích:** Ghi nhận tiền công ròng (`staff_net_wage`) từ các đơn khách thanh toán trực tuyến (`payment_method != 'cash'`).
   - **Quy tắc tiền mặt (Cash Flow Symmetry):** Với đơn tiền mặt (`payment_method == 'cash'`), nhân viên đã thu và giữ 100% tiền mặt từ khách, do đó **KHÔNG ghi nhận tiền công vào Ví Thu Nhập** để chống ghi trùng thu nhập hai lần.
   - **Luân chuyển nội bộ (`transferEarningsToCredit`):** Cho phép nhân viên trích số dư khả dụng từ Ví Thu Nhập để nạp bù vào Ví Tín Dụng mà không cần nạp tiền ngoài. Ghi nhận giao dịch kép `-OUT` và `-IN` trong sổ cái bất biến, hoàn toàn không tính vào doanh thu nền tảng.
   - **Rút tiền (`withdraw`):** Nhân viên thực hiện rút tiền về tài khoản ngân hàng từ Ví Thu Nhập khả dụng.

### B. Kết Quả Kiểm Thử Toàn Diện (13 Kịch Bản Bắt Buộc):
- File kiểm thử: [`backend/test-two-staff-wallets.js`](file:///c:/Users/tiend/Downloads/cleannova/backend/test-two-staff-wallets.js).
- Kết quả: **31/31 tests PASS (100%)**.
  1. Đơn tiền mặt 200k, CK 40k: Ví tín dụng -40k, Ví thu nhập giữ nguyên 0đ.
  2. Đơn trực tuyến 200k, CK 40k: Ví tín dụng -40k, Ví thu nhập +160k.
  3. Số dư tín dụng 100.000đ: Đủ điều kiện nhận đơn (`creditBalance >= 100000`), Admin gán đơn thành công.
  4. Số dư tín dụng 99.999đ: Chặn nhận đơn (`creditBalance < 100000`), Admin chặn gán đơn (HTTP 400).
  5. Số dư tín dụng 0đ hoặc âm: Chặn nhận việc, tính toán chính xác số tiền cần nạp bổ sung.
  6. Chuyển 150k từ Ví Thu Nhập sang Ví Tín Dụng: Số dư cập nhật nguyên tử, không làm sai lệch doanh thu sàn.
  7. Nạp tiền khi ví âm: Tự động bù âm trước khi tạo số dư dương.
  8. Webhook lặp lại: Idempotency key bảo vệ, không cộng trùng số dư.
  9. Quyết toán lặp lại: Không trừ chiết khấu sàn hai lần.
  10. Concurrency: Khóa hàng ngăn chặn race-condition khi gửi 2 request song song.
  11. Bảo mật RBAC: Nhân viên không thể can thiệp số dư hoặc gọi API duyệt tiền của Admin.
  12. Dashboard Admin: Tách bạch tiền mặt vs trực tuyến, hiển thị 6 chỉ số Quản trị Hai Ví Nhân Viên DabClean độc lập.
  13. Đơn hủy/hoàn tiền: Xử lý đúng chính sách, không khấu trừ chiết khấu trên đơn hủy.
