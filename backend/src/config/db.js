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
      created_at: new Date('2026-01-01T08:00:00Z')
    },
    {
      id: 2,
      name: 'Nguyễn Tiến Đức',
      email: 'demo@nova.app',
      password: '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS', // NovaDemo2026!
      phone: '0987654321',
      address: 'Số 25 Phố Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
      role: 'user',
      created_at: new Date('2026-02-15T09:30:00Z')
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
      created_at: new Date('2026-10-12T15:20:00Z')
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

  // 0. Thống kê Admin (COUNT)
  if (normalizedSql.includes('count(')) {
    const totalUsers = inMemoryData.users.filter(u => u.role === 'user').length;
    const totalServices = inMemoryData.services.length;
    const totalBookings = inMemoryData.bookings.length;
    const pendingBookings = inMemoryData.bookings.filter(b => b.status === 'pending').length;
    const totalRevenue = inMemoryData.bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + (b.total_price || 0), 0);
    return [{
      total_users: totalUsers,
      total_services: totalServices,
      total_bookings: totalBookings,
      pending_bookings: pendingBookings,
      total_revenue: totalRevenue,
      totalUsers: totalUsers,
      activeServices: totalServices,
      totalBookings: totalBookings,
      totalRevenue: totalRevenue
    }];
  }

  // 1. SELECT users BY email
  if (normalizedSql.includes('from users') && normalizedSql.includes('where email =')) {
    const email = params[0];
    const user = inMemoryData.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    return user ? [user] : [];
  }

  // 2. SELECT users BY id
  if (normalizedSql.includes('from users') && normalizedSql.includes('where id =')) {
    const id = parseInt(params[0], 10);
    const user = inMemoryData.users.find(u => u.id === id);
    return user ? [user] : [];
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
      created_at: u.created_at
    }));
  }

  // 3. INSERT INTO users
  if (normalizedSql.startsWith('insert into users')) {
    const [name, email, password, phone, address, role] = params;
    const newId = inMemoryData.users.length > 0 ? Math.max(...inMemoryData.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: newId,
      name,
      email,
      password,
      phone: phone || '',
      address: address || '',
      role: role || 'user',
      created_at: new Date()
    };
    inMemoryData.users.push(newUser);
    return { insertId: newId, affectedRows: 1 };
  }

  // 4. UPDATE users
  if (normalizedSql.startsWith('update users')) {
    const id = parseInt(params[params.length - 1], 10);
    const user = inMemoryData.users.find(u => u.id === id);
    if (user) {
      if (params.length === 4) { // name, phone, address, id
        user.name = params[0];
        user.phone = params[1];
        user.address = params[2];
      } else if (params.length === 2 && normalizedSql.includes('password =')) { // password, id
        user.password = params[0];
      }
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
    if (normalizedSql.includes('where b.user_id =') || normalizedSql.includes('where user_id =')) {
      const userId = parseInt(params[0], 10);
      return inMemoryData.bookings
        .filter(b => b.user_id === userId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    if (normalizedSql.includes('where b.id =') || normalizedSql.includes('where id =')) {
      const id = parseInt(params[0], 10);
      const b = inMemoryData.bookings.find(item => item.id === id);
      return b ? [b] : [];
    }
    // All bookings for Admin
    return inMemoryData.bookings.map(b => {
      const user = inMemoryData.users.find(u => u.id === b.user_id);
      return {
        ...b,
        user_name: user ? user.name : 'Khách hàng',
        user_email: user ? user.email : ''
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
      created_at: new Date()
    };
    inMemoryData.bookings.unshift(newBooking);
    return { insertId: newId, affectedRows: 1 };
  }

  // 9. UPDATE bookings (status, etc.)
  if (normalizedSql.startsWith('update bookings')) {
    const id = parseInt(params[params.length - 1], 10);
    const booking = inMemoryData.bookings.find(b => b.id === id);
    if (booking) {
      if (normalizedSql.includes('status = ?')) {
        booking.status = params[0];
      }
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
