// ============================================================
// DABCLEAN BACKEND - Database Configuration (MySQL Pool + Graceful Fallback)
// ============================================================
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let pool = null;
let isConnectedToMySQL = false;

// Cấu hình kết nối MySQL từ biến môi trường
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cleanova_db',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// ------------------------------------------------------------
// Kho dữ liệu bộ nhớ cục bộ (In-Memory Database Fallback)
// Dùng khi máy tính chưa khởi động MySQL / XAMPP để web không bị crash
// ------------------------------------------------------------
const inMemoryData = {
  users: [
    {
      id: 1,
      name: 'Quản Trị Viên DabClean',
      email: 'admin@cleanova.vn',
      password: '$2a$10$ZZn8Td.6jh83f7FySaJ/1OnHyXgbyE2yC9rmaOaiHv6sq4Hiraoja', // Admin@Cleanova2026!
      phone: '0912345678',
      address: 'Tòa nhà DabClean, Cầu Giấy, Hà Nội',
      role: 'admin',
      status: 'active',
      created_at: new Date('2026-01-01T08:00:00Z')
    },
    {
      id: 2,
      name: 'Nguyễn Tiến Đức',
      email: 'demo@nova.app',
      password: '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS', // NovaDemo2026!
      phone: '0987654321',
      address: 'Số 25 Phố Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
      role: 'customer',
      status: 'active',
      created_at: new Date('2026-02-15T09:30:00Z')
    },
    {
      id: 3,
      name: 'Trần Văn Bảo',
      email: 'staff@cleanova.vn',
      password: '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', // Staff@Cleanova2026!
      phone: '0933445566',
      address: 'Số 12 Chùa Láng, Đống Đa, Hà Nội',
      role: 'staff',
      status: 'active',
      created_at: new Date('2026-02-01T08:00:00Z')
    },
    {
      id: 4,
      name: 'Lê Thị Mai',
      email: 'staff2@cleanova.vn',
      password: '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', // Staff@Cleanova2026!
      phone: '0944556677',
      address: 'Khu đô thị Ngoại Giao Đoàn, Bắc Từ Liêm, Hà Nội',
      role: 'staff',
      status: 'active',
      created_at: new Date('2026-02-10T08:00:00Z')
    },
    {
      id: 5,
      name: 'Trần Thu Hà',
      email: 'ha.tran@example.com',
      password: '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS',
      phone: '0901122334',
      address: 'Vinhomes Smart City, Nam Từ Liêm, Hà Nội',
      role: 'customer',
      status: 'active',
      created_at: new Date('2026-03-01T08:00:00Z')
    },
    {
      id: 6,
      name: 'Tài Khoản Bị Khóa',
      email: 'locked@cleanova.vn',
      password: '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS',
      phone: '0999888777',
      address: 'Hà Nội',
      role: 'customer',
      status: 'inactive',
      created_at: new Date('2026-03-05T08:00:00Z')
    }
  ],
  services: [
    {
      id: 1,
      name: 'Dọn dẹp nhà cửa theo giờ',
      slug: 'don-dep-theo-gio',
      description: 'Lau dọn phòng khách, hút bụi thảm, cọ rửa nhà vệ sinh, lau sàn và sắp xếp đồ dùng gọn gàng.',
      short_description: 'Lau chùi, dọn phòng khách, phòng ngủ, nhà bếp, toilet. Linh hoạt theo nhu cầu.',
      base_price: 150000,
      price_unit: 'giờ',
      duration_estimate: '2 - 4 giờ',
      category: 'cleaning',
      min_duration_hours: 1,
      staff_wage_rate: 105000,
      icon: '⏱️',
      is_active: 1
    },
    {
      id: 2,
      name: 'Tổng vệ sinh Deep Cleaning',
      slug: 'tong-ve-sinh-deep-cleaning',
      description: 'Vệ sinh toàn diện và chuyên sâu mọi ngóc ngách: trần, tường, khe cửa, kính hai mặt, tẩy cặn canxi, khử dầu mỡ.',
      short_description: 'Vệ sinh toàn bộ diện tích nhà, làm sạch sâu mọi ngóc ngách. Chuẩn định kỳ.',
      base_price: 500000,
      price_unit: 'lần',
      duration_estimate: '4 - 6 giờ',
      category: 'cleaning',
      min_duration_hours: 1,
      staff_wage_rate: 350000,
      icon: '✨',
      is_active: 1
    },
    {
      id: 3,
      name: 'Vệ sinh văn phòng & Workspace',
      slug: 've-sinh-van-phong',
      description: 'Giải pháp vệ sinh định kỳ cho doanh nghiệp, công ty khởi nghiệp và coworking space.',
      short_description: 'Định kỳ cho doanh nghiệp, đảm bảo môi trường làm việc sạch đẹp, chuyên nghiệp.',
      base_price: 300000,
      price_unit: 'lần',
      duration_estimate: '2 - 3 giờ',
      category: 'cleaning',
      min_duration_hours: 1,
      staff_wage_rate: 210000,
      icon: '🏢',
      is_active: 1
    },
    {
      id: 4,
      name: 'Giặt Sofa, Nệm & Rèm cửa',
      slug: 'giat-sofa-nem-rem',
      description: 'Hút bụi chuyên sâu kết hợp phun hơi nước nóng 140°C để khử khuẩn, diệt 99.9% rệp mạt bụi và vi nấm.',
      short_description: 'Hút bụi chuyên sâu, khử khuẩn bằng hơi nước nóng. Trả lại vẻ mới cho nội thất.',
      base_price: 400000,
      price_unit: 'món',
      duration_estimate: '1 - 2 giờ',
      category: 'cleaning',
      min_duration_hours: 1,
      staff_wage_rate: 280000,
      icon: '🛋️',
      is_active: 1
    },
    {
      id: 5,
      name: 'Vệ sinh sau xây dựng',
      slug: 've-sinh-sau-xay-dung',
      description: 'Thu gom rác thô, tẩy sạch vết sơn bám trên sàn, hút bụi mịn công nghiệp và khử mùi xi măng trước khi dọn về.',
      short_description: 'Dọn dẹp thô, xử lý vết sơn, bụi mịn sau thi công. Sẵn sàng cho ngày dọn về.',
      base_price: 8000,
      price_unit: 'm²',
      duration_estimate: '1 - 2 ngày',
      category: 'cleaning',
      min_duration_hours: 1,
      staff_wage_rate: 5600,
      icon: '🏗️',
      is_active: 1
    },
    {
      id: 6,
      name: 'Chăm sóc trẻ em tại nhà',
      slug: 'cham-soc-tre-em',
      description: 'Dịch vụ bảo mẫu chăm sóc trẻ chuyên nghiệp tại nhà: đón bé, chuẩn bị bữa ăn nhẹ dinh dưỡng, hỗ trợ bé vệ sinh cá nhân, kèm bé học bài, đọc sách và tổ chức trò chơi phát triển tư duy lành mạnh theo độ tuổi. Nhân viên lý lịch minh bạch, chu đáo và kiên nhẫn.',
      short_description: 'Chăm sóc trẻ, hỗ trợ sinh hoạt, ăn uống và vui chơi lành mạnh theo độ tuổi.',
      base_price: 80000,
      price_unit: 'giờ',
      duration_estimate: 'Tối thiểu 2 giờ',
      category: 'care',
      min_duration_hours: 2,
      staff_wage_rate: 60000,
      shift_price: 300000,
      daily_price: 580000,
      monthly_price: 14000000,
      shift_hours: 4,
      daily_hours: 8,
      monthly_days: 26,
      is_shift_active: 1,
      is_daily_active: 1,
      is_monthly_active: 1,
      staff_shift_wage: 220000,
      staff_daily_wage: 430000,
      staff_monthly_wage: 10500000,
      icon: '👶',
      is_active: 1
    },
    {
      id: 7,
      name: 'Chăm sóc người cao tuổi tại nhà',
      slug: 'cham-soc-nguoi-cao-tuoi',
      description: 'Dịch vụ điều dưỡng viên đồng hành cùng người cao tuổi: hỗ trợ người lớn tuổi sinh hoạt, chuẩn bị bữa ăn hợp khẩu vị, nhắc nhở uống thuốc đúng giờ theo chỉ định của bác sĩ, hỗ trợ đi dạo, trò chuyện tâm tình và giúp người cao tuổi vận động nhẹ nhàng an toàn.',
      short_description: 'Hỗ trợ sinh hoạt, ăn uống, nhắc thuốc và đồng hành cùng người cao tuổi.',
      base_price: 90000,
      price_unit: 'giờ',
      duration_estimate: 'Tối thiểu 2 giờ',
      category: 'care',
      min_duration_hours: 2,
      staff_wage_rate: 70000,
      shift_price: 340000,
      daily_price: 650000,
      monthly_price: 15500000,
      shift_hours: 4,
      daily_hours: 8,
      monthly_days: 26,
      is_shift_active: 1,
      is_daily_active: 1,
      is_monthly_active: 1,
      staff_shift_wage: 250000,
      staff_daily_wage: 480000,
      staff_monthly_wage: 11500000,
      icon: '👵',
      is_active: 1
    },
    {
      id: 8,
      name: 'Chăm sóc người bệnh tại nhà',
      slug: 'cham-soc-nguoi-benh',
      description: 'Hỗ trợ sinh hoạt và chăm sóc thể chất thông thường cho người ốm, người sau phẫu thuật hoặc đang hồi phục sức khỏe: hỗ trợ vệ sinh cá nhân, thay ga giường, theo dõi chỉ số sinh tồn cơ bản (huyết áp, nhiệt độ) và hỗ trợ dinh dưỡng theo chế độ ăn uống đã thống nhất. LƯU Ý: Dịch vụ hỗ trợ đời sống, nhân viên DabClean không thực hiện các thủ thuật can thiệp y tế chuyên sâu.',
      short_description: 'Hỗ trợ sinh hoạt và chăm sóc thông thường theo kế hoạch đã thống nhất.',
      base_price: 120000,
      price_unit: 'giờ',
      duration_estimate: 'Tối thiểu 2 giờ',
      category: 'care',
      min_duration_hours: 2,
      staff_wage_rate: 90000,
      shift_price: 450000,
      daily_price: 860000,
      monthly_price: 20500000,
      shift_hours: 4,
      daily_hours: 8,
      monthly_days: 26,
      is_shift_active: 1,
      is_daily_active: 1,
      is_monthly_active: 1,
      staff_shift_wage: 330000,
      staff_daily_wage: 630000,
      staff_monthly_wage: 15000000,
      icon: '🩺',
      is_active: 1
    }
  ],
  bookings: [
    {
      id: 1,
      booking_code: 'CNV-2026-0001',
      user_id: 2,
      service_id: 1,
      service_name: 'Dọn dẹp nhà cửa theo giờ',
      service_icon: '⏱️',
      booking_date: '2026-10-18',
      booking_time: '08:30:00',
      area_size: 'medium',
      frequency: 'weekly',
      address: 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội',
      phone: '0987654321',
      notes: 'Nhà có mèo cưng, vui lòng dùng dung dịch sinh học an toàn',
      total_price: 191250,
      discount_code: null,
      payment_method: 'cash',
      payment_status: 'unpaid',
      status: 'confirmed',
      staff_id: 3,
      staff_name: 'Trần Văn Bảo',
      staff_notes: 'Đã liên hệ khách, chuẩn bị bộ lau đa năng và dung dịch hữu cơ.',
      cancel_reason: null,
      arrived_at: null,
      paid_at: null,
      tip_amount: 0,
      tip_created_at: null,
      staff_wage: 105000,
      commission_rate: 0.20,
      platform_commission: 21000,
      staff_net_wage: 84000,
      wage_status: 'pending',
      wage_settled_at: null,
      wage_settled_by: null,
      assigned_at: new Date('2026-10-14T10:00:00Z'),
      created_at: new Date('2026-10-14T10:00:00Z')
    },
    {
      id: 2,
      booking_code: 'CNV-2026-0002',
      user_id: 2,
      service_id: 4,
      service_name: 'Giặt Sofa, Nệm & Rèm cửa',
      service_icon: '🛋️',
      booking_date: '2026-10-22',
      booking_time: '14:00:00',
      area_size: 'small',
      frequency: 'once',
      address: 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội',
      phone: '0987654321',
      notes: 'Giặt 1 bộ sofa góc L nỉ nhung',
      total_price: 320000,
      discount_code: 'CLEANOVA20',
      payment_method: 'bank_transfer',
      payment_status: 'paid',
      status: 'completed',
      staff_id: 3,
      staff_name: 'Trần Văn Bảo',
      staff_notes: 'Đã giặt xong, khách nghiệm thu hài lòng 100%.',
      cancel_reason: null,
      arrived_at: new Date('2026-10-22T13:50:00Z'),
      paid_at: new Date('2026-10-22T16:00:00Z'),
      tip_amount: 0,
      tip_created_at: null,
      staff_wage: 280000,
      commission_rate: 0.20,
      platform_commission: 56000,
      staff_net_wage: 224000,
      wage_status: 'approved',
      wage_settled_at: null,
      wage_settled_by: null,
      assigned_at: new Date('2026-10-12T15:30:00Z'),
      created_at: new Date('2026-10-12T15:20:00Z')
    },
    {
      id: 3,
      booking_code: 'CNV-2026-0003',
      user_id: 5,
      service_id: 2,
      service_name: 'Tổng vệ sinh Deep Cleaning',
      service_icon: '✨',
      booking_date: '2026-10-25',
      booking_time: '09:00:00',
      area_size: 'large',
      frequency: 'once',
      address: 'Tòa S2.05 Vinhomes Smart City, Hà Nội',
      phone: '0901122334',
      notes: 'Cần tổng vệ sinh trước khi đón bố mẹ lên chơi',
      total_price: 2000000,
      discount_code: null,
      payment_method: 'momo',
      payment_status: 'paid',
      status: 'in_progress',
      staff_id: 4,
      staff_name: 'Lê Thị Mai',
      staff_notes: 'Đang xử lý tẩy cặn canxi và lau kính tầng 2.',
      staff_wage: 770000,
      commission_rate: 0.20,
      platform_commission: 154000,
      staff_net_wage: 616000,
      wage_status: 'pending',
      wage_settled_at: null,
      wage_settled_by: null,
      assigned_at: new Date('2026-10-14T14:00:00Z'),
      created_at: new Date('2026-10-14T14:00:00Z')
    },
    {
      id: 4,
      booking_code: 'CNV-2026-0004',
      user_id: 2,
      service_id: 3,
      service_name: 'Vệ sinh văn phòng & Workspace',
      service_icon: '🏢',
      booking_date: '2026-10-28',
      booking_time: '08:00:00',
      area_size: 'medium',
      frequency: 'monthly',
      address: 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội',
      phone: '0987654321',
      notes: 'Vệ sinh văn phòng định kỳ đầu tháng',
      total_price: 650000,
      discount_code: null,
      payment_method: 'cash',
      payment_status: 'unpaid',
      status: 'pending',
      staff_id: null,
      staff_name: null,
      staff_notes: null,
      cancel_reason: null,
      arrived_at: null,
      paid_at: null,
      tip_amount: 0,
      tip_created_at: null,
      staff_wage: 210000,
      commission_rate: 0.20,
      platform_commission: 42000,
      staff_net_wage: 168000,
      wage_status: 'pending',
      wage_settled_at: null,
      wage_settled_by: null,
      assigned_at: null,
      created_at: new Date('2026-10-15T01:00:00Z')
    }
  ],
  reviews: [
    {
      id: 1,
      booking_id: 2,
      user_id: 2,
      service_id: 4,
      rating: 5,
      comment: 'Giặt sofa nỉ nhung rất sạch, tẩy hết vết ố trà. Bạn Bảo đến đúng giờ và làm việc chu đáo.',
      created_at: new Date('2026-10-13T10:00:00Z')
    }
  ],
  audit_logs: [],
  partner_applications: [
    {
      id: 1,
      name: 'Đặng Quốc Anh',
      email: 'quocanh.partner@gmail.com',
      phone: '0977112233',
      password: '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', // Staff@Cleanova2026!
      address: 'Số 45 ngõ 165 Cầu Giấy, Hà Nội',
      work_area: 'Cầu Giấy, Nam Từ Liêm',
      experience: '1-3 năm',
      available_hours: 'Toàn thời gian (Full-time)',
      bio: 'Đã có 2 năm làm dịch vụ dọn dẹp buồng phòng khách sạn, cẩn thận, trung thực, có xe máy đi lại.',
      status: 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      user_id: null,
      created_at: new Date('2026-10-15T08:00:00Z'),
      updated_at: new Date('2026-10-15T08:00:00Z')
    },
    {
      id: 2,
      name: 'Nguyễn Thị Hồng',
      email: 'hong.partner@gmail.com',
      phone: '0988776655',
      password: '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC',
      address: 'Số 89 Nguyễn Trãi, Thanh Xuân, Hà Nội',
      work_area: 'Thanh Xuân, Đống Đa',
      experience: 'Trên 3 năm',
      available_hours: 'Linh hoạt theo ca',
      bio: 'Kinh nghiệm tổng vệ sinh căn hộ cao cấp và giặt ghế sofa, nhiệt tình, tỉ mỉ.',
      status: 'approved',
      rejection_reason: null,
      reviewed_by: 1,
      reviewed_at: new Date('2026-10-12T09:00:00Z'),
      user_id: 3,
      created_at: new Date('2026-10-10T10:00:00Z'),
      updated_at: new Date('2026-10-12T09:00:00Z')
    }
  ]
};

