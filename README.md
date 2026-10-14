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
│   ├── admin.html              # Bảng điều khiển Quản trị viên (Dashboard, Đơn đặt, Dịch vụ)
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

Hệ thống đã chuẩn bị sẵn hai tài khoản kiểm thử cho hai vai trò:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@cleanova.vn` | `Admin@Cleanova2026!` | Toàn quyền xem Dashboard, đổi trạng thái đơn, thêm/sửa/xóa dịch vụ |
| **Khách hàng (Customer)** | `demo@nova.app` | `NovaDemo2026!` | Đặt lịch, xem lịch sử đơn, hủy đơn, đổi thông tin cá nhân & mật khẩu |

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
# Di chuyển vào thư mục backend
cd backend

# Cài đặt thư viện phụ thuộc (nếu chưa cài)
npm install

# Khởi chạy máy chủ
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
- `GET /api/bookings/:id` : Lấy chi tiết đơn đặt cụ thể (*Yêu cầu Token*).
- `PUT /api/bookings/:id/cancel` : Hủy đơn đặt lịch (*Yêu cầu Token*).

### Quản trị viên (`/api/admin`) - *Yêu cầu Token có quyền Admin*
- `GET /api/admin/stats` : Lấy số liệu thống kê tổng thể cho Dashboard.
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
- **CORS & HTTP Headers:** Cấu hình bảo mật chia sẻ tài nguyên nguồn gốc chéo giúp frontend kết nối an toàn.
- **Cơ chế dự phòng sự cố:** Nếu MySQL ngắt kết nối đột ngột, server không bị crash mà tự động chuyển tiếp dữ liệu an toàn.

---

## 👨‍💻 8. Hướng Dẫn Dành Cho Thầy/Cô & Người Đánh Giá

1. Để chấm bài nhanh nhất, chỉ cần mở terminal tại thư mục `backend` và gõ `node server.js`.
2. Mở trình duyệt tại **`http://localhost:5000`**.
3. Đăng nhập bằng tài khoản `admin@cleanova.vn` / `Admin@Cleanova2026!` để kiểm tra toàn bộ quyền Admin Dashboard.
4. Mở thêm cửa sổ ẩn danh và đăng nhập bằng tài khoản `demo@nova.app` / `NovaDemo2026!` để trải nghiệm quy trình: Đặt lịch ➔ Xem đơn tại "Lịch Của Tôi" ➔ Thử hủy đơn ➔ Cập nhật thông tin cá nhân.
5. Kiểm tra mã nguồn: Tất cả các file trong `frontend/` và `backend/` đều được chú thích tiếng Việt chi tiết, cấu trúc chuẩn mực, không dùng framework cồng kềnh.

---
*Cleanova © 2026. All rights reserved. A Cleaner Space, A Better Life.*
