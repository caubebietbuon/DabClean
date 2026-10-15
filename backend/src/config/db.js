// ============================================================
// CLEANOVA BACKEND - Database Configuration (MySQL Pool + Graceful Fallback)
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
      name: 'Quản Trị Viên Cleanova',
      email: 'admin@cleanova.vn',
      password: '$2a$10$ZZn8Td.6jh83f7FySaJ/1OnHyXgbyE2yC9rmaOaiHv6sq4Hiraoja', // Admin@Cleanova2026!
      phone: '0912345678',
      address: 'Tòa nhà Cleanova, Cầu Giấy, Hà Nội',
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
      icon: '🏗️',
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
      total_price: 425000,
      discount_code: 'CLEANOVA20',
      payment_method: 'cash',
      payment_status: 'unpaid',
      status: 'confirmed',
      staff_id: 3,
      staff_name: 'Trần Văn Bảo',
      staff_notes: 'Đã liên hệ khách, chuẩn bị bộ lau đa năng và dung dịch hữu cơ.',
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

// Khởi tạo và kiểm tra kết nối MySQL
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    console.log(`[Database] Đã kết nối thành công tới MySQL Server (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})`);
    isConnectedToMySQL = true;
    connection.release();
  } catch (err) {
    console.warn(`[Database] Lưu ý: Chưa thể kết nối MySQL (${err.code || err.message}).`);
    console.warn(`[Database] Hệ thống tự động chuyển sang chế độ an toàn (In-Memory Database) để ứng dụng hoạt động ngay.`);
    console.warn(`[Database] Khi bạn khởi động MySQL/XAMPP và tạo cleanova_db, hãy khởi động lại server để kết nối trực tiếp.`);
    isConnectedToMySQL = false;
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
    return user ? [{ ...user }] : [];
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

    // 7b. Lọc đơn theo khách hàng đặt
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
    const [booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes, total_price, discount_code, payment_method] = params;
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
      area_size,
      frequency,
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
      created_at: new Date()
    };
    inMemoryData.bookings.unshift(newBooking);
    return { insertId: newId, affectedRows: 1 };
  }

  // 9. UPDATE bookings (Trạng thái / Phân công nhân viên / Ghi chú công việc)
  if (normalizedSql.startsWith('update bookings')) {
    if (normalizedSql.includes('where id = ? and staff_id = ?')) {
      const status = params[0];
      const staff_notes = params[1];
      const id = parseInt(params[2], 10);
      const staffId = parseInt(params[3], 10);
      const booking = inMemoryData.bookings.find(b => b.id === id && b.staff_id === staffId);
      if (booking) {
        booking.status = status;
        if (staff_notes !== undefined) booking.staff_notes = staff_notes;
        return { affectedRows: 1 };
      }
      return { affectedRows: 0 };
    }

    const id = parseInt(params[params.length - 1], 10);
    const booking = inMemoryData.bookings.find(b => b.id === id);
    if (booking) {
      if (normalizedSql.includes('staff_id = ?')) {
        booking.staff_id = params[0] ? parseInt(params[0], 10) : null;
        booking.assigned_at = new Date();
        const staff = inMemoryData.users.find(u => u.id === booking.staff_id);
        booking.staff_name = staff ? staff.name : null;
        if (booking.status === 'pending' && booking.staff_id) {
          booking.status = 'confirmed';
        }
      }
      if (normalizedSql.includes('booking_date = ?')) {
        booking.booking_date = params[0];
        booking.booking_time = params[1];
        if (params[2] !== undefined) booking.notes = params[2];
        return { affectedRows: 1 };
      }
      if (normalizedSql.includes('status = ?')) {
        booking.status = params[0];
      }
      if (normalizedSql.includes('staff_notes = ?')) {
        booking.staff_notes = params[1] || booking.staff_notes;
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
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
    const [booking_id, user_id, service_id, rating, comment] = params;
    const newId = (inMemoryData.reviews || []).length + 1;
    if (!inMemoryData.reviews) inMemoryData.reviews = [];
    inMemoryData.reviews.unshift({
      id: newId,
      booking_id: parseInt(booking_id, 10),
      user_id: parseInt(user_id, 10),
      service_id: parseInt(service_id, 10),
      rating: parseInt(rating, 10) || 5,
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
      return app ? [{ ...app }] : [];
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
    const [name, email, phone, password, address, work_area, experience, available_hours, bio, status] = params;
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
