-- ============================================================
-- CLEANOVA DATABASE SCHEMA (MySQL 8.0+ / MariaDB)
-- Ứng dụng Quản lý & Đặt lịch Dịch vụ Vệ sinh Cleanova
-- ============================================================

-- 1. Tạo Database (nếu chưa có)
CREATE DATABASE IF NOT EXISTS cleanova_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cleanova_db;

-- 2. Xóa bảng cũ nếu tồn tại (theo thứ tự khóa ngoại)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS partner_applications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS booking_notifications;
DROP TABLE IF EXISTS booking_job_photos;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;

-- ------------------------------------------------------------
-- BẢNG 1: users (Thông tin tài khoản & Phân quyền)
-- ------------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Họ và tên người dùng',
  email VARCHAR(100) NOT NULL UNIQUE COMMENT 'Địa chỉ email (dùng để đăng nhập)',
  password VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa bằng bcrypt',
  phone VARCHAR(20) DEFAULT NULL COMMENT 'Số điện thoại liên hệ',
  address VARCHAR(255) DEFAULT NULL COMMENT 'Địa chỉ mặc định',
  role ENUM('customer', 'user', 'staff', 'admin') DEFAULT 'customer' COMMENT 'Vai trò: customer (khách hàng), staff (nhân viên), admin (quản trị viên)',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Trạng thái tài khoản: active (hoạt động), inactive (bị vô hiệu hóa)',
  lock_reason VARCHAR(255) DEFAULT NULL COMMENT 'Lý do khóa tài khoản nếu status = inactive',
  avatar_url VARCHAR(255) DEFAULT NULL COMMENT 'Đường dẫn ảnh đại diện',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm đăng ký',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời điểm cập nhật'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index cho tìm kiếm nhanh theo email, role và status
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ------------------------------------------------------------
-- BẢNG 2: services (Danh mục các gói dịch vụ vệ sinh)
-- ------------------------------------------------------------
CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL COMMENT 'Tên dịch vụ (VD: Dọn dẹp nhà cửa theo giờ)',
  slug VARCHAR(150) NOT NULL UNIQUE COMMENT 'Đường dẫn tĩnh thân thiện (URL slug)',
  description TEXT NOT NULL COMMENT 'Mô tả chi tiết nội dung công việc dịch vụ',
  short_description VARCHAR(255) DEFAULT NULL COMMENT 'Mô tả ngắn hiển thị trên thẻ card',
  base_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Giá cơ sở (VNĐ)',
  price_unit VARCHAR(50) NOT NULL DEFAULT 'giờ' COMMENT 'Đơn vị tính (giờ, m², lần, món)',
  duration_estimate VARCHAR(50) DEFAULT '2-4 giờ' COMMENT 'Thời gian ước tính hoàn thành',
  category VARCHAR(50) NOT NULL DEFAULT 'cleaning' COMMENT 'Phân loại dịch vụ: cleaning (Vệ sinh), care (Chăm sóc tại nhà)',
  min_duration_hours INT NOT NULL DEFAULT 1 COMMENT 'Thời lượng tối thiểu theo giờ (VD: 2 giờ đối với chăm sóc)',
  staff_wage_rate DECIMAL(12, 2) DEFAULT NULL COMMENT 'Mức tiền công chi trả cho nhân viên theo đơn vị tính/giờ (VNĐ)',
  shift_price DECIMAL(12, 2) DEFAULT NULL COMMENT 'Giá trọn gói theo buổi (4 giờ) (VNĐ)',
  daily_price DECIMAL(12, 2) DEFAULT NULL COMMENT 'Giá trọn gói theo ngày (8 giờ) (VNĐ)',
  monthly_price DECIMAL(12, 2) DEFAULT NULL COMMENT 'Giá trọn gói theo tháng (26 ngày) (VNĐ)',
  shift_hours INT NOT NULL DEFAULT 4 COMMENT 'Số giờ quy định cho 1 buổi',
  daily_hours INT NOT NULL DEFAULT 8 COMMENT 'Số giờ quy định cho 1 ngày',
  monthly_days INT NOT NULL DEFAULT 26 COMMENT 'Số ngày quy định cho 1 tháng',
  is_shift_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo buổi',
  is_daily_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo ngày',
  is_monthly_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo tháng',
  staff_shift_wage DECIMAL(12, 2) DEFAULT NULL COMMENT 'Tiền công nhân viên theo buổi (VNĐ)',
  staff_daily_wage DECIMAL(12, 2) DEFAULT NULL COMMENT 'Tiền công nhân viên theo ngày (VNĐ)',
  staff_monthly_wage DECIMAL(12, 2) DEFAULT NULL COMMENT 'Tiền công nhân viên theo tháng (VNĐ)',
  icon VARCHAR(50) DEFAULT '🧹' COMMENT 'Icon hoặc emoji đại diện',
  image_url VARCHAR(255) DEFAULT NULL COMMENT 'Ảnh minh họa dịch vụ',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'Trạng thái hoạt động: 1 = Hiển thị, 0 = Ẩn',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_services_slug ON services(slug);
