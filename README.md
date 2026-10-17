# 🌿 Cleanova - Nền Tảng Dịch Vụ Dọn Vệ Sinh Chuyên Nghiệp (Full-Stack)

> **Slogan:**  
> 🇬🇧 *A Cleaner Space, A Better Life.*  
> 🇻🇳 *Không gian sạch hơn, cuộc sống tốt hơn.*

---

## 📖 1. Giới Thiệu Dự Án

**Cleanova** là ứng dụng web toàn diện hỗ trợ đặt lịch và quản lý dịch vụ vệ sinh không gian sống và làm việc hiện đại. Dự án được thiết kế theo tiêu chuẩn công nghiệp với kiến trúc phân tầng rõ ràng giữa **Frontend**, **Backend API**, và **Cơ sở dữ liệu (Database)**.

Dự án tuân thủ nghiêm ngặt yêu cầu công nghệ giảng dạy và phát triển:
- **Frontend:** 100% mã nguồn thuần (Pure HTML5, CSS3 hiện đại, Vanilla JavaScript ES6+), hoàn toàn không phụ thuộc vào thư viện bên ngoài (không React/Vue, không Tailwind/Bootstrap, không jQuery).
- **Backend:** Node.js & Express.js RESTful API, xác thực bảo mật JWT (JSON Web Token), mã hóa mật khẩu bằng bcryptjs, hỗ trợ phân quyền người dùng (RBAC).
- **Database:** MySQL quan hệ chuẩn hóa + **Cơ chế In-Memory DB tự động** (cho phép chạy và chấm demo ngay lập tức mà không bắt buộc phải cài đặt MySQL trước).

---

## 🗂️ 2. Cấu Trúc Thư Mục Dự Án

Dự án được phân chia mô-đun gọn gàng, trực quan và dễ bảo trì:

```text
cleannova/
├── frontend/                   # Toàn bộ giao diện & logic phía người dùng
│   ├── index.html              # Trang cổng Gateway (kiểm tra phiên & điều hướng)
│   ├── login.html              # Giao diện Đăng nhập Cleanova
│   ├── login.css               # Phong cách giao diện Đăng nhập
│   ├── login.js                # Xử lý logic Đăng nhập & chuyển đổi ngôn ngữ VI/EN
│   ├── register.html           # Giao diện Đăng ký tài khoản mới
│   ├── trangchu.html           # Trang chủ (Landing Page) chính thức của Cleanova
│   ├── services.html           # Danh mục dịch vụ, tìm kiếm & bộ lọc giá
│   ├── booking.html            # Trang đặt lịch dọn dẹp & ước tính chi phí trực tiếp
│   ├── my-bookings.html        # Trang quản lý lịch sử đơn đặt của khách hàng
│   ├── profile.html            # Trang cá nhân (cập nhật thông tin & đổi mật khẩu)
│   ├── staff.html              # Không gian làm việc riêng cho Nhân viên (Staff Portal)
│   ├── admin.html              # Bảng điều khiển Quản trị viên (Dashboard, Tài khoản, Nhân viên, Đơn đặt)
│   ├── main.css                # CSS giao diện trang chủ & hệ thống Design System
│   ├── app.css                 # CSS bổ trợ cho các trang tính năng mới
│   ├── main.js                 # Hiệu ứng, cuộn mượt, câu hỏi FAQ & Mobile menu
│   └── api.js                  # Client API Adapter kết nối Frontend với Backend
│
├── backend/                    # Mã nguồn máy chủ & RESTful API (Node.js/Express)
│   ├── src/
│   │   ├── config/             # Cấu hình kết nối MySQL & Bộ nhớ đệm tự động
│   │   │   └── db.js
│   │   ├── controllers/        # Bộ điều khiển xử lý logic nghiệp vụ
│   │   │   ├── authController.js
│   │   │   ├── serviceController.js
│   │   │   ├── bookingController.js
│   │   │   └── adminController.js
│   │   ├── middlewares/        # Middlewares xác thực JWT, phân quyền & xử lý lỗi
│   │   │   ├── authMiddleware.js
│   │   │   └── errorMiddleware.js
│   │   ├── routes/             # Định tuyến API
│   │   │   ├── authRoutes.js
│   │   │   ├── serviceRoutes.js
│   │   │   ├── bookingRoutes.js
│   │   │   └── adminRoutes.js
│   │   └── app.js              # Khởi tạo Express app & phục vụ file tĩnh
│   ├── .env                    # Biến môi trường máy chủ
│   ├── .env.example            # Mẫu biến môi trường
│   ├── package.json            # Thông tin dependencies của backend
│   └── server.js               # Điểm khởi chạy máy chủ Backend
│
├── database/                   # Kịch bản Cơ sở dữ liệu MySQL
│   ├── schema.sql              # Cấu trúc bảng (Users, Services, Bookings, Reviews)
│   └── seed.sql                # Dữ liệu mẫu ban đầu (Admin, Khách hàng, 6 Gói dịch vụ)
│
├── .gitignore                  # Bỏ qua node_modules, log, và file nhạy cảm
└── README.md                   # Tài liệu hướng dẫn toàn diện dự án
```

