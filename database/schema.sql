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
DROP TABLE IF EXISTS reviews;
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
  total_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền sau giảm giá (VNĐ)',
  discount_code VARCHAR(50) DEFAULT NULL COMMENT 'Mã ưu đãi áp dụng (VD: CLEANOVA20)',
  payment_method ENUM('cash', 'bank_transfer', 'momo', 'vnpay') DEFAULT 'cash' COMMENT 'Phương thức thanh toán',
  payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán',
  status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT 'Trạng thái đơn: pending (chờ duyệt), confirmed (đã nhận), in_progress (đang làm), completed (hoàn thành), cancelled (đã hủy)',
  staff_id INT DEFAULT NULL COMMENT 'Khóa ngoại liên kết tới nhân viên được phân công làm việc',
  assigned_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Thời điểm phân công nhân viên',
  staff_notes TEXT DEFAULT NULL COMMENT 'Ghi chú công việc của nhân viên thực hiện',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_staff ON bookings(staff_id);
CREATE INDEX idx_bookings_service ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_code ON bookings(booking_code);

-- ------------------------------------------------------------
-- BẢNG 4: reviews (Đánh giá chất lượng dịch vụ từ khách hàng)
-- ------------------------------------------------------------
CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE COMMENT 'Khóa ngoại liên kết tới đơn đặt đã hoàn thành',
  user_id INT NOT NULL COMMENT 'Người đánh giá',
  service_id INT NOT NULL COMMENT 'Dịch vụ được đánh giá',
  rating TINYINT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Số sao từ 1 đến 5',
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