inMemoryData.jobPhotos = [];
inMemoryData.bookingNotifications = [];
inMemoryData.staff_commission_payments = [];

// Khởi tạo và kiểm tra kết nối MySQL
async function initDatabase() {
  let connection;
  try {
    pool = mysql.createPool(dbConfig);
    connection = await pool.getConnection();
    const [bookingColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'`
    );
    const existingBookingColumns = new Set(bookingColumns.map(column => column.COLUMN_NAME));
    await connection.query(`
      ALTER TABLE bookings
      MODIFY status ENUM('pending', 'assigned', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled')
      NOT NULL DEFAULT 'pending'
    `);
    const bookingColumnDefinitions = {
      cancel_reason: 'TEXT NULL',
      arrived_at: 'DATETIME NULL',
      paid_at: 'DATETIME NULL',
      tip_amount: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      tip_created_at: 'DATETIME NULL'
    };
    for (const [column, definition] of Object.entries(bookingColumnDefinitions)) {
      if (!existingBookingColumns.has(column)) {
        await connection.query(`ALTER TABLE bookings ADD COLUMN ${column} ${definition}`);
      }
    }
    const [reviewColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'`
    );
    if (!reviewColumns.some(column => column.COLUMN_NAME === 'staff_rating')) {
      await connection.query('ALTER TABLE reviews ADD COLUMN staff_rating TINYINT UNSIGNED NULL AFTER rating');
    }
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booking_job_photos (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS booking_notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        booking_id INT NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(160) NOT NULL,
        message TEXT NOT NULL,
        data JSON NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_booking_notification_type (booking_id, notification_type),
        INDEX idx_booking_notifications_user (user_id, is_read, created_at),
        CONSTRAINT fk_booking_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_booking_notifications_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Bảo vệ Bug 9: Tự động khởi tạo bảng audit_logs nếu cơ sở dữ liệu cũ chưa có
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL COMMENT 'ID của Quản trị viên thực hiện thao tác',
        action VARCHAR(100) NOT NULL,
        target_id INT DEFAULT NULL,
        target_type VARCHAR(50) DEFAULT 'user',
        details TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_admin (admin_id),
        CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Bảo vệ Bug 9: Tự động khởi tạo bảng partner_applications nếu cơ sở dữ liệu cũ chưa có
    await connection.query(`
      CREATE TABLE IF NOT EXISTS partner_applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        phone VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        work_area VARCHAR(150) NOT NULL,
        experience VARCHAR(100) DEFAULT NULL,
        available_hours VARCHAR(100) DEFAULT NULL,
        bio TEXT DEFAULT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT DEFAULT NULL,
        terms_version VARCHAR(20) NOT NULL DEFAULT '1.0',
        privacy_version VARCHAR(20) NOT NULL DEFAULT '1.0',
        terms_accepted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
        reviewed_by INT DEFAULT NULL,
        reviewed_at TIMESTAMP NULL DEFAULT NULL,
        user_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_partner_email (email),
        INDEX idx_partner_phone (phone),
        CONSTRAINT fk_partner_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_partner_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Migration: Bổ sung các cột điều khoản và chính sách bảo mật cho partner_applications nếu chưa có
    const [partnerCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_applications'`
    );
    const existingPartnerCols = new Set(partnerCols.map(c => c.COLUMN_NAME));
    if (!existingPartnerCols.has('terms_version')) {
      await connection.query("ALTER TABLE partner_applications ADD COLUMN terms_version VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT 'Phiên bản Điều khoản đối tác'");
    }
    if (!existingPartnerCols.has('privacy_version')) {
      await connection.query("ALTER TABLE partner_applications ADD COLUMN privacy_version VARCHAR(20) NOT NULL DEFAULT '1.0' COMMENT 'Phiên bản Chính sách bảo mật'");
    }
    if (!existingPartnerCols.has('terms_accepted_at')) {
      await connection.query("ALTER TABLE partner_applications ADD COLUMN terms_accepted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm xác nhận đồng ý điều khoản'");
    }
    if (!existingPartnerCols.has('marketing_consent')) {
      await connection.query("ALTER TABLE partner_applications ADD COLUMN marketing_consent TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Đồng ý nhận tin tuyển dụng và phúc lợi'");
    }

    // Bảo vệ Bug 9: Tự động khởi tạo dữ liệu mẫu cho partner_applications nếu bảng đang trống
    const [existingPartners] = await connection.query('SELECT COUNT(*) AS count FROM partner_applications');
    if (existingPartners && existingPartners[0] && existingPartners[0].count === 0) {
      await connection.query(`
        INSERT INTO partner_applications (id, name, email, phone, password, address, work_area, experience, available_hours, bio, status, reviewed_by, reviewed_at, user_id) VALUES
        (1, 'Đặng Quốc Anh', 'quocanh.partner@gmail.com', '0977112233', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', 'Số 45 ngõ 165 Cầu Giấy, Hà Nội', 'Cầu Giấy, Nam Từ Liêm', '1-3 năm', 'Toàn thời gian (Full-time)', 'Đã có 2 năm làm dịch vụ dọn dẹp buồng phòng khách sạn, cẩn thận, trung thực, có xe máy đi lại.', 'pending', NULL, NULL, NULL),
        (2, 'Nguyễn Thị Hồng', 'hong.partner@gmail.com', '0988776655', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', 'Số 89 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Thanh Xuân, Đống Đa', 'Trên 3 năm', 'Linh hoạt theo ca', 'Kinh nghiệm tổng vệ sinh căn hộ cao cấp và giặt ghế sofa, nhiệt tình, tỉ mỉ.', 'approved', 1, '2026-10-12 09:00:00', 3)
      `);
      // Đảm bảo không có tài khoản user rác chiếm email của đối tác đang chờ duyệt
      await connection.query("DELETE FROM users WHERE email = 'quocanh.partner@gmail.com' AND role = 'user'");
    }

    // ------------------------------------------------------------
    // Migration: Mở rộng Dịch vụ chăm sóc tại nhà & Quản lý tiền công nhân viên
    // ------------------------------------------------------------
    const [serviceColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services'`
    );
    const existingServiceColumns = new Set(serviceColumns.map(c => c.COLUMN_NAME));
    if (!existingServiceColumns.has('category')) {
      await connection.query("ALTER TABLE services ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'cleaning' COMMENT 'Phân loại: cleaning hoặc care'");
    }
    if (!existingServiceColumns.has('min_duration_hours')) {
      await connection.query("ALTER TABLE services ADD COLUMN min_duration_hours INT NOT NULL DEFAULT 1 COMMENT 'Thời lượng tối thiểu theo giờ'");
    }
    if (!existingServiceColumns.has('staff_wage_rate')) {
      await connection.query("ALTER TABLE services ADD COLUMN staff_wage_rate DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Mức tiền công chi trả nhân viên'");
    }
    if (!existingServiceColumns.has('shift_price')) {
      await connection.query("ALTER TABLE services ADD COLUMN shift_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Giá trọn gói theo buổi (4h)'");
    }
    if (!existingServiceColumns.has('daily_price')) {
      await connection.query("ALTER TABLE services ADD COLUMN daily_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Giá trọn gói theo ngày (8h)'");
    }
    if (!existingServiceColumns.has('monthly_price')) {
      await connection.query("ALTER TABLE services ADD COLUMN monthly_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Giá trọn gói theo tháng (26 ngày)'");
    }
    if (!existingServiceColumns.has('shift_hours')) {
      await connection.query("ALTER TABLE services ADD COLUMN shift_hours INT NOT NULL DEFAULT 4 COMMENT 'Số giờ quy định 1 buổi'");
    }
    if (!existingServiceColumns.has('daily_hours')) {
      await connection.query("ALTER TABLE services ADD COLUMN daily_hours INT NOT NULL DEFAULT 8 COMMENT 'Số giờ quy định 1 ngày'");
    }
    if (!existingServiceColumns.has('monthly_days')) {
      await connection.query("ALTER TABLE services ADD COLUMN monthly_days INT NOT NULL DEFAULT 26 COMMENT 'Số ngày quy định 1 tháng'");
    }
    if (!existingServiceColumns.has('is_shift_active')) {
      await connection.query("ALTER TABLE services ADD COLUMN is_shift_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo buổi'");
    }
    if (!existingServiceColumns.has('is_daily_active')) {
      await connection.query("ALTER TABLE services ADD COLUMN is_daily_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo ngày'");
    }
    if (!existingServiceColumns.has('is_monthly_active')) {
      await connection.query("ALTER TABLE services ADD COLUMN is_monthly_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Kích hoạt gói theo tháng'");
    }
    if (!existingServiceColumns.has('staff_shift_wage')) {
      await connection.query("ALTER TABLE services ADD COLUMN staff_shift_wage DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Tiền công nhân viên theo buổi'");
    }
    if (!existingServiceColumns.has('staff_daily_wage')) {
      await connection.query("ALTER TABLE services ADD COLUMN staff_daily_wage DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Tiền công nhân viên theo ngày'");
    }
    if (!existingServiceColumns.has('staff_monthly_wage')) {
      await connection.query("ALTER TABLE services ADD COLUMN staff_monthly_wage DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Tiền công nhân viên theo tháng'");
    }

    // Cập nhật dịch vụ vệ sinh hiện có
    await connection.query("UPDATE services SET category = 'cleaning' WHERE category IS NULL OR category = ''");
    await connection.query("UPDATE services SET min_duration_hours = 1 WHERE min_duration_hours IS NULL OR min_duration_hours < 1");

    // Thêm 3 dịch vụ chăm sóc tại nhà nếu chưa có
    const careServicesToSeed = [
      {
        id: 6,
        name: 'Chăm sóc trẻ em tại nhà',
        slug: 'cham-soc-tre-em',
        description: 'Dịch vụ bảo mẫu chăm sóc trẻ chuyên nghiệp tại nhà: đón bé, chuẩn bị bữa ăn nhẹ dinh dưỡng, hỗ trợ bé vệ sinh cá nhân, kèm bé học bài, đọc sách và tổ chức trò chơi phát triển tư duy lành mạnh theo độ tuổi. Nhân viên lý lịch minh bạch, chu đáo và kiên nhẫn.',
        short_description: 'Chăm sóc trẻ, hỗ trợ sinh hoạt, ăn uống và vui chơi lành mạnh theo độ tuổi.',
        base_price: 80000.00,
        price_unit: 'giờ',
        duration_estimate: 'Tối thiểu 2 giờ',
        category: 'care',
        min_duration_hours: 2,
        staff_wage_rate: 60000.00,
        shift_price: 300000.00,
        daily_price: 580000.00,
        monthly_price: 14000000.00,
        staff_shift_wage: 220000.00,
        staff_daily_wage: 430000.00,
        staff_monthly_wage: 10500000.00,
        icon: '👶'
      },
      {
        id: 7,
        name: 'Chăm sóc người cao tuổi tại nhà',
        slug: 'cham-soc-nguoi-cao-tuoi',
        description: 'Dịch vụ điều dưỡng viên đồng hành cùng người cao tuổi: hỗ trợ người lớn tuổi sinh hoạt, chuẩn bị bữa ăn hợp khẩu vị, nhắc nhở uống thuốc đúng giờ theo chỉ định của bác sĩ, hỗ trợ đi dạo, trò chuyện tâm tình và giúp người cao tuổi vận động nhẹ nhàng an toàn.',
        short_description: 'Hỗ trợ sinh hoạt, ăn uống, nhắc thuốc và đồng hành cùng người cao tuổi.',
        base_price: 90000.00,
        price_unit: 'giờ',
        duration_estimate: 'Tối thiểu 2 giờ',
        category: 'care',
        min_duration_hours: 2,
        staff_wage_rate: 70000.00,
        shift_price: 340000.00,
        daily_price: 650000.00,
        monthly_price: 15500000.00,
        staff_shift_wage: 250000.00,
        staff_daily_wage: 480000.00,
        staff_monthly_wage: 11500000.00,
        icon: '👵'
      },
      {
        id: 8,
        name: 'Chăm sóc người bệnh tại nhà',
        slug: 'cham-soc-nguoi-benh',
        description: 'Hỗ trợ sinh hoạt và chăm sóc thể chất thông thường cho người ốm, người sau phẫu thuật hoặc đang hồi phục sức khỏe: hỗ trợ vệ sinh cá nhân, thay ga giường, theo dõi chỉ số sinh tồn cơ bản (huyết áp, nhiệt độ) và hỗ trợ dinh dưỡng theo chế độ ăn uống đã thống nhất. LƯU Ý: Dịch vụ hỗ trợ đời sống, nhân viên DabClean không thực hiện các thủ thuật can thiệp y tế chuyên sâu.',
        short_description: 'Hỗ trợ sinh hoạt và chăm sóc thông thường theo kế hoạch đã thống nhất.',
        base_price: 120000.00,
        price_unit: 'giờ',
        duration_estimate: 'Tối thiểu 2 giờ',
        category: 'care',
        min_duration_hours: 2,
        staff_wage_rate: 90000.00,
        shift_price: 450000.00,
        daily_price: 860000.00,
        monthly_price: 20500000.00,
        staff_shift_wage: 330000.00,
        staff_daily_wage: 630000.00,
        staff_monthly_wage: 15000000.00,
        icon: '🩺'
      }
    ];

    for (const s of careServicesToSeed) {
      const [existing] = await connection.query('SELECT id, shift_price FROM services WHERE slug = ? LIMIT 1', [s.slug]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO services (id, name, slug, description, short_description, base_price, price_unit, duration_estimate, category, min_duration_hours, staff_wage_rate, shift_price, daily_price, monthly_price, staff_shift_wage, staff_daily_wage, staff_monthly_wage, icon, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [s.id, s.name, s.slug, s.description, s.short_description, s.base_price, s.price_unit, s.duration_estimate, s.category, s.min_duration_hours, s.staff_wage_rate, s.shift_price, s.daily_price, s.monthly_price, s.staff_shift_wage, s.staff_daily_wage, s.staff_monthly_wage, s.icon]
        );
      } else {
        // Cập nhật cấu hình gói giá chăm sóc nếu chưa có giá buổi/ngày/tháng
        await connection.query(
          `UPDATE services SET
            shift_price = COALESCE(shift_price, ?),
            daily_price = COALESCE(daily_price, ?),
            monthly_price = COALESCE(monthly_price, ?),
            staff_shift_wage = COALESCE(staff_shift_wage, ?),
            staff_daily_wage = COALESCE(staff_daily_wage, ?),
            staff_monthly_wage = COALESCE(staff_monthly_wage, ?)
           WHERE id = ?`,
          [s.shift_price, s.daily_price, s.monthly_price, s.staff_shift_wage, s.staff_daily_wage, s.staff_monthly_wage, s.id]
        );
      }
    }

    // Migration bổ sung các cột quản lý tiền công & thời lượng & thông tin chăm sóc cho bảng bookings
    const [bookingCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'`
    );
    const existingBCols = new Set(bookingCols.map(c => c.COLUMN_NAME));
    if (!existingBCols.has('duration_hours')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN duration_hours DECIMAL(4, 1) NULL DEFAULT NULL COMMENT 'Thời lượng dịch vụ theo giờ'");
    }
    if (!existingBCols.has('staff_wage')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN staff_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền công chi trả cho nhân viên'");
    }
    if (!existingBCols.has('commission_rate')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.2000 COMMENT 'Tỷ lệ chiết khấu CleanNova'");
    }
    if (!existingBCols.has('platform_commission')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN platform_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Khoản chiết khấu CleanNova'");
    }
    if (!existingBCols.has('staff_net_wage')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN staff_net_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tiền công thực nhận của nhân viên'");
    }
    if (!existingBCols.has('wage_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN wage_status ENUM('pending', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT 'Trạng thái tiền công'");
    }
    if (!existingBCols.has('wage_settled_at')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN wage_settled_at DATETIME NULL DEFAULT NULL COMMENT 'Thời điểm đối soát chi trả tiền công'");
    }
    if (!existingBCols.has('wage_settled_by')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN wage_settled_by INT NULL DEFAULT NULL COMMENT 'Admin ID đã duyệt chi trả'");
    }
    if (!existingBCols.has('package_type')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN package_type ENUM('hourly', 'shift', 'daily', 'monthly') NOT NULL DEFAULT 'hourly' COMMENT 'Gói tính giá dịch vụ chăm sóc'");
    }
    if (!existingBCols.has('shift_choice')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN shift_choice VARCHAR(50) NULL DEFAULT NULL COMMENT 'Ca đăng ký: morning, afternoon, evening'");
    }
    if (!existingBCols.has('recipient_name')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN recipient_name VARCHAR(120) NULL DEFAULT NULL COMMENT 'Tên người được chăm sóc'");
    }
    if (!existingBCols.has('recipient_age')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN recipient_age VARCHAR(50) NULL DEFAULT NULL COMMENT 'Độ tuổi / năm sinh'");
    }
    if (!existingBCols.has('recipient_gender')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN recipient_gender VARCHAR(20) NULL DEFAULT NULL COMMENT 'Giới tính người được chăm sóc'");
    }
    if (!existingBCols.has('care_scope_notes')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN care_scope_notes TEXT NULL DEFAULT NULL COMMENT 'Ghi chú phạm vi chăm sóc & thói quen'");
    }
    if (!existingBCols.has('pricing_type')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN pricing_type ENUM('m2', 'package', 'labor_daily') NOT NULL DEFAULT 'm2' COMMENT 'Hình thức tính giá: theo m2, trọn gói, nhân công theo ngày'");
    }
    if (!existingBCols.has('building_type')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN building_type VARCHAR(50) NULL DEFAULT NULL COMMENT 'Loại công trình: apartment, townhouse, villa, office, factory, other'");
    }
    if (!existingBCols.has('area_m2')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN area_m2 DECIMAL(10, 2) NULL DEFAULT NULL COMMENT 'Diện tích sàn cần vệ sinh (m2)'");
    }
    if (!existingBCols.has('floors')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN floors INT NULL DEFAULT 1 COMMENT 'Số tầng công trình'");
    }
    if (!existingBCols.has('construction_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN construction_status VARCHAR(50) NULL DEFAULT NULL COMMENT 'Tình trạng công trình: newly_completed, rough_cleaned, heavy_dust'");
    }
    if (!existingBCols.has('dirt_severity')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN dirt_severity VARCHAR(50) NULL DEFAULT NULL COMMENT 'Mức độ bám bẩn: light, medium, heavy'");
    }
    if (!existingBCols.has('glass_cleaning')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN glass_cleaning VARCHAR(50) NULL DEFAULT NULL COMMENT 'Vệ sinh kính: none, standard, extensive'");
    }
    if (!existingBCols.has('stubborn_stains')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN stubborn_stains VARCHAR(50) NULL DEFAULT NULL COMMENT 'Vết bẩn khó: none, moderate, severe'");
    }
    if (!existingBCols.has('furniture_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN furniture_status VARCHAR(50) NULL DEFAULT NULL COMMENT 'Tình trạng nội thất: empty, sparse, furnished'");
    }
    if (!existingBCols.has('worker_count')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN worker_count INT NULL DEFAULT NULL COMMENT 'Số lượng nhân công'");
    }
    if (!existingBCols.has('work_days')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN work_days INT NULL DEFAULT NULL COMMENT 'Số ngày thuê'");
    }
    if (!existingBCols.has('quote_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN quote_status ENUM('estimated', 'pending_survey', 'confirmed') NOT NULL DEFAULT 'estimated' COMMENT 'Trạng thái báo giá'");
    }
    if (!existingBCols.has('quote_min_price')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN quote_min_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Khoảng giá tham khảo tối thiểu'");
    }
    if (!existingBCols.has('quote_max_price')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN quote_max_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Khoảng giá tham khảo tối đa'");
    }
    if (!existingBCols.has('quote_notes')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN quote_notes TEXT NULL DEFAULT NULL COMMENT 'Ghi chú báo giá chính thức của admin'");
    }
    if (!existingBCols.has('construction_notes')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN construction_notes TEXT NULL DEFAULT NULL COMMENT 'Ghi chú chi tiết công trình'");
    }
    if (!existingBCols.has('confirmed_price')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN confirmed_price DECIMAL(12, 2) NULL DEFAULT NULL COMMENT 'Giá chính thức chốt bởi admin'");
    }

    // Tự động tạo bảng post_construction_configs nếu chưa có
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_construction_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'Khóa cấu hình',
        config_value JSON NOT NULL COMMENT 'Giá trị cấu hình dạng JSON',
        updated_by INT DEFAULT NULL COMMENT 'Admin ID đã cập nhật',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_post_const_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Khởi tạo các mức cấu hình mặc định cho dịch vụ vệ sinh sau xây dựng
    const [existingConfigs] = await connection.query('SELECT config_key FROM post_construction_configs');
    const existingKeys = new Set(existingConfigs.map(c => c.config_key));

    if (!existingKeys.has('m2_rates')) {
      await connection.query(
        'INSERT INTO post_construction_configs (config_key, config_value) VALUES (?, ?)',
        ['m2_rates', JSON.stringify({
          factory: { name: 'Công trình lớn, mặt bằng thoáng, nhà xưởng', min: 7000, max: 12000, light: 8000, medium: 10000, heavy: 12000 },
          standard: { name: 'Nhà phố, căn hộ chung cư thông thường', min: 12000, max: 20000, light: 13000, medium: 15000, heavy: 18000 },
          luxury: { name: 'Biệt thự, công trình phức tạp, vết bẩn nặng', min: 20000, max: 35000, light: 22000, medium: 26000, heavy: 32000 }
        })]
      );
    }
    if (!existingKeys.has('package_rates')) {
      await connection.query(
        'INSERT INTO post_construction_configs (config_key, config_value) VALUES (?, ?)',
        ['package_rates', JSON.stringify({
          apartment: { name: 'Căn hộ chung cư 60–100 m²', min_area: 60, max_area: 100, min_price: 1500000, max_price: 3000000, standard_price: 2200000 },
          townhouse: { name: 'Nhà phố 2–4 tầng (150–300 m²)', min_area: 150, max_area: 300, min_floors: 2, max_floors: 4, min_price: 3000000, max_price: 6000000, standard_price: 4500000 },
          luxury: { name: 'Biệt thự hoặc căn hộ cao cấp trên 300 m²', min_area: 300, min_price: 6000000, max_price: 12000000, standard_price: 8500000 }
        })]
      );
    }
    if (!existingKeys.has('labor_daily_rates')) {
      await connection.query(
        'INSERT INTO post_construction_configs (config_key, config_value) VALUES (?, ?)',
        ['labor_daily_rates', JSON.stringify({
          min_price: 400000,
          max_price: 500000,
          standard_price: 450000,
          staff_wage_daily: 320000,
          includes_equipment: true,
          description: 'Mức giá tham khảo bao gồm máy móc và hóa chất cơ bản theo chính sách CleanNova'
        })]
      );
    }
    if (!existingKeys.has('surcharges')) {
      await connection.query(
        'INSERT INTO post_construction_configs (config_key, config_value) VALUES (?, ?)',
        ['surcharges', JSON.stringify({
          severe_stains: { rate: 0.10, label: 'Vết sơn, xi măng, keo bám nặng (+10%)' },
          extensive_glass: { rate: 0.10, label: 'Vệ sinh nhiều kính / vách kính lớn (+10%)' },
          furnished: { rate: 0.10, label: 'Công trình nhiều đồ đạc cần bảo quản (+10%)' }
        })]
      );
    }

    // Tự động tạo bảng staff_payout_logs nếu chưa có
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff_payout_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        staff_id INT NOT NULL,
        admin_id INT NOT NULL,
        gross_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.2000,
        platform_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        net_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(12, 2) NOT NULL,
        action ENUM('approve', 'pay', 'adjust') NOT NULL DEFAULT 'pay',
        note TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payout_booking (booking_id),
        INDEX idx_payout_staff (staff_id),
        CONSTRAINT fk_payout_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        CONSTRAINT fk_payout_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_payout_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Kiểm tra và bổ sung cột cho staff_payout_logs nếu bảng đã tồn tại từ trước
    const [payoutCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff_payout_logs'`
    );
    const existingPayoutCols = new Set(payoutCols.map(c => c.COLUMN_NAME));
    if (!existingPayoutCols.has('gross_wage')) {
      await connection.query("ALTER TABLE staff_payout_logs ADD COLUMN gross_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER admin_id");
    }
    if (!existingPayoutCols.has('commission_rate')) {
      await connection.query("ALTER TABLE staff_payout_logs ADD COLUMN commission_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.2000 AFTER gross_wage");
    }
    if (!existingPayoutCols.has('platform_commission')) {
      await connection.query("ALTER TABLE staff_payout_logs ADD COLUMN platform_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER commission_rate");
    }
    if (!existingPayoutCols.has('net_wage')) {
      await connection.query("ALTER TABLE staff_payout_logs ADD COLUMN net_wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER platform_commission");
    }

    // ------------------------------------------------------------
    // Migration: Mở rộng Phương thức thanh toán Wallet & Addons cho bảng bookings
    // ------------------------------------------------------------
    await connection.query(`
      ALTER TABLE bookings
      MODIFY payment_method ENUM('cash', 'bank_transfer', 'momo', 'vnpay', 'wallet') NOT NULL DEFAULT 'cash'
    `);

    const [bAddonCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'`
    );
    const existingBAddonCols = new Set(bAddonCols.map(c => c.COLUMN_NAME));
    if (!existingBAddonCols.has('addons')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN addons JSON NULL DEFAULT NULL COMMENT 'Danh sách tiện ích bổ sung'");
    }
    if (!existingBAddonCols.has('addon_amount')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN addon_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền phụ phí tiện ích'");
    }

    // ------------------------------------------------------------
    // Migration: Hệ thống Ví điện tử CleanNova (Wallets & Immutable Ledger)
    // ------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) NOT NULL DEFAULT 'VND',
        status ENUM('active', 'locked', 'suspended') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet_user (user_id),
        CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_code VARCHAR(50) NOT NULL UNIQUE,
        wallet_id INT NOT NULL,
        user_id INT NOT NULL,
        type ENUM('topup', 'payment', 'refund', 'adjustment', 'wage', 'withdrawal') NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance_before DECIMAL(15, 2) NOT NULL,
        balance_after DECIMAL(15, 2) NOT NULL,
        status ENUM('pending', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'completed',
        description VARCHAR(255) DEFAULT NULL,
        reference_type VARCHAR(50) DEFAULT NULL,
        reference_id VARCHAR(100) DEFAULT NULL,
        idempotency_key VARCHAR(100) UNIQUE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_txn_wallet (wallet_id),
        INDEX idx_wallet_txn_user (user_id),
        INDEX idx_wallet_txn_code (transaction_code),
        INDEX idx_wallet_txn_ref (reference_type, reference_id),
        CONSTRAINT fk_wallet_txn_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
        CONSTRAINT fk_wallet_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Đồng bộ kiểu dữ liệu type cho wallet_transactions nếu bảng đã có từ trước
    await connection.query(`
      ALTER TABLE wallet_transactions 
      MODIFY COLUMN type ENUM('topup', 'payment', 'refund', 'adjustment', 'wage', 'commission_deduction', 'transfer', 'withdrawal') NOT NULL
    `);

    // ------------------------------------------------------------
    // Migration: Hệ thống Hai Ví Nhân Viên CleanNova (Credit Wallet & Earnings Wallet)
    // ------------------------------------------------------------
    const [wCols] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallets'
    `);
    const existingWCols = new Set(wCols.map(c => c.COLUMN_NAME));
    if (!existingWCols.has('wallet_type')) {
      await connection.query(`
        ALTER TABLE wallets 
        ADD COLUMN wallet_type ENUM('customer', 'credit', 'earnings') NOT NULL DEFAULT 'customer' AFTER user_id
      `);
    }

    const [wIndices] = await connection.query(`SHOW INDEX FROM wallets`);
    const oldUserUnique = wIndices.find(idx => idx.Key_name === 'user_id' && idx.Non_unique === 0);
    if (oldUserUnique) {
      await connection.query(`ALTER TABLE wallets DROP INDEX user_id`);
    }
    const hasCompositeWUnique = wIndices.some(idx => idx.Key_name === 'uq_user_wallet_type');
    if (!hasCompositeWUnique) {
      await connection.query(`
        ALTER TABLE wallets ADD UNIQUE KEY uq_user_wallet_type (user_id, wallet_type)
      `);
    }

    // Backfill: Đối với nhân viên (role = staff):
    // 1. Nếu đã có ví 'earnings' rồi, dọn dẹp các ví 'customer' rỗng phát sinh
    await connection.query(`
      DELETE w FROM wallets w
      JOIN users u ON w.user_id = u.id
      WHERE u.role = 'staff' AND w.wallet_type = 'customer'
      AND EXISTS (
        SELECT 1 FROM (SELECT user_id FROM wallets WHERE wallet_type = 'earnings') ew 
        WHERE ew.user_id = w.user_id
      )
    `);

    // 2. Nếu chưa có ví 'earnings', chuyển đổi ví 'customer' cũ thành 'earnings'
    await connection.query(`
      UPDATE wallets w
      JOIN users u ON w.user_id = u.id
      SET w.wallet_type = 'earnings'
      WHERE u.role = 'staff' AND w.wallet_type = 'customer'
    `);

    // Đảm bảo mọi nhân viên đều có đủ 2 ví: Ví Tín Dụng ('credit') và Ví Thu Nhập ('earnings')
    const [staffUsersList] = await connection.query(`SELECT id FROM users WHERE role = 'staff'`);
    for (const st of staffUsersList) {
      await connection.query(`
        INSERT IGNORE INTO wallets (user_id, wallet_type, balance, currency, status)
        VALUES (?, 'credit', 0.00, 'VND', 'active')
      `, [st.id]);
      await connection.query(`
        INSERT IGNORE INTO wallets (user_id, wallet_type, balance, currency, status)
        VALUES (?, 'earnings', 0.00, 'VND', 'active')
      `, [st.id]);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        wallet_id INT NOT NULL,
        entry_type ENUM('credit', 'debit') NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        running_balance DECIMAL(15, 2) NOT NULL,
        notes VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ledger_wallet (wallet_id),
        INDEX idx_ledger_transaction (transaction_id),
        CONSTRAINT fk_ledger_txn FOREIGN KEY (transaction_id) REFERENCES wallet_transactions(id) ON DELETE CASCADE,
        CONSTRAINT fk_ledger_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ------------------------------------------------------------
    // Migration: Hệ thống Voucher & Khuyến mãi động (Vouchers Engine)
    // ------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(12, 2) NOT NULL,
        max_discount_amount DECIMAL(12, 2) NULL DEFAULT NULL,
        min_order_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        applicable_services JSON NULL DEFAULT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        usage_limit INT NOT NULL DEFAULT 100,
        used_count INT NOT NULL DEFAULT 0,
        per_user_limit INT NOT NULL DEFAULT 1,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        description VARCHAR(255) NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_voucher_code (code),
        INDEX idx_voucher_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS voucher_usages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id INT NOT NULL,
        user_id INT NOT NULL,
        booking_id INT NOT NULL,
        discount_applied DECIMAL(12, 2) NOT NULL,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_voucher_usage_user (user_id),
        INDEX idx_voucher_usage_booking (booking_id),
        CONSTRAINT fk_voucher_usage_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
        CONSTRAINT fk_voucher_usage_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_voucher_usage_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Khởi tạo các mã voucher mặc định nếu chưa có
    const [existingVouchers] = await connection.query('SELECT code FROM vouchers');
    const existingVoucherCodes = new Set(existingVouchers.map(v => v.code));
    if (!existingVoucherCodes.has('DABCLEAN20')) {
      await connection.query(`
        INSERT INTO vouchers (code, discount_type, discount_value, max_discount_amount, min_order_amount, applicable_services, start_date, end_date, usage_limit, used_count, per_user_limit, is_active, description)
        VALUES ('DABCLEAN20', 'percentage', 20.00, 500000.00, 0.00, NULL, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1000, 0, 1, 1, 'Giảm 20% tối đa 500.000đ cho đơn đặt dịch vụ 1 lần')
      `);
    }
    if (!existingVoucherCodes.has('CLEANOVA20')) {
      await connection.query(`
        INSERT INTO vouchers (code, discount_type, discount_value, max_discount_amount, min_order_amount, applicable_services, start_date, end_date, usage_limit, used_count, per_user_limit, is_active, description)
        VALUES ('CLEANOVA20', 'percentage', 20.00, 500000.00, 0.00, NULL, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 1000, 0, 1, 1, 'Giảm 20% tối đa 500.000đ cho đơn đặt dịch vụ 1 lần')
      `);
    }
    if (!existingVoucherCodes.has('CLEAN50K')) {
      await connection.query(`
        INSERT INTO vouchers (code, discount_type, discount_value, max_discount_amount, min_order_amount, applicable_services, start_date, end_date, usage_limit, used_count, per_user_limit, is_active, description)
        VALUES ('CLEAN50K', 'fixed', 50000.00, NULL, 200000.00, NULL, '2026-01-01 00:00:00', '2027-12-31 23:59:59', 500, 0, 2, 1, 'Giảm 50.000đ trực tiếp cho đơn từ 200.000đ trở lên')
      `);
    }

    // Tự động khởi tạo ví cho toàn bộ khách hàng hiện có nếu chưa có ví
    await connection.query(`
      INSERT IGNORE INTO wallets (user_id, wallet_type, balance, currency, status)
      SELECT id, 'customer', 0.00, 'VND', 'active' FROM users WHERE role IN ('customer', 'user')
    `);

    // Khởi tạo số dư trải nghiệm 1.000.000 VND cho tài khoản demo (user_id = 2) nếu ví đang có số dư 0
    const [demoWallet] = await connection.query('SELECT id, balance FROM wallets WHERE user_id = 2 LIMIT 1');
    if (demoWallet && demoWallet[0] && parseFloat(demoWallet[0].balance) === 0) {
      const demoWalletId = demoWallet[0].id;
      const initialAmt = 1000000.00;
      const txnCode = 'WTX-DEMO-INIT-001';
      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [initialAmt, demoWalletId]);
      await connection.query(`
        INSERT IGNORE INTO wallet_transactions 
        (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id)
        VALUES (?, ?, 2, 'topup', ?, 0.00, ?, 'completed', 'Số dư trải nghiệm Ví CleanNova sandbox ban đầu', 'system_grant', 'demo_init')
      `, [txnCode, demoWalletId, initialAmt, initialAmt]);
      const [insertedTxn] = await connection.query('SELECT id FROM wallet_transactions WHERE transaction_code = ? LIMIT 1', [txnCode]);
      if (insertedTxn && insertedTxn[0]) {
        await connection.query(`
          INSERT INTO wallet_ledger_entries (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
          VALUES (?, ?, 'credit', ?, ?, 'Nạp tiền trải nghiệm ban đầu')
        `, [insertedTxn[0].id, demoWalletId, initialAmt, initialAmt]);
      }
    }

    // ------------------------------------------------------------
    // Migration: Bảng cấu hình chính sách hệ thống CleanNova (system_configs)
    // ------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS system_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE COMMENT 'Khóa cấu hình hệ thống',
        config_value JSON NOT NULL COMMENT 'Giá trị cấu hình dạng JSON',
        description VARCHAR(255) NULL COMMENT 'Mô tả mục đích cấu hình',
        updated_by INT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_system_configs_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [existingSysConfigs] = await connection.query('SELECT config_key FROM system_configs');
    const sysKeys = new Set(existingSysConfigs.map(c => c.config_key));
    if (!sysKeys.has('staff_commission_rate')) {
      await connection.query(
        `INSERT INTO system_configs (config_key, config_value, description)
         VALUES (?, ?, ?)`,
        [
          'staff_commission_rate',
          JSON.stringify({ rate: 0.20, description: 'Tỷ lệ chiết khấu CleanNova mặc định khấu trừ từ tiền công nhân viên (20%)' }),
          'Tỷ lệ chiết khấu CleanNova khấu trừ từ tiền công nhân viên'
        ]
      );
    }

    // Đồng bộ dữ liệu lịch sử cho các đơn hàng cũ đã có staff_wage: tính platform_commission & staff_net_wage
    await connection.query(`
      UPDATE bookings 
      SET platform_commission = ROUND(staff_wage * COALESCE(NULLIF(commission_rate, 0), 0.2000)),
          staff_net_wage = staff_wage - ROUND(staff_wage * COALESCE(NULLIF(commission_rate, 0), 0.2000)),
          commission_rate = COALESCE(NULLIF(commission_rate, 0), 0.2000)
      WHERE staff_wage > 0 AND (staff_net_wage = 0 OR staff_net_wage IS NULL)
    `);

    // ------------------------------------------------------------
    // Migration: Bảng staff_commission_payments & Cột đối soát chiết khấu nhận ca
    // ------------------------------------------------------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS staff_commission_payments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        payment_code VARCHAR(64) NOT NULL UNIQUE,
        booking_id INT NOT NULL,
        staff_id INT NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        payment_method ENUM('wallet', 'bank_transfer') NOT NULL,
        status ENUM('pending', 'completed', 'failed', 'refunded', 'pending_review', 'cancelled') NOT NULL DEFAULT 'pending',
        reference_code VARCHAR(64) NOT NULL UNIQUE,
        bank_name VARCHAR(100) DEFAULT 'MB Bank (Ngân hàng Quân Đội)',
        bank_account_number VARCHAR(50) DEFAULT '0912345678',
        bank_account_name VARCHAR(100) DEFAULT 'CONG TY DABCLEAN VIET NAM',
        paid_at DATETIME DEFAULT NULL,
        verified_by INT DEFAULT NULL,
        bank_transaction_code VARCHAR(100) DEFAULT NULL,
        refund_status ENUM('none', 'refunded', 'pending_review', 'rejected') NOT NULL DEFAULT 'none',
        refund_reason TEXT DEFAULT NULL,
        refunded_at DATETIME DEFAULT NULL,
        refunded_by INT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        idempotency_key VARCHAR(100) DEFAULT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comm_booking (booking_id),
        INDEX idx_comm_staff (staff_id),
        INDEX idx_comm_status (status),
        INDEX idx_comm_ref (reference_code),
        CONSTRAINT fk_comm_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        CONSTRAINT fk_comm_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_comm_admin FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_comm_refund_admin FOREIGN KEY (refunded_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [bCommCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'`
    );
    const existingBCommCols = new Set(bCommCols.map(c => c.COLUMN_NAME));
    if (!existingBCommCols.has('commission_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_status ENUM('unpaid', 'paid', 'refunded', 'pending_review') NOT NULL DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán chiết khấu'");
    }
    if (!existingBCommCols.has('commission_payment_id')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_payment_id BIGINT NULL DEFAULT NULL COMMENT 'ID bản ghi thanh toán chiết khấu'");
    }
    if (!existingBCommCols.has('commission_paid_at')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_paid_at DATETIME NULL DEFAULT NULL COMMENT 'Thời điểm thanh toán chiết khấu'");
    }
    if (!existingBCommCols.has('commission_payment_method')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_payment_method VARCHAR(50) NULL DEFAULT NULL COMMENT 'Hình thức trả chiết khấu: wallet, bank_transfer'");
    }
    if (!existingBCommCols.has('commission_refund_status')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_refund_status ENUM('none', 'refunded', 'pending_review', 'rejected') NOT NULL DEFAULT 'none' COMMENT 'Trạng thái hoàn tiền chiết khấu'");
    }
    if (!existingBCommCols.has('commission_refund_reason')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_refund_reason TEXT NULL DEFAULT NULL COMMENT 'Lý do hoàn chiết khấu'");
    }
    if (!existingBCommCols.has('commission_refunded_at')) {
      await connection.query("ALTER TABLE bookings ADD COLUMN commission_refunded_at DATETIME NULL DEFAULT NULL COMMENT 'Thời điểm hoàn chiết khấu'");
    }

    console.log(`[Database] Đã kết nối thành công tới MySQL Server (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);
    isConnectedToMySQL = true;
  } catch (err) {
    console.error('====================================================');
    console.error(`[DATABASE ERROR CRITICAL] Không thể kết nối tới MySQL (${err.code || err.message})!`);
    console.error('Migration error detail:', err);
    console.error(`- Host: ${dbConfig.host}:${dbConfig.port} | Database: ${dbConfig.database} | User: ${dbConfig.user}`);
    
    // Trong môi trường Production, không được phép âm thầm chuyển sang in-memory, từ chối khởi động
    if (process.env.NODE_ENV === 'production') {
      console.error('[DATABASE ERROR FATAL] Trong môi trường Production, kết nối MySQL là BẮT BUỘC.');
      console.error('Ứng dụng từ chối khởi động để tránh rò rỉ dữ liệu hoặc mất đồng bộ.');
      console.error('====================================================');
      process.exit(1);
    }

    console.error('CẢNH BÁO BẢO VỆ DỮ LIỆU: Ứng dụng đang tạm thời chuyển sang cơ chế In-Memory Database cho môi trường Dev/Test.');
    console.error('LƯU Ý: Mọi thay đổi dữ liệu (tài khoản mới, đơn đặt) sẽ BỊ MẤT khi restart máy chủ nếu không sửa kết nối MySQL!');
    console.error('====================================================');
    isConnectedToMySQL = false;
  } finally {
    if (connection) connection.release();
  }
}

// Hàm thực thi truy vấn an toàn (Parameterized Query)
async function query(sql, params = []) {
  if (isConnectedToMySQL && pool) {
    try {
      const [results] = await pool.execute(sql, params);
      return results;
    } catch (err) {
      console.error('[Database Error]', err.message);
      throw err;
    }
  }

  // Nếu chưa có MySQL, xử lý an toàn qua In-Memory data
  return queryInMemory(sql, params);
}

// Xử lý truy vấn mô phỏng khi chưa kết nối MySQL
function queryInMemory(sql, params = []) {
  const normalizedSql = sql.trim().toLowerCase();

  if (normalizedSql.includes('from booking_notifications')) {
    const userId = parseInt(params[0], 10);
    let notifications = inMemoryData.bookingNotifications
      .filter(notification => notification.user_id === userId);
    if (normalizedSql.includes('where user_id = ? and id = ?')) {
      const notificationId = parseInt(params[1], 10);
      notifications = notifications.filter(notification => notification.id === notificationId);
    }
    return notifications
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50)
      .map(notification => ({ ...notification }));
  }

  if (normalizedSql.startsWith('insert ignore into booking_notifications')) {
    const [userId, bookingId, type, title, message, data] = params;
    const duplicate = inMemoryData.bookingNotifications.some(notification =>
      notification.booking_id === parseInt(bookingId, 10) &&
      notification.notification_type === type
    );
    if (duplicate) return { insertId: 0, affectedRows: 0 };
    const id = inMemoryData.bookingNotifications.length
      ? Math.max(...inMemoryData.bookingNotifications.map(notification => notification.id)) + 1
      : 1;
    inMemoryData.bookingNotifications.push({
      id,
      user_id: parseInt(userId, 10),
      booking_id: parseInt(bookingId, 10),
      notification_type: type,
      title,
      message,
      data: data ? JSON.parse(data) : null,
      is_read: 0,
      created_at: new Date()
    });
    return { insertId: id, affectedRows: 1 };
  }

  if (normalizedSql.startsWith('update booking_notifications')) {
    const [userId, notificationId] = params;
    const notification = inMemoryData.bookingNotifications.find(item =>
      item.user_id === parseInt(userId, 10) && item.id === parseInt(notificationId, 10)
    );
    if (!notification) return { affectedRows: 0 };
    notification.is_read = 1;
    return { affectedRows: 1 };
  }

  if (normalizedSql.includes('from booking_job_photos')) {
    if (normalizedSql.includes('where image_url = ?')) {
      const photo = inMemoryData.jobPhotos.find(item => item.image_url === params[0]);
      return photo ? [{ ...photo }] : [];
    }
    const bookingId = parseInt(params[0], 10);
    return inMemoryData.jobPhotos.filter(photo => photo.booking_id === bookingId).map(photo => ({ ...photo }));
  }

  if (normalizedSql.startsWith('insert into booking_job_photos')) {
    const [booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude] = params;
    const duplicate = inMemoryData.jobPhotos.some(photo =>
      photo.booking_id === parseInt(booking_id, 10) &&
      photo.area_name === area_name &&
      photo.angle_id === angle_id &&
      photo.stage === stage
    );
    if (duplicate) return { insertId: 0, affectedRows: 0 };

    const id = inMemoryData.jobPhotos.length
      ? Math.max(...inMemoryData.jobPhotos.map(photo => photo.id)) + 1
      : 1;
    inMemoryData.jobPhotos.push({
      id,
      booking_id: parseInt(booking_id, 10),
      area_name,
      angle_id,
      stage,
      image_url,
      captured_at,
      latitude: Number(latitude),
      longitude: Number(longitude),
      created_at: new Date()
    });
    return { insertId: id, affectedRows: 1 };
  }

  // 0. Thống kê & Đếm (COUNT)
  if (normalizedSql.includes('count(')) {
    // Đếm số admin đang hoạt động (để ngăn xóa admin cuối cùng)
    if (normalizedSql.includes("role = 'admin'") && normalizedSql.includes("status = 'active'")) {
      const activeAdminCount = inMemoryData.users.filter(u => u.role === 'admin' && u.status === 'active').length;
      return [{ count: activeAdminCount, total: activeAdminCount }];
    }

    // Đếm số đơn đặt của một người dùng (kiểm tra trước khi xóa tài khoản)
    if (normalizedSql.includes('from bookings') && (normalizedSql.includes('user_id =') || normalizedSql.includes('b.user_id ='))) {
      const userId = parseInt(params[0], 10);
      const bookingCount = inMemoryData.bookings.filter(b => b.user_id === userId).length;
      return [{ count: bookingCount, total: bookingCount }];
    }

    // Đếm số hồ sơ đối tác
    if (normalizedSql.includes('from partner_applications')) {
      if (normalizedSql.includes("status = 'pending'") || (params && params[0] === 'pending')) {
        const pendingCount = (inMemoryData.partner_applications || []).filter(p => p.status === 'pending').length;
        return [{ count: pendingCount, total: pendingCount }];
      }
      const totalPartners = (inMemoryData.partner_applications || []).length;
      return [{ count: totalPartners, total: totalPartners }];
    }

    // Thống kê Dashboard tổng quan
    const totalUsers = inMemoryData.users.filter(u => u.role === 'customer' || u.role === 'user').length;
    const totalStaff = inMemoryData.users.filter(u => u.role === 'staff').length;
    const activeStaff = inMemoryData.users.filter(u => u.role === 'staff' && u.status === 'active').length;
    const totalServices = inMemoryData.services.length;
    const totalBookings = inMemoryData.bookings.length;
    const pendingBookings = inMemoryData.bookings.filter(b => b.status === 'pending').length;
    const pendingPartners = (inMemoryData.partner_applications || []).filter(p => p.status === 'pending').length;
    const totalRevenue = inMemoryData.bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_price || 0), 0);

    return [{
      total_users: totalUsers,
      total_staff: totalStaff,
      active_staff: activeStaff,
      total_services: totalServices,
      total_bookings: totalBookings,
      pending_bookings: pendingBookings,
      pending_partners: pendingPartners,
      total_revenue: totalRevenue,
      totalUsers: totalUsers,
      totalStaff: totalStaff,
      activeStaff: activeStaff,
      activeServices: totalServices,
      totalBookings: totalBookings,
      totalRevenue: totalRevenue
    }];
  }

  // 1. SELECT users BY email
  if (normalizedSql.includes('from users') && normalizedSql.includes('where email =')) {
    const email = params[0];
    const user = inMemoryData.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    return user ? [{ ...user }] : [];
  }

  // 2. SELECT users BY id
  if (normalizedSql.includes('from users') && normalizedSql.includes('where id =')) {
    const id = parseInt(params[0], 10);
    const user = inMemoryData.users.find(u => u.id === id);
    if (!user) return [];
    // Khớp hành vi MySQL: không trả về password nếu câu query không yêu cầu
    if (!normalizedSql.includes('password')) {
      const { password, ...safeUser } = user;
      return [{ ...safeUser }];
    }
    return [{ ...user }];
  }

  // 2a. SELECT staff list
  if (normalizedSql.includes('from users') && normalizedSql.includes("where role = 'staff'")) {
    return inMemoryData.users
      .filter(u => u.role === 'staff')
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        address: u.address,
        role: u.role,
        status: u.status || 'active',
        created_at: u.created_at
      }));
  }

  // 2b. SELECT all users (Admin)
  if (normalizedSql.includes('from users')) {
    return inMemoryData.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role,
      status: u.status || 'active',
      created_at: u.created_at
    }));
  }

  // 3. INSERT INTO users
  if (normalizedSql.startsWith('insert into users')) {
    const [name, email, password, phone, address, role, status] = params;
    const newId = inMemoryData.users.length > 0 ? Math.max(...inMemoryData.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      name: name ? name.trim() : '',
      email: email ? email.trim().toLowerCase() : '',
      password,
      phone: phone || '',
      address: address || '',
      role: role || 'customer',
      status: status || 'active',
      created_at: new Date()
    };
    inMemoryData.users.push(newUser);
    return { insertId: newId, affectedRows: 1 };
  }

  // 4. UPDATE users (Status / Role / Info / Password)
  if (normalizedSql.startsWith('update users')) {
    const id = parseInt(params[params.length - 1], 10);
    const user = inMemoryData.users.find(u => u.id === id);
    if (user) {
      if (normalizedSql.includes('status = ?')) {
        user.status = params[0];
      }
      if (normalizedSql.includes('role = ?')) {
        user.role = params[0];
      }
      if (normalizedSql.includes('password = ?')) {
        user.password = params[0];
      }
      if (normalizedSql.includes('name = ?') && normalizedSql.includes('phone = ?')) {
        user.name = params[0];
        user.phone = params[1];
        user.address = params[2];
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 5. DELETE users (Hard delete sau khi qua các tầng kiểm tra an toàn)
  if (normalizedSql.startsWith('delete from users')) {
    const id = parseInt(params[0], 10);
    const idx = inMemoryData.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      inMemoryData.users.splice(idx, 1);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 6. SELECT services
  if (normalizedSql.includes('from services')) {
    if (normalizedSql.includes('where id =')) {
      const id = parseInt(params[0], 10);
      const s = inMemoryData.services.find(srv => srv.id === id);
      return s ? [s] : [];
    }
    if (normalizedSql.includes('where slug =')) {
      const slug = params[0];
      const s = inMemoryData.services.find(srv => srv.slug === slug);
      return s ? [s] : [];
    }
    return [...inMemoryData.services];
  }

  // 6. INSERT / UPDATE / DELETE services (Admin)
  if (normalizedSql.startsWith('insert into services')) {
    const [name, slug, description, short_description, base_price, price_unit, duration_estimate, icon] = params;
    const newId = inMemoryData.services.length > 0 ? Math.max(...inMemoryData.services.map(s => s.id)) + 1 : 1;
    const newService = {
      id: newId,
      name,
      slug,
      description,
      short_description,
      base_price: parseFloat(base_price),
      price_unit: price_unit || 'lần',
      duration_estimate: duration_estimate || '2-4 giờ',
      icon: icon || '🧹',
      is_active: 1
    };
    inMemoryData.services.push(newService);
    return { insertId: newId, affectedRows: 1 };
  }

  if (normalizedSql.startsWith('update services')) {
    const id = parseInt(params[params.length - 1], 10);
    const srv = inMemoryData.services.find(s => s.id === id);
    if (srv) {
      if (params.length === 8) {
        srv.name = params[0];
        srv.description = params[1];
        srv.short_description = params[2];
        srv.base_price = parseFloat(params[3]);
        srv.price_unit = params[4];
        srv.duration_estimate = params[5];
        srv.icon = params[6];
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  if (normalizedSql.startsWith('delete from services')) {
    const id = parseInt(params[0], 10);
    const idx = inMemoryData.services.findIndex(s => s.id === id);
    if (idx !== -1) {
      inMemoryData.services.splice(idx, 1);
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // 7. SELECT bookings
  if (normalizedSql.includes('from bookings')) {
    // 7a. Lọc đơn theo nhân viên được phân công (Staff Portal)
    if (normalizedSql.includes('where b.staff_id =') || normalizedSql.includes('where staff_id =')) {
      const staffId = parseInt(params[0], 10);
      return inMemoryData.bookings
        .filter(b => b.staff_id === staffId)
        .map(b => {
          const user = inMemoryData.users.find(u => u.id === b.user_id);
          return {
            ...b,
            customer_name: user ? user.name : 'Khách hàng',
            customer_phone: user ? user.phone : b.phone,
            customer_email: user ? user.email : ''
          };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // 7b. Lọc đơn theo promo code đã dùng (hasUsedPromoCode)
    if (normalizedSql.includes('discount_code')) {
      const userId = parseInt(params[0], 10);
      const promoCode = (params[1] || '').toUpperCase();
      return inMemoryData.bookings
        .filter(b => b.user_id === userId && (b.discount_code || '').toUpperCase() === promoCode && b.status !== 'cancelled')
        .map(b => ({ id: b.id }));
    }

    // 7b2. Lọc đơn theo khách hàng đặt
    if (normalizedSql.includes('where b.user_id =') || normalizedSql.includes('where user_id =')) {
      const userId = parseInt(params[0], 10);
      return inMemoryData.bookings
        .filter(b => b.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // 7c. Chi tiết một đơn
    if (normalizedSql.includes('where b.id =') || normalizedSql.includes('where id =')) {
      const id = parseInt(params[0], 10);
      const b = inMemoryData.bookings.find(item => item.id === id);
      if (!b) return [];
      const user = inMemoryData.users.find(u => u.id === b.user_id);
      const staff = inMemoryData.users.find(u => u.id === b.staff_id);
      return [{
        ...b,
        user_name: user ? user.name : 'Khách hàng',
        user_email: user ? user.email : '',
        customer_name: user ? user.name : 'Khách hàng',
        customer_phone: user ? user.phone : b.phone,
        customer_email: user ? user.email : '',
        staff_name: staff ? staff.name : (b.staff_name || 'Chưa phân công'),
        staff_phone: staff ? staff.phone : ''
      }];
    }

    // 7d. Toàn bộ đơn cho Admin
    return inMemoryData.bookings.map(b => {
      const user = inMemoryData.users.find(u => u.id === b.user_id);
      const staff = inMemoryData.users.find(u => u.id === b.staff_id);
      return {
        ...b,
        user_name: user ? user.name : 'Khách hàng',
        user_email: user ? user.email : '',
        customer_name: user ? user.name : 'Khách hàng',
        customer_phone: user ? user.phone : b.phone,
        staff_name: staff ? staff.name : (b.staff_name || 'Chưa phân công'),
        staff_phone: staff ? staff.phone : ''
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // 8. INSERT INTO bookings
  if (normalizedSql.startsWith('insert into bookings')) {
    const [
      booking_code, user_id, service_id, booking_date, booking_time, area_size,
      frequency, address, phone, notes, total_price, discount_code, payment_method,
      duration_hours, staff_wage, wage_status, package_type, shift_choice,
      recipient_name, recipient_age, recipient_gender, care_scope_notes,
      pricing_type, building_type, area_m2, floors, construction_status,
      dirt_severity, glass_cleaning, stubborn_stains, furniture_status,
      worker_count, work_days, quote_status, quote_min_price, quote_max_price,
      quote_notes, construction_notes
    ] = params;
    const newId = inMemoryData.bookings.length > 0 ? Math.max(...inMemoryData.bookings.map(b => b.id)) + 1 : 1;
    const srv = inMemoryData.services.find(s => s.id === parseInt(service_id, 10));
    const newBooking = {
      id: newId,
      booking_code,
      user_id: parseInt(user_id, 10),
      service_id: parseInt(service_id, 10),
      service_name: srv ? srv.name : 'Dịch vụ vệ sinh',
      service_icon: srv ? srv.icon : '🧹',
      booking_date,
      booking_time,
      area_size: area_size || 'medium',
      frequency: frequency || 'once',
      address,
      phone,
      notes: notes || '',
      total_price: parseFloat(total_price),
      discount_code: discount_code || null,
      payment_method: payment_method || 'cash',
      payment_status: 'unpaid',
      status: 'pending',
      staff_id: null,
      staff_name: null,
      staff_notes: null,
      assigned_at: null,
      duration_hours: duration_hours || null,
      staff_wage: staff_wage || 0,
      wage_status: wage_status || 'pending',
      package_type: package_type || 'hourly',
      shift_choice: shift_choice || null,
      recipient_name: recipient_name || null,
      recipient_age: recipient_age || null,
      recipient_gender: recipient_gender || null,
      care_scope_notes: care_scope_notes || null,
      pricing_type: pricing_type || 'm2',
      building_type: building_type || null,
      area_m2: area_m2 !== null && area_m2 !== undefined ? parseFloat(area_m2) : null,
      floors: floors ? parseInt(floors, 10) : 1,
      construction_status: construction_status || null,
      dirt_severity: dirt_severity || null,
      glass_cleaning: glass_cleaning || null,
      stubborn_stains: stubborn_stains || null,
      furniture_status: furniture_status || null,
      worker_count: worker_count ? parseInt(worker_count, 10) : null,
      work_days: work_days ? parseInt(work_days, 10) : null,
      quote_status: quote_status || 'estimated',
      quote_min_price: quote_min_price !== null && quote_min_price !== undefined ? parseFloat(quote_min_price) : null,
      quote_max_price: quote_max_price !== null && quote_max_price !== undefined ? parseFloat(quote_max_price) : null,
      quote_notes: quote_notes || null,
      construction_notes: construction_notes || null,
      created_at: new Date()
    };
    inMemoryData.bookings.unshift(newBooking);
    return { insertId: newId, affectedRows: 1 };
  }

  // 9. UPDATE bookings (Trạng thái / Phân công nhân viên / Ghi chú công việc)
  if (normalizedSql.startsWith('update bookings')) {
    if (normalizedSql.includes("payment_status = 'paid'")) {
      const bookingId = parseInt(params[0], 10);
      const staffId = parseInt(params[1], 10);
      const booking = inMemoryData.bookings.find(item =>
        item.id === bookingId && item.staff_id === staffId &&
        item.status === 'in_progress' && item.payment_method === 'cash' &&
        item.payment_status === 'unpaid'
      );
      if (!booking) return { affectedRows: 0 };
      booking.payment_status = 'paid';
      booking.paid_at = new Date();
      return { affectedRows: 1 };
    }

    if (normalizedSql.includes('tip_amount = ?')) {
      const [amount, bookingId, userId] = params;
      const booking = inMemoryData.bookings.find(item =>
        item.id === parseInt(bookingId, 10) &&
        item.user_id === parseInt(userId, 10) &&
        item.status === 'completed' && Number(item.tip_amount || 0) === 0
      );
      if (!booking) return { affectedRows: 0 };
      booking.tip_amount = Number(amount);
      booking.tip_created_at = new Date();
      return { affectedRows: 1 };
    }

    if (normalizedSql.includes('where id = ? and staff_id = ?')) {
      const status = params[0];
      const staff_notes = params[1];
      const id = parseInt(params[4], 10);
      const staffId = parseInt(params[5], 10);
      const expectedStatus = params[6];
      const booking = inMemoryData.bookings.find(b => b.id === id && b.staff_id === staffId);
      if (booking) {
        if (expectedStatus && booking.status !== expectedStatus) return { affectedRows: 0 };
        booking.status = status;
        if (staff_notes !== undefined) booking.staff_notes = staff_notes;
        booking.cancel_reason = params[2] || null;
        if (status === 'arrived' && !booking.arrived_at) booking.arrived_at = new Date();
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }

    const id = parseInt(params[params.length - 1], 10);
    const booking = inMemoryData.bookings.find(b => b.id === id);
    if (booking) {
      if (normalizedSql.includes('staff_id = ?')) {
        booking.staff_id = params[0] ? parseInt(params[0], 10) : null;
        booking.assigned_at = booking.staff_id ? new Date() : null;
        const staff = inMemoryData.users.find(u => u.id === booking.staff_id);
        booking.staff_name = staff ? staff.name : null;
        booking.status = params[1] || 'pending';
      }
      if (normalizedSql.includes('booking_date = ?')) {
        if (normalizedSql.includes("status in ('pending', 'assigned', 'confirmed')") && !['pending', 'assigned', 'confirmed'].includes(booking.status)) {
          return { affectedRows: 0 };
        }
        if (normalizedSql.includes('and status = ?')) {
          const expectedStatus = params[params.length - 1];
          if (expectedStatus && booking.status !== expectedStatus) return { affectedRows: 0 };
        }
        booking.booking_date = params[0];
        booking.booking_time = params[1];
        if (params[2] !== undefined) booking.notes = params[2];
        return { affectedRows: 1 };
      }
      if (normalizedSql.includes('status = ?') && !normalizedSql.includes('staff_id = ?')) {
        if (normalizedSql.includes('and status = ?')) {
          const expectedStatus = params[params.length - 1];
          if (expectedStatus && booking.status !== expectedStatus) return { affectedRows: 0 };
        }
        booking.status = params[0];
      }
      if (normalizedSql.includes('cancel_reason = ?')) {
        const reasonIndex = normalizedSql.includes('staff_notes = ?') ? 2 : 1;
        booking.cancel_reason = params[reasonIndex] || null;
      }
      if (normalizedSql.includes("quote_status = 'confirmed'")) {
        booking.total_price = parseFloat(params[0]);
        booking.quote_notes = params[1] || '';
        booking.staff_wage = parseFloat(params[2]);
        booking.quote_status = 'confirmed';
        return { affectedRows: 1 };
      }
      if (normalizedSql.includes('staff_notes = ?')) {
        booking.staff_notes = params[1] || booking.staff_notes;
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // Cấu hình bảng giá Vệ sinh sau xây dựng (post_construction_configs)
  if (normalizedSql.includes('from post_construction_configs')) {
    if (!inMemoryData.post_construction_configs) {
      inMemoryData.post_construction_configs = [
        {
          id: 1,
          config_key: 'm2_rates',
          config_value: JSON.stringify({
            factory: { name: 'Công trình lớn, mặt bằng thoáng, nhà xưởng', min: 7000, max: 12000, light: 8000, medium: 10000, heavy: 12000 },
            standard: { name: 'Nhà phố, căn hộ chung cư thông thường', min: 12000, max: 20000, light: 13000, medium: 15000, heavy: 18000 },
            luxury: { name: 'Biệt thự, công trình phức tạp, vết bẩn nặng', min: 20000, max: 35000, light: 22000, medium: 26000, heavy: 32000 }
          }),
          updated_at: new Date()
        },
        {
          id: 2,
          config_key: 'package_rates',
          config_value: JSON.stringify({
            apartment: { name: 'Căn hộ chung cư 60–100 m²', min_area: 60, max_area: 100, min_price: 1500000, max_price: 3000000, standard_price: 2200000 },
            townhouse: { name: 'Nhà phố 2–4 tầng (150–300 m²)', min_area: 150, max_area: 300, min_floors: 2, max_floors: 4, min_price: 3000000, max_price: 6000000, standard_price: 4500000 },
            luxury: { name: 'Biệt thự hoặc căn hộ cao cấp trên 300 m²', min_area: 300, min_price: 6000000, max_price: 12000000, standard_price: 8500000 }
          }),
          updated_at: new Date()
        },
        {
          id: 3,
          config_key: 'labor_daily_rates',
          config_value: JSON.stringify({
            min_price: 400000,
            max_price: 500000,
            standard_price: 450000,
            staff_daily_wage: 320000,
            includes_equipment: true,
            description: 'Mức giá tham khảo bao gồm máy móc và hóa chất cơ bản theo chính sách CleanNova'
          }),
          updated_at: new Date()
        },
        {
          id: 4,
          config_key: 'surcharges',
          config_value: JSON.stringify({
            severe_stains: { rate: 0.10, label: 'Vết sơn, xi măng, keo bám nặng (+10%)' },
            extensive_glass: { rate: 0.10, label: 'Vệ sinh nhiều kính / vách kính lớn (+10%)' },
            furnished: { rate: 0.10, label: 'Công trình nhiều đồ đạc cần bảo quản (+10%)' }
          }),
          updated_at: new Date()
        }
      ];
    }
    return inMemoryData.post_construction_configs.map(c => ({ ...c }));
  }

  if (normalizedSql.startsWith('insert into post_construction_configs')) {
    if (!inMemoryData.post_construction_configs) inMemoryData.post_construction_configs = [];
    const [key, val, adminId] = params;
    const existing = inMemoryData.post_construction_configs.find(c => c.config_key === key);
    if (existing) {
      existing.config_value = val;
      existing.updated_by = adminId;
      existing.updated_at = new Date();
    } else {
      inMemoryData.post_construction_configs.push({
        id: inMemoryData.post_construction_configs.length + 1,
        config_key: key,
        config_value: val,
        updated_by: adminId,
        updated_at: new Date()
      });
    }
    return { affectedRows: 1 };
  }

  // 10. INSERT INTO audit_logs (Lưu nhật ký hành động)
  if (normalizedSql.startsWith('insert into audit_logs')) {
    const [admin_id, action, target_id, target_type, details] = params;
    const newId = inMemoryData.audit_logs.length + 1;
    inMemoryData.audit_logs.push({
      id: newId,
      admin_id,
      action,
      target_id,
      target_type: target_type || 'user',
      details: details || '',
      created_at: new Date()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 11. SELECT reviews
  if (normalizedSql.includes('from reviews')) {
    if (normalizedSql.includes('where r.booking_id = ?') || normalizedSql.includes('where booking_id = ?')) {
      const bId = parseInt(params[0], 10);
      const rev = (inMemoryData.reviews || []).find(r => r.booking_id === bId);
      if (!rev) return [];
      const user = inMemoryData.users.find(u => u.id === rev.user_id);
      return [{ ...rev, user_name: user ? user.name : 'Khách hàng' }];
    }
    const limit = params[0] ? parseInt(params[0], 10) : 10;
    return (inMemoryData.reviews || []).slice(0, limit).map(r => {
      const user = inMemoryData.users.find(u => u.id === r.user_id);
      const srv = inMemoryData.services.find(s => s.id === r.service_id);
      return {
        ...r,
        user_name: user ? user.name : 'Khách hàng',
        service_name: srv ? srv.name : 'Dịch vụ',
        service_icon: srv ? srv.icon : '✨'
      };
    });
  }

  // 12. INSERT INTO reviews
  if (normalizedSql.startsWith('insert into reviews')) {
    const [booking_id, user_id, service_id, rating, staff_rating, comment] = params;
    const newId = (inMemoryData.reviews || []).length + 1;
    if (!inMemoryData.reviews) inMemoryData.reviews = [];
    inMemoryData.reviews.unshift({
      id: newId,
      booking_id: parseInt(booking_id, 10),
      user_id: parseInt(user_id, 10),
      service_id: parseInt(service_id, 10),
      rating: parseInt(rating, 10) || 5,
      staff_rating: parseInt(staff_rating, 10) || null,
      comment: comment || '',
      created_at: new Date()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // 13. SELECT partner_applications
  if (normalizedSql.includes('from partner_applications')) {
    const apps = inMemoryData.partner_applications || [];
    // Theo ID
    if (normalizedSql.includes('where id =')) {
      const id = parseInt(params[0], 10);
      const app = apps.find(a => a.id === id);
      if (!app) return [];
      // Khớp MySQL: không trả về hash password nếu câu query không yêu cầu
      if (!normalizedSql.includes('password')) {
        const { password, ...safeApp } = app;
        return [safeApp];
      }
      return [{ ...app }];
    }
    // Theo Email
    if (normalizedSql.includes('where email =')) {
      const email = (params[0] || '').toLowerCase().trim();
      const app = apps.find(a => (a.email || '').toLowerCase() === email);
      return app ? [{ ...app }] : [];
    }
    // Theo Phone
    if (normalizedSql.includes('where phone =')) {
      const phone = (params[0] || '').trim();
      const app = apps.find(a => (a.phone || '').trim() === phone);
      return app ? [{ ...app }] : [];
    }
    // Lọc theo Status
    if (normalizedSql.includes('where status =')) {
      const status = params[0];
      return apps.filter(a => a.status === status).map(a => ({ ...a })).reverse();
    }
    // Lấy tất cả
    return apps.map(a => ({ ...a })).reverse();
  }

  // 14. INSERT INTO partner_applications
  if (normalizedSql.startsWith('insert into partner_applications')) {
    let name, email, phone, password, address, work_area, experience, available_hours, bio, terms_version, privacy_version, terms_accepted_at, marketing_consent, status;
    if (params.length >= 14) {
      [name, email, phone, password, address, work_area, experience, available_hours, bio, terms_version, privacy_version, terms_accepted_at, marketing_consent, status] = params;
    } else {
      [name, email, phone, password, address, work_area, experience, available_hours, bio, status] = params;
    }
    if (!inMemoryData.partner_applications) inMemoryData.partner_applications = [];
    const newId = inMemoryData.partner_applications.length > 0 
      ? Math.max(...inMemoryData.partner_applications.map(p => p.id)) + 1 
      : 1;
    const newApp = {
      id: newId,
      name: (name || '').trim(),
      email: (email || '').trim().toLowerCase(),
      phone: (phone || '').trim(),
      password,
      address: (address || '').trim(),
      work_area: (work_area || '').trim(),
      experience: experience || '',
      available_hours: available_hours || '',
      bio: bio || '',
      terms_version: terms_version || '1.0',
      privacy_version: privacy_version || '1.0',
      terms_accepted_at: terms_accepted_at || new Date(),
      marketing_consent: marketing_consent ? 1 : 0,
      status: status || 'pending',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      user_id: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    inMemoryData.partner_applications.push(newApp);
    return { insertId: newId, affectedRows: 1 };
  }

  // 15. UPDATE partner_applications (Approve / Reject / Update status)
  if (normalizedSql.startsWith('update partner_applications')) {
    const id = parseInt(params[params.length - 1], 10);
    const app = (inMemoryData.partner_applications || []).find(p => p.id === id);
    if (app) {
      if (normalizedSql.includes('status = ?') && normalizedSql.includes('rejection_reason = ?')) {
        app.status = params[0];
        app.rejection_reason = params[1];
        app.reviewed_by = params[2];
        app.reviewed_at = new Date();
      } else if (normalizedSql.includes('status = ?') && normalizedSql.includes('user_id = ?')) {
        app.status = params[0];
        app.user_id = params[1];
        app.reviewed_by = params[2];
        app.reviewed_at = new Date();
      } else if (normalizedSql.includes('status = ?')) {
        app.status = params[0];
      }
      app.updated_at = new Date();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  return [];
}

// Khởi chạy kết nối ngay khi file được nạp
initDatabase();

module.exports = {
  query,
  isMySQLConnected: () => isConnectedToMySQL,
  getPool: () => pool
};