---

## 👥 3. Tài Khoản Thử Nghiệm (Demo Accounts)

Hệ thống đã chuẩn bị sẵn tài khoản kiểm thử cho cả 3 vai trò (tự động chuyển đúng trang sau khi đăng nhập):

| Vai trò | Email đăng nhập | Mật khẩu | Trang tự động chuyển đến | Quyền hạn & Tác vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nhân viên (Staff 1)** | `staff@cleanova.vn` | `Staff@Cleanova2026!` | [`staff.html`](http://localhost:5000/staff.html) | Xem việc được giao, timeline lịch trình, cập nhật tiến độ, báo cáo ca trực & đổi mật khẩu |
| **Nhân viên (Staff 2)** | `staff2@cleanova.vn` | `Staff@Cleanova2026!` | [`staff.html`](http://localhost:5000/staff.html) | Tài khoản nhân viên thứ hai để kiểm tra bảo mật phân quyền công việc riêng biệt |
| **Quản trị viên (Admin)** | `admin@cleanova.vn` | `Admin@Cleanova2026!` | [`admin.html`](http://localhost:5000/admin.html) | Toàn quyền xem Dashboard, quản lý tài khoản, phân công việc cho nhân viên, quản lý dịch vụ |
| **Khách hàng (Customer)** | `demo@nova.app` | `NovaDemo2026!` | [`trangchu.html`](http://localhost:5000/trangchu.html) | Xem bảng giá, đặt lịch, quản lý đơn của mình, hủy đơn và quản lý hồ sơ cá nhân |
| **Tài khoản bị khóa (Test)** | `locked@cleanova.vn` | `NovaDemo2026!` | — | Tài khoản bị vô hiệu hóa bởi Admin (bị chặn đăng nhập 403 `ACCOUNT_DEACTIVATED`) |

> 💡 *Bạn cũng có thể tự tạo thêm tài khoản mới bất kỳ lúc nào tại trang [Đăng ký](http://localhost:5000/register.html).*

---

## 🚀 4. Hướng Dẫn Cài Đặt & Khởi Chạy

### Yêu Cầu Tiên Quyết
- [Node.js](https://nodejs.org/) phiên bản 16 trở lên.
- (Tùy chọn) [XAMPP](https://www.apachefriends.org/) hoặc MySQL Server nếu muốn lưu dữ liệu thực tế vào MySQL.

---

### Cách 1: Chạy Full-Stack Đầy Đủ (Khuyến Nghị)

Hệ thống có cơ chế **Fallback thông minh**: nếu MySQL chưa bật, server sẽ tự động chuyển sang cơ sở dữ liệu tạm thời trong bộ nhớ (**In-Memory DB**), đảm bảo mọi API đăng nhập, đăng ký, đặt đơn, quản trị hoạt động trơn tru 100%.

#### Bước 1: (Nếu có MySQL) Khởi tạo Cơ sở dữ liệu
1. Mở **phpMyAdmin** (XAMPP) hoặc **MySQL Workbench**.
2. Chạy nội dung trong file [`database/schema.sql`](file:///c:/Users/tiend/Downloads/cleannova/database/schema.sql) để tạo cơ sở dữ liệu `cleanova_db` và các bảng.
3. Chạy nội dung trong file [`database/seed.sql`](file:///c:/Users/tiend/Downloads/cleannova/database/seed.sql) để nạp dữ liệu mẫu ban đầu.

#### Bước 2: Khởi động Backend Server
Mở terminal tại thư mục gốc dự án:
```powershell
# 1. Cài đặt thư viện Backend
cd backend
npm install

# 2. (Tùy chọn) Cài đặt thư viện cho AI Module (nếu sử dụng tính năng phân tích ảnh AI)
cd ../ai-module
npm install
cd ../backend

# 3. Khởi chạy máy chủ Backend
node server.js
```

Sau khi chạy thành công, console sẽ thông báo:
```text
====================================================
  CLEANOVA BACKEND SERVER IS RUNNING
  - Local URL:    http://localhost:5000
  - API Health:   http://localhost:5000/api/health
  - Services API: http://localhost:5000/api/services
====================================================
```

#### Bước 3: Trải nghiệm ứng dụng
Mở trình duyệt bất kỳ và truy cập:
👉 **[http://localhost:5000](http://localhost:5000)** (tự động mở trang kiểm tra phiên & chuyển tiếp vào Trang Chủ hoặc Đăng Nhập).

---

### Cách 2: Mở Giao Diện Bằng VS Code Live Server (Frontend Độc Lập)

Nếu chỉ muốn xem và chỉnh sửa giao diện Frontend:
1. Mở thư mục `cleannova` bằng **VS Code**.
2. Nhấp chuột phải vào file [`frontend/index.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/index.html) hoặc [`frontend/login.html`](file:///c:/Users/tiend/Downloads/cleannova/frontend/login.html).
3. Chọn **Open with Live Server**.
4. Frontend sẽ tự động nhận diện nếu Backend chưa chạy và hiển thị thông báo thân thiện.

---

## 🌟 5. Các Tính Năng Đã Hoàn Thiện

### Phía Người Dùng (Khách hàng)
1. **Trang Chủ (Landing Page - `trangchu.html`):**
   - Thiết kế giao diện xanh ngọc bích phong cách Emerald Green (`#10B981`) sang trọng, hiện đại.
   - Nhận diện trạng thái đăng nhập linh hoạt (hiển thị Họ tên người dùng, avatar, nút Đăng xuất).
   - Nút quản trị (Admin) tự động hiển thị trên menu nếu tài khoản đăng nhập là Admin.
   - Giới thiệu 6 gói dịch vụ, bảng so sánh giá, cam kết chất lượng 4 tiêu chuẩn, đánh giá khách hàng (Testimonials) và câu hỏi thường gặp (FAQ Accordion).
2. **Đăng Nhập & Đăng Ký (`login.html` & `register.html`):**
   - Hỗ trợ song ngữ **VI / EN** tức thì không cần tải lại trang.
   - Validate form trực tiếp (định dạng email, độ dài mật khẩu, xác nhận mật khẩu khớp).
   - Tích hợp gọi API Backend xác thực JWT và lưu trữ thông tin phiên an toàn.
3. **Danh Mục Dịch Vụ (`services.html`):**
   - Hiển thị đầy đủ các gói dịch vụ vệ sinh được lấy trực tiếp từ database qua REST API.
   - Thanh tìm kiếm theo từ khóa dịch vụ theo thời gian thực (Real-time Search).
   - Modal xem chi tiết thông tin gói và nút chuyển tiếp sang trang Đặt lịch.
4. **Đặt Lịch Dọn Dẹp (`booking.html`):**
   - Tự động nhận diện gói dịch vụ được chọn từ trang chủ/dịch vụ.
   - Tính toán ước lượng chi phí tức thì dựa theo diện tích không gian ($m^2$).
   - Nhập thời gian, địa chỉ, ghi chú đặc biệt và lựa chọn phương thức thanh toán (Tiền mặt / Chuyển khoản).
5. **Quản Lý Đơn Đặt (`my-bookings.html`):**
   - Xem toàn bộ danh sách đơn đặt của chính tài khoản đang đăng nhập.
   - Bộ lọc theo trạng thái: Tất cả, Chờ xác nhận, Đã duyệt, Hoàn thành, Đã hủy.
   - Cho phép người dùng bấm **Hủy lịch** đối với các đơn đang ở trạng thái chờ duyệt.
6. **Hồ Sơ Cá Nhân (`profile.html`):**
   - Xem và cập nhật họ tên, số điện thoại, địa chỉ mặc định.
   - Chức năng đổi mật khẩu có kiểm tra mật khẩu hiện tại và mã hóa bảo mật.

### Phía Quản Trị Viên (Admin)
1. **Bảng Điều Khiển Quản Trị (`admin.html`):**
   - Thống kê tổng quan: Tổng doanh thu, Tổng số đơn đặt, Đơn chờ xử lý, Tổng số thành viên.
   - **Quản lý đơn đặt:** Xem thông tin khách hàng, số điện thoại, địa chỉ, dịch vụ, ngày làm việc, tổng tiền và cập nhật trạng thái đơn (Chờ duyệt ➔ Đã duyệt ➔ Đang làm ➔ Hoàn thành ➔ Hủy).
   - **Quản lý danh mục dịch vụ:** Thêm mới gói dịch vụ, chỉnh sửa tên/mô tả/giá tiền, bật/tắt trạng thái hiển thị.
   - **Danh sách người dùng:** Theo dõi danh sách tài khoản đã đăng ký trên hệ thống.

---

## 📡 6. Danh Mục RESTful API Chi Tiết

Tất cả các API đều có tiền tố `/api` và trả về kết quả dưới định dạng JSON chuẩn:

### Xác thực & Người dùng (`/api/auth`)
- `POST /api/auth/register` : Đăng ký tài khoản mới (mã hóa mật khẩu bằng bcrypt).
- `POST /api/auth/login` : Đăng nhập & trả về JSON Web Token (JWT).
- `GET /api/auth/profile` : Lấy thông tin tài khoản hiện tại (*Yêu cầu Token*).
- `PUT /api/auth/profile` : Cập nhật họ tên, SĐT, địa chỉ (*Yêu cầu Token*).
- `PUT /api/auth/change-password` : Đổi mật khẩu tài khoản (*Yêu cầu Token*).

### Dịch vụ vệ sinh (`/api/services`)
- `GET /api/services` : Lấy danh sách tất cả dịch vụ đang hoạt động.
- `GET /api/services/:id` : Lấy thông tin chi tiết một dịch vụ.

### Đơn đặt lịch (`/api/bookings`)
- `POST /api/bookings` : Tạo yêu cầu đặt lịch dọn dẹp mới (*Yêu cầu Token*).
- `GET /api/bookings/my` : Lấy danh sách đơn đặt của người dùng hiện tại (*Yêu cầu Token*).
- `GET /api/bookings/notifications` : Lấy tối đa 50 thông báo trong ứng dụng của khách hàng đang đăng nhập (*Yêu cầu Token*).
- `PATCH /api/bookings/notifications/:notificationId/read` : Đánh dấu thông báo của chính khách hàng đã đọc (*Yêu cầu Token*).
- `GET /api/bookings/:id` : Lấy chi tiết đơn đặt cụ thể (*Yêu cầu Token*).
- `PUT /api/bookings/:id/cancel` : Hủy đơn trước khi nhân viên đến, gửi lý do trong JSON `reason` (*Yêu cầu Token*).
- `POST /api/bookings/:id/review` : Gửi đánh giá dịch vụ và nhân viên (`rating`, `staff_rating`, `comment`) sau khi hoàn thành.
- `POST /api/bookings/:id/tip` : Ghi nhận tip tự nguyện từ 1.000 đến 1.000.000 VNĐ cho nhân viên được giao; khoản tip được thanh toán trực tiếp với nhân viên.

### Hệ thống Hai Ví & Sổ cái Đối tác (`/api/wallet`) - *Mô hình Grab Driver*
- `GET /api/wallet/staff/wallets` : Lấy số dư chi tiết của Ví Tín Dụng (Credit Wallet) và Ví Thu Nhập (Earnings Wallet), kèm trạng thái điều kiện nhận đơn (`eligible`).
- `GET /api/wallet/staff/eligibility` : Kiểm tra điều kiện nhận đơn (yêu cầu số dư ví tín dụng `creditBalance > 100.000 VNĐ`).
- `POST /api/wallet/staff/topup-credit` : Nạp tiền trực tiếp vào Ví Tín Dụng (hỗ trợ sandbox và bù nợ âm tự động).
- `POST /api/wallet/staff/transfer` : Chuyển tiền từ Ví Thu Nhập sang Ví Tín Dụng để duy trì quyền nhận đơn mà không tạo doanh thu sàn.
- `POST /api/wallet/withdraw` : Tạo lệnh rút tiền từ Ví Thu Nhập về tài khoản ngân hàng của nhân viên.
- `GET /api/wallet/transactions` : Lấy lịch sử sổ cái biến động của từng ví với bộ lọc phân loại.

### Nhân viên & Đối tác (`/api/staff`) - *Yêu cầu Token Staff/Admin*
- `PATCH /api/staff/tasks/:id/status` : Nhân viên xác nhận nhận việc (`confirmed` - kiểm tra nghiêm ngặt `creditBalance > 100.000 VNĐ`), báo đã đến (`arrived`), hoàn thành (`completed` - tự động khấu trừ chiết khấu sàn từ ví tín dụng).
- `GET /api/staff/tasks/:id/checklist` : Lấy danh sách khu vực, ảnh Before/After và tiến độ từng góc chụp.
- `POST /api/staff/tasks/:id/photos` : Tải ảnh JPEG lên dạng `multipart/form-data` (tối đa 8 MB sau nén), kèm `areaName`, `angleId`, `stage`, `capturedAt`, `latitude`, `longitude`.
- `POST /api/staff/tasks/:id/cash-payment` : Ghi nhận thu tiền mặt sau khi hoàn tất ảnh After; giao diện yêu cầu nhân viên vuốt thanh xác nhận.

### Quản trị viên (`/api/admin`) - *Yêu cầu Token có quyền Admin*
- `GET /api/admin/stats` : Lấy số liệu thống kê Dashboard: phân tách Tiền mặt vs Trực tuyến và 6 chỉ số Quản trị Hai Ví Đối Tác.
- `GET /api/admin/staff-wallets` : Lấy danh sách toàn bộ nhân viên kèm số dư Ví Tín Dụng, Ví Thu Nhập, nợ tín dụng và trạng thái đủ điều kiện.
- `PUT /api/admin/bookings/:id/assign` : Gán đơn cho nhân viên (kiểm tra điều kiện `creditBalance > 100.000 VNĐ`, từ chối nếu không đủ).
- `POST /api/admin/bookings/:id/payout` : Quyết toán thù lao và khấu trừ hoa hồng đơn hàng idempotent.
- `GET /api/admin/bookings` : Lấy toàn bộ đơn đặt lịch trong hệ thống.
- `PUT /api/admin/bookings/:id/status` : Cập nhật trạng thái đơn đặt lịch.
- `POST /api/admin/services` : Thêm mới gói dịch vụ.
- `PUT /api/admin/services/:id` : Cập nhật thông tin gói dịch vụ.
- `DELETE /api/admin/services/:id` : Xóa hoặc ẩn gói dịch vụ.
- `GET /api/admin/users` : Lấy danh sách thành viên hệ thống.

---

## 🛡️ 7. Bảo Mật & Tiêu Chuẩn Kỹ Thuật

- **Mật khẩu an toàn:** Mật khẩu được băm 10 vòng muối (salt rounds) bằng thư viện `bcryptjs`. Không lưu mật khẩu thô trong cơ sở dữ liệu.
- **Xác thực JWT:** Token có thời hạn sử dụng được mã hóa bằng Secret Key cấu hình trong file `.env`.
- **Bảo vệ Endpoint:** Middleware kiểm tra token trước khi cho phép gọi các API cần quyền hạn; phân quyền chặt chẽ giữa `customer` và `admin`.
- **Quy trình công việc:** Admin phân công đơn ở trạng thái `assigned`; nhân viên xác nhận, báo đã đến, tải ảnh Before/After, xác nhận tiền mặt bằng thao tác vuốt rồi gửi hoàn tất. Lý do hủy của nhân viên là bắt buộc và được lưu cùng đơn.
- **Báo cáo ảnh công việc:** Cổng nhân viên yêu cầu ảnh Before cho mỗi khu vực trước khi bắt đầu và ảnh After khớp từng góc trước khi hoàn thành. Ảnh được nén JPEG trên trình duyệt, lưu dưới `backend/uploads/job-photos/` và chỉ nhân viên được phân công (hoặc Admin) mới tải xem được qua API; metadata thời gian chụp, thời gian nhận trên máy chủ và GPS được lưu trong bảng `booking_job_photos`.
- **Đánh giá & tip:** Khách hàng có thể chấm sao dịch vụ và nhân viên sau khi đơn hoàn tất, đồng thời gửi tip tùy chọn. Ứng dụng chỉ ghi nhận số tiền tip; chưa tích hợp cổng thanh toán tip trực tuyến.
- **Thông báo trong ứng dụng:** Khi nhân viên xác nhận nhận đơn, khách hàng nhận được thông báo kèm mã đơn, dịch vụ, lịch hẹn, địa chỉ và thông tin nhân viên. Thông báo được lưu idempotent, hiển thị trong trang `my-bookings.html`, cập nhật định kỳ và chỉ chủ tài khoản mới được đọc/đánh dấu đã đọc.
- **MySQL:** Khi khởi động, ứng dụng mở rộng enum trạng thái đơn và bổ sung các cột lý do hủy, thời điểm đến/thu tiền, tiền tip và đánh giá nhân viên cho schema hiện có.
- **Giới hạn xác minh:** GPS và thời điểm chụp lấy từ trình duyệt/thiết bị, không phải bằng chứng chống giả mạo tuyệt đối. Trong môi trường triển khai thực tế cần HTTPS, quyền riêng tư phù hợp và dịch vụ lưu trữ ảnh có kiểm soát truy cập/sao lưu.
- **CORS & HTTP Headers:** Cấu hình bảo mật chia sẻ tài nguyên nguồn gốc chéo giúp frontend kết nối an toàn.
- **Cơ chế dự phòng sự cố:** Nếu MySQL ngắt kết nối đột ngột, server không bị crash mà tự động chuyển tiếp dữ liệu an toàn.

---

## 👨‍💻 8. Hướng Dẫn Dành Cho Thầy/Cô & Người Đánh Giá

1. Để chấm bài nhanh nhất, chỉ cần mở terminal tại thư mục `backend` và gõ `node server.js`.
2. Mở trình duyệt tại **`http://localhost:5000`**.
3. Đăng nhập bằng tài khoản `admin@cleanova.vn` / `Admin@Cleanova2026!` để kiểm tra toàn bộ quyền Admin Dashboard & Quản trị Hệ thống Hai Ví Đối Tác (Mô hình Grab Driver).
4. Mở thêm cửa sổ ẩn danh và đăng nhập bằng tài khoản `staff@cleanova.vn` / `Staff@Cleanova2026!` để trải nghiệm Cổng Nhân Viên: Quản lý Hai Ví (Ví Tín Dụng & Ví Thu Nhập), nạp ví tín dụng, chuyển tiền giữa 2 ví, kiểm tra điều kiện nhận đơn.
5. Chạy bộ kiểm thử tự động toàn diện cho hệ thống Hai Ví Đối Tác:
   ```bash
   node backend/test-two-staff-wallets.js
   ```
6. Kiểm tra mã nguồn: Tất cả các file trong `frontend/` và `backend/` đều được chú thích tiếng Việt chi tiết, cấu trúc chuẩn mực, không dùng framework cồng kềnh.

---
*Cleanova © 2026. All rights reserved. A Cleaner Space, A Better Life.*