CREATE INDEX idx_services_active ON services(is_active);

-- ------------------------------------------------------------
-- BẢNG 3: bookings (Đơn đặt lịch dịch vụ của khách hàng)
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(20) NOT NULL UNIQUE COMMENT 'Mã đơn đặt (VD: CNV-2026-0001)',
  user_id INT NOT NULL COMMENT 'Khóa ngoại liên kết tới bảng users',
  service_id INT NOT NULL COMMENT 'Khóa ngoại liên kết tới bảng services',
  booking_date DATE NOT NULL COMMENT 'Ngày thực hiện dịch vụ',
  booking_time TIME NOT NULL COMMENT 'Giờ thực hiện dịch vụ',
  area_size VARCHAR(50) DEFAULT 'medium' COMMENT 'Quy mô diện tích (small: <50m2, medium: 50-100m2, large: >100m2)',
  frequency VARCHAR(50) DEFAULT 'once' COMMENT 'Tần suất: once (1 lần), weekly (hàng tuần - giảm 15%), monthly (hàng tháng - giảm 10%)',
  address VARCHAR(255) NOT NULL COMMENT 'Địa chỉ nhà thực hiện dịch vụ',
  phone VARCHAR(20) NOT NULL COMMENT 'Số điện thoại liên hệ khi tới làm',
  notes TEXT DEFAULT NULL COMMENT 'Ghi chú thêm cho chuyên viên vệ sinh',
  package_type ENUM('hourly', 'shift', 'daily', 'monthly') NOT NULL DEFAULT 'hourly' COMMENT 'Gói tính giá dịch vụ chăm sóc: theo giờ, theo buổi, theo ngày, theo tháng',
  shift_choice VARCHAR(50) DEFAULT NULL COMMENT 'Ca đăng ký: morning (Sáng), afternoon (Chiều), evening (Tối)',
  recipient_name VARCHAR(120) DEFAULT NULL COMMENT 'Tên người được chăm sóc',
  recipient_age VARCHAR(50) DEFAULT NULL COMMENT 'Độ tuổi / năm sinh của người được chăm sóc',
  recipient_gender VARCHAR(20) DEFAULT NULL COMMENT 'Giới tính người được chăm sóc',
  care_scope_notes TEXT DEFAULT NULL COMMENT 'Ghi chú phạm vi chăm sóc & thói quen sinh hoạt',
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền sau giảm giá (VNĐ)',
  discount_code VARCHAR(50) DEFAULT NULL COMMENT 'Mã ưu đãi áp dụng (VD: CLEANOVA20)',
  payment_method ENUM('cash', 'bank_transfer', 'momo', 'vnpay') DEFAULT 'cash' COMMENT 'Phương thức thanh toán',
  payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán',
  status ENUM('pending', 'assigned', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT 'Trạng thái đơn: pending, assigned, confirmed, arrived, in_progress, completed, cancelled',
  staff_id INT DEFAULT NULL COMMENT 'Khóa ngoại liên kết tới nhân viên được phân công làm việc',
  assigned_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm phân công nhân viên',
  staff_notes TEXT DEFAULT NULL COMMENT 'Ghi chú công việc của nhân viên thực hiện',
  cancel_reason TEXT DEFAULT NULL COMMENT 'Lý do nhân viên hoặc khách hàng hủy đơn',
  arrived_at DATETIME DEFAULT NULL COMMENT 'Thời điểm nhân viên xác nhận đã đến địa chỉ',
  paid_at DATETIME DEFAULT NULL COMMENT 'Thời điểm xác nhận đã thu tiền mặt',
  tip_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền tip tự nguyện do khách ghi nhận',
  tip_created_at DATETIME DEFAULT NULL COMMENT 'Thời điểm khách ghi nhận tiền tip',
  duration_hours DECIMAL(4, 1) DEFAULT NULL COMMENT 'Thời lượng dịch vụ theo giờ (áp dụng cho dịch vụ tính theo giờ / chăm sóc)',
  staff_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền công chi trả cho nhân viên thực hiện (VNĐ)',
  wage_status ENUM('pending', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái đối soát tiền công: pending (chờ hoàn thành), approved (đã chốt), paid (đã chi trả), cancelled (hủy)',
  wage_settled_at DATETIME DEFAULT NULL COMMENT 'Thời điểm quản trị viên chi trả tiền công',
  wage_settled_by INT DEFAULT NULL COMMENT 'Admin ID đã duyệt chi trả tiền công',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_wage_admin FOREIGN KEY (wage_settled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_staff ON bookings(staff_id);
CREATE INDEX idx_bookings_service ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_code ON bookings(booking_code);

-- ------------------------------------------------------------
-- BẢNG 3a: booking_job_photos (Ảnh Before / After theo từng góc)
-- ------------------------------------------------------------
CREATE TABLE booking_job_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  area_name VARCHAR(120) NOT NULL,
  angle_id VARCHAR(64) NOT NULL,
  stage ENUM('before', 'after') NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  captured_at DATETIME NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_job_photos_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_booking_job_photo_stage (booking_id, area_name, angle_id, stage),
  INDEX idx_booking_job_photos_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- BẢNG 3b: booking_notifications (Thông báo trong ứng dụng)
-- ------------------------------------------------------------
CREATE TABLE booking_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  booking_id INT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  data JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_notifications_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_booking_notification_type (booking_id, notification_type),
  INDEX idx_booking_notifications_user (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- BẢNG 4: reviews (Đánh giá chất lượng dịch vụ từ khách hàng)
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE COMMENT 'Khóa ngoại liên kết tới đơn đặt đã hoàn thành',
  user_id INT NOT NULL COMMENT 'Người đánh giá',
  service_id INT NOT NULL COMMENT 'Dịch vụ được đánh giá',
  rating TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Số sao từ 1 đến 5',
  staff_rating TINYINT UNSIGNED DEFAULT NULL COMMENT 'Số sao khách hàng đánh giá nhân viên',
  comment TEXT DEFAULT NULL COMMENT 'Nhận xét chi tiết',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- BẢNG 5: audit_logs (Nhật ký thao tác quản trị quan trọng)
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL COMMENT 'ID của Quản trị viên thực hiện thao tác',
  action VARCHAR(100) NOT NULL COMMENT 'Loại hành động: DEACTIVATE_USER, ACTIVATE_USER, DELETE_USER, ASSIGN_STAFF, UPDATE_ROLE...',
  target_id INT DEFAULT NULL COMMENT 'ID đối tượng chịu tác động',
  target_type VARCHAR(50) DEFAULT 'user' COMMENT 'Loại đối tượng (user, booking, service)',
  details TEXT DEFAULT NULL COMMENT 'Mô tả chi tiết hành động (không lưu mật khẩu/token)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- BẢNG 6: partner_applications (Hồ sơ đăng ký đối tác & nhân viên Cleanova)
-- ------------------------------------------------------------
CREATE TABLE partner_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Họ và tên ứng viên',
  email VARCHAR(100) NOT NULL UNIQUE COMMENT 'Địa chỉ email liên hệ',
  phone VARCHAR(20) NOT NULL COMMENT 'Số điện thoại liên hệ',
  password VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa bcrypt',
  address VARCHAR(255) NOT NULL COMMENT 'Địa chỉ hiện tại',
  work_area VARCHAR(150) NOT NULL COMMENT 'Khu vực làm việc mong muốn',
  experience VARCHAR(100) DEFAULT NULL COMMENT 'Kinh nghiệm làm việc',
  available_hours VARCHAR(100) DEFAULT NULL COMMENT 'Khung giờ có thể làm việc',
  bio TEXT DEFAULT NULL COMMENT 'Giới thiệu ngắn về bản thân & kỹ năng',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Trạng thái: pending (chờ duyệt), approved (đã duyệt), rejected (từ chối)',
  rejection_reason TEXT DEFAULT NULL COMMENT 'Lý do từ chối (nếu có)',
  reviewed_by INT DEFAULT NULL COMMENT 'Admin ID đã duyệt',
  reviewed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm duyệt',
  user_id INT DEFAULT NULL COMMENT 'ID tài khoản staff được tạo sau khi duyệt',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_partner_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_partner_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_partner_email ON partner_applications(email);
CREATE INDEX idx_partner_phone ON partner_applications(phone);
CREATE INDEX idx_partner_status ON partner_applications(status);

-- ------------------------------------------------------------
-- BẢNG 7: staff_payout_logs (Lịch sử đối soát & chi trả tiền công nhân viên)
-- ------------------------------------------------------------
CREATE TABLE staff_payout_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL COMMENT 'Đơn đặt lịch được đối soát chi trả',
  staff_id INT NOT NULL COMMENT 'Nhân viên nhận tiền công',
  admin_id INT NOT NULL COMMENT 'Quản trị viên thực hiện thao tác',
  amount DECIMAL(12, 2) NOT NULL COMMENT 'Số tiền công thanh toán (VNĐ)',
  action ENUM('approve', 'pay', 'adjust') NOT NULL DEFAULT 'pay' COMMENT 'Hành động: approve (chốt), pay (chi trả), adjust (điều chỉnh)',
  note TEXT DEFAULT NULL COMMENT 'Ghi chú đối soát hoặc mã giao dịch ngân hàng',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payout_booking (booking_id),
  INDEX idx_payout_staff (staff_id),
  CONSTRAINT fk_payout_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
