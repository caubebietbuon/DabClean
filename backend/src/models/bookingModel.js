// ============================================================
// CLEANOVA BACKEND - Booking Model (Thao tác bảng bookings & Staff tasks)
// ============================================================
const db = require('../config/db');

const BookingModel = {
  // Tạo đơn đặt dịch vụ mới
  async create({
    booking_code,
    user_id,
    service_id,
    booking_date,
    booking_time,
    area_size,
    frequency,
    address,
    phone,
    notes,
    total_price,
    discount_code,
    payment_method,
    duration_hours,
    staff_wage,
    commission_rate,
    platform_commission,
    staff_net_wage,
    wage_status,
    package_type,
    shift_choice,
    recipient_name,
    recipient_age,
    recipient_gender,
    care_scope_notes,
    pricing_type,
    building_type,
    area_m2,
    floors,
    construction_status,
    dirt_severity,
    glass_cleaning,
    stubborn_stains,
    furniture_status,
    worker_count,
    work_days,
    quote_status,
    quote_min_price,
    quote_max_price,
    quote_notes,
    construction_notes,
    addons,
    addon_amount
  }) {
    const gross = Math.max(0, Math.round(parseFloat(staff_wage) || 0));
    const commRate = commission_rate !== undefined && commission_rate !== null ? parseFloat(commission_rate) : 0.20;
    const commAmt = platform_commission !== undefined && platform_commission !== null
      ? Math.round(parseFloat(platform_commission))
      : Math.round(gross * commRate);
    const net = staff_net_wage !== undefined && staff_net_wage !== null
      ? Math.round(parseFloat(staff_net_wage))
      : Math.max(0, gross - commAmt);

    const result = await db.query(
      `INSERT INTO bookings 
       (booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes, total_price, discount_code, payment_method, duration_hours, staff_wage, commission_rate, platform_commission, staff_net_wage, wage_status, package_type, shift_choice, recipient_name, recipient_age, recipient_gender, care_scope_notes, pricing_type, building_type, area_m2, floors, construction_status, dirt_severity, glass_cleaning, stubborn_stains, furniture_status, worker_count, work_days, quote_status, quote_min_price, quote_max_price, quote_notes, construction_notes, addons, addon_amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking_code,
        user_id,
        service_id,
        booking_date,
        booking_time,
        area_size || 'medium',
        frequency || 'once',
        address,
        phone,
        notes || '',
        total_price,
        discount_code || null,
        payment_method || 'cash',
        duration_hours || null,
        gross,
        commRate,
        commAmt,
        net,
        wage_status || 'pending',
        package_type || 'hourly',
        shift_choice || null,
        recipient_name || null,
        recipient_age || null,
        recipient_gender || null,
        care_scope_notes || null,
        pricing_type || 'm2',
        building_type || null,
        area_m2 !== null && area_m2 !== undefined ? parseFloat(area_m2) : null,
        floors ? parseInt(floors, 10) : 1,
        construction_status || null,
        dirt_severity || null,
        glass_cleaning || null,
        stubborn_stains || null,
        furniture_status || null,
        worker_count ? parseInt(worker_count, 10) : null,
        work_days ? parseInt(work_days, 10) : null,
        quote_status || 'estimated',
        quote_min_price !== null && quote_min_price !== undefined ? parseFloat(quote_min_price) : null,
        quote_max_price !== null && quote_max_price !== undefined ? parseFloat(quote_max_price) : null,
        quote_notes || null,
        construction_notes || null,
        addons ? JSON.stringify(addons) : null,
        addon_amount ? parseFloat(addon_amount) : 0.00
      ]
    );
    return result.insertId;
  },

  // Lấy danh sách đơn của một khách hàng
  async getByUserId(userId) {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.price_unit,
              st.name AS staff_name, st.phone AS staff_phone
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users st ON b.staff_id = st.id
       WHERE b.user_id = ?
       ORDER BY b.id DESC`,
      [userId]
    );
  },

  async createBookingNotification({ user_id, booking_id, notification_type, title, message, data }) {
    return await db.query(
      `INSERT IGNORE INTO booking_notifications
       (user_id, booking_id, notification_type, title, message, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, booking_id, notification_type, title, message, JSON.stringify(data)]
    );
  },

  async getNotificationsByUserId(userId) {
    return await db.query(
      `SELECT id, booking_id, notification_type, title, message, data, is_read, created_at
       FROM booking_notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
  },

  async markNotificationRead(notificationId, userId) {
    const result = await db.query(
      'UPDATE booking_notifications SET is_read = 1 WHERE user_id = ? AND id = ?',
      [userId, notificationId]
    );
    if (result.affectedRows > 0) return true;
    const rows = await db.query(
      'SELECT id FROM booking_notifications WHERE user_id = ? AND id = ? LIMIT 1',
      [userId, notificationId]
    );
    return rows.length > 0;
  },

  // Lấy danh sách công việc được phân công cho một nhân viên (Staff Portal)
  async getByStaffId(staffId) {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.duration_estimate,
              u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.staff_id = ?
       ORDER BY b.booking_date ASC, b.booking_time ASC`,
      [staffId]
    );
  },

  // Lấy chi tiết một đơn theo ID
  async getById(id) {
    const rows = await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon, s.duration_estimate,
              u.name AS customer_name, u.email AS customer_email, u.name AS user_name, u.email AS user_email,
              st.name AS staff_name, st.phone AS staff_phone, st.email AS staff_email
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users st ON b.staff_id = st.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // Phân công nhân viên thực hiện đơn đặt lịch (Admin)
  async assignStaff(bookingId, staffId) {
    const result = await db.query(
      `UPDATE bookings
       SET staff_id = ?, assigned_at = NOW(), status = ?
       WHERE id = ?`,
      [staffId, staffId ? 'assigned' : 'pending', bookingId]
    );
    return result.affectedRows > 0;
  },

  // Kiểm tra xem người dùng đã từng áp dụng mã ưu đãi này chưa (không tính đơn đã hủy)
  async hasUsedPromoCode(userId, promoCode) {
    const rows = await db.query(
      `SELECT id FROM bookings WHERE user_id = ? AND UPPER(discount_code) = ? AND status != 'cancelled' LIMIT 1`,
      [userId, promoCode.toUpperCase()]
    );
    return rows.length > 0;
  },

  // Nhân viên cập nhật trạng thái công việc được giao (Kèm điều kiện status hiện tại để chống race condition)
  async updateStaffTaskStatus(bookingId, staffId, status, staff_notes = '', cancel_reason = '', expectedCurrentStatus = null) {
    let sql = `UPDATE bookings
       SET status = ?, staff_notes = ?, cancel_reason = ?,
           arrived_at = IF(? = 'arrived', COALESCE(arrived_at, NOW()), arrived_at),
           wage_status = CASE 
             WHEN ? = 'completed' AND wage_status = 'pending' THEN 'approved'
             WHEN ? = 'cancelled' THEN 'cancelled'
             ELSE wage_status
           END
       WHERE id = ? AND staff_id = ?`;
    const params = [status, staff_notes, cancel_reason || null, status, status, status, bookingId, staffId];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async markCashPaymentReceived(bookingId, staffId) {
    const result = await db.query(
      `UPDATE bookings SET payment_status = 'paid', paid_at = NOW()
       WHERE id = ? AND staff_id = ? AND status = 'in_progress'
         AND payment_method = 'cash' AND payment_status = 'unpaid'`,
      [bookingId, staffId]
    );
    return result.affectedRows > 0;
  },

  async getJobPhotos(bookingId) {
    return await db.query(
      'SELECT * FROM booking_job_photos WHERE booking_id = ? ORDER BY created_at ASC, id ASC',
      [bookingId]
    );
  },

  async getJobPhotoByUrl(imageUrl) {
    const rows = await db.query(
      'SELECT * FROM booking_job_photos WHERE image_url = ? LIMIT 1',
      [imageUrl]
    );
    return rows[0] || null;
  },

  async addJobPhoto({ booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude }) {
    return await db.query(
      `INSERT INTO booking_job_photos
       (booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking_id, area_name, angle_id, stage, image_url, captured_at, latitude, longitude]
    );
  },

  // Cập nhật trạng thái đơn (User hủy đơn hoặc Admin đổi trạng thái, kèm điều kiện chống race condition)
  async updateStatus(id, status, cancel_reason = '', expectedCurrentStatus = null) {
    let sql = `UPDATE bookings SET status = ?, cancel_reason = ?,
               wage_status = CASE
                 WHEN ? = 'completed' AND wage_status = 'pending' THEN 'approved'
                 WHEN ? = 'cancelled' THEN 'cancelled'
                 ELSE wage_status
               END
               WHERE id = ?`;
    const params = [status, cancel_reason || null, status, status, id];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  async addTip({ booking_id, user_id, amount }) {
    const result = await db.query(
      `UPDATE bookings SET tip_amount = ?, tip_created_at = NOW()
       WHERE id = ? AND user_id = ? AND status = 'completed' AND tip_amount = 0`,
      [amount, booking_id, user_id]
    );
    return result.affectedRows > 0;
  },

  // Khách hàng yêu cầu đổi lịch đơn đặt dịch vụ (Chỉ cho phép khi ở trạng thái pending, assigned, confirmed)
  async reschedule(id, { booking_date, booking_time, notes }, expectedCurrentStatus = null) {
    let sql = `UPDATE bookings SET booking_date = ?, booking_time = ?, notes = ? WHERE id = ? AND status IN ('pending', 'assigned', 'confirmed')`;
    const params = [booking_date, booking_time, notes || '', id];
    if (expectedCurrentStatus) {
      sql += ' AND status = ?';
      params.push(expectedCurrentStatus);
    }
    const result = await db.query(sql, params);
    return result.affectedRows > 0;
  },

  // Tạo đánh giá chất lượng dịch vụ cho đơn đã hoàn thành
  async createReview({ booking_id, user_id, service_id, rating, staff_rating, comment }) {
    const result = await db.query(
      'INSERT INTO reviews (booking_id, user_id, service_id, rating, staff_rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [booking_id, user_id, service_id, rating, staff_rating, comment || '']
    );
    return result.insertId;
  },

  // Lấy đánh giá của một đơn
  async getReviewByBookingId(bookingId) {
    const rows = await db.query(
      'SELECT r.*, u.name AS user_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.booking_id = ? LIMIT 1',
      [bookingId]
    );
    return rows[0] || null;
  },

  // Lấy danh sách đánh giá mới nhất
  async getAllReviews(limit = 10) {
    return await db.query(
      `SELECT r.*, u.name AS user_name, s.name AS service_name, s.icon AS service_icon
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN services s ON r.service_id = s.id
       ORDER BY r.id DESC LIMIT ?`,
      [limit]
    );
  },

  // Lấy toàn bộ đơn hàng (Dành cho Admin)
  async getAll() {
    return await db.query(
      `SELECT b.*, s.name AS service_name, s.icon AS service_icon,
              u.name AS customer_name, u.email AS customer_email, u.name AS user_name, u.email AS user_email,
              st.name AS staff_name, st.phone AS staff_phone
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       LEFT JOIN users st ON b.staff_id = st.id
       ORDER BY b.id DESC`
    );
  },

  // Lấy thống kê tổng quan và tài chính chi tiết với bộ lọc ngày tháng (Dashboard Admin)
  async getStats(filters = {}) {
    const { period, from_date, to_date } = filters;
    let dateCondition = '1=1';
    const dateParams = [];

    const now = new Date();
    if (period === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      dateCondition = 'DATE(b.created_at) = ?';
      dateParams.push(todayStr);
    } else if (period === '7days') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const d7Str = d7.toISOString().slice(0, 10);
      dateCondition = 'DATE(b.created_at) >= ?';
      dateParams.push(d7Str);
    } else if (period === 'month' || period === 'this_month') {
      const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      dateCondition = 'DATE(b.created_at) >= ?';
      dateParams.push(firstDayStr);
    } else if (from_date && to_date) {
      dateCondition = 'DATE(b.created_at) >= ? AND DATE(b.created_at) <= ?';
      dateParams.push(from_date, to_date);
    } else if (from_date) {
      dateCondition = 'DATE(b.created_at) >= ?';
      dateParams.push(from_date);
    } else if (to_date) {
      dateCondition = 'DATE(b.created_at) <= ?';
      dateParams.push(to_date);
    }

    // 1. Thống kê số lượng người dùng, đối tác, số dư ví hệ thống
    const countsRows = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'customer' OR role = 'user') AS total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'staff') AS total_staff,
        (SELECT COUNT(*) FROM services WHERE is_active = 1) AS total_services,
        (SELECT COUNT(*) FROM partner_applications WHERE status = 'pending') AS pending_partners,
        (SELECT IFNULL(SUM(balance), 0) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role IN ('customer', 'user')) AS customer_wallet_balance,
        (SELECT IFNULL(SUM(balance), 0) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff') AS staff_wallet_balance,
        (SELECT IFNULL(SUM(balance), 0) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'credit') AS staff_credit_balance_total,
        (SELECT IFNULL(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'credit') AS staff_credit_debt_total,
        (SELECT COUNT(*) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'credit' AND w.balance < 0) AS staff_negative_credit_count,
        (SELECT COUNT(*) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'credit' AND w.balance <= 100000) AS staff_ineligible_count,
        (SELECT COUNT(*) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'credit' AND w.balance > 100000) AS staff_eligible_count,
        (SELECT IFNULL(SUM(balance), 0) FROM wallets w JOIN users u ON w.user_id = u.id WHERE u.role = 'staff' AND w.wallet_type = 'earnings') AS staff_earnings_balance_total,
        (SELECT COUNT(*) FROM wallet_transactions) AS total_wallet_transactions,
        (SELECT IFNULL(SUM(amount), 0) FROM wallet_transactions WHERE type = 'topup' AND reference_type = 'credit_topup' AND status = 'completed') AS staff_credit_topup_total,
        (SELECT IFNULL(SUM(amount), 0) FROM wallet_transactions WHERE type = 'transfer' AND reference_type = 'interwallet_transfer' AND status = 'completed' AND transaction_code LIKE '%-IN') AS staff_interwallet_transfer_total,
        (SELECT IFNULL(SUM(amount), 0) FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'completed') AS staff_withdrawal_total,
        (SELECT IFNULL(SUM(amount), 0) FROM wallet_transactions WHERE type = 'withdrawal' AND status = 'pending') AS staff_pending_withdrawal_total,
        (SELECT COUNT(*) FROM vouchers WHERE is_active = 1) AS active_vouchers,
        (SELECT COUNT(*) FROM voucher_usages) AS total_voucher_usages`
    );
    const counts = (countsRows && countsRows[0]) || {};

    // 2. Thống kê tài chính & đơn đặt lịch theo khoảng thời gian được lọc
    const finRows = await db.query(
      `SELECT 
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN b.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_bookings_count,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_bookings_count,
        SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS completed_bookings_count,
        SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) AS pending_bookings,
        SUM(CASE WHEN b.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_bookings,
        
        -- Gross Booking Value (Giá trị danh nghĩa toàn bộ đơn tạo trong kỳ)
        IFNULL(SUM(b.total_price), 0) AS gross_booking_value,

        -- 1. Tổng tiền khách đã thanh toán thành công (Gross Payments)
        IFNULL(SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_price ELSE 0 END), 0) AS gross_payments,

        -- 1a. Tiền khách thanh toán bằng tiền mặt
        IFNULL(SUM(CASE WHEN b.payment_status = 'paid' AND b.payment_method = 'cash' THEN b.total_price ELSE 0 END), 0) AS cash_payments,

        -- 1b. Tiền khách thanh toán trực tuyến
        IFNULL(SUM(CASE WHEN b.payment_status = 'paid' AND b.payment_method != 'cash' THEN b.total_price ELSE 0 END), 0) AS online_payments,

        -- 2. Tiền hoàn cho khách (Customer Refunds)
        IFNULL(SUM(CASE WHEN b.payment_status = 'refunded' THEN b.total_price ELSE 0 END), 0) AS refunds,

        -- 4. Tiền công gộp của nhân viên trước khấu trừ (Staff Gross Wages)
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.staff_wage ELSE 0 END), 0) AS staff_gross_wages,

        -- 5. Chiết khấu/hoa hồng CleanNova (Platform Commission)
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.platform_commission ELSE 0 END), 0) AS platform_commission,

        -- 6. Tiền công thực nhận của nhân viên (Staff Net Wages)
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.staff_net_wage ELSE 0 END), 0) AS staff_net_wages,

        -- 7. Khoản phải trả nhân viên (Đơn đã hoàn thành nhưng chưa quyết toán)
        IFNULL(SUM(CASE WHEN b.status = 'completed' AND b.wage_status IN ('pending', 'approved') THEN b.staff_net_wage ELSE 0 END), 0) AS staff_payable,

        -- 8. Khoản đã chi trả nhân viên (Đã ghi có vào Staff Wallet)
        IFNULL(SUM(CASE WHEN b.wage_status = 'paid' THEN b.staff_net_wage ELSE 0 END), 0) AS staff_settled
       FROM bookings b
       WHERE ${dateCondition}`,
      dateParams
    );
    const fin = (finRows && finRows[0]) || {};

    const grossPayments = Math.round(parseFloat(fin.gross_payments) || 0);
    const refunds = Math.round(parseFloat(fin.refunds) || 0);
    const netReceipts = Math.max(0, grossPayments - refunds);
    const staffGross = Math.round(parseFloat(fin.staff_gross_wages) || 0);
    const platformCommission = Math.round(parseFloat(fin.platform_commission) || 0);
    const staffNet = Math.round(parseFloat(fin.staff_net_wages) || 0);
    const staffPayable = Math.round(parseFloat(fin.staff_payable) || 0);
    const staffSettled = Math.round(parseFloat(fin.staff_settled) || 0);
    const platformProfit = Math.round(netReceipts - staffNet);

    // 3. Chuỗi thời gian (Daily Breakdown) phục vụ biểu đồ và đối soát
    const dailyRows = await db.query(
      `SELECT 
        DATE_FORMAT(b.created_at, '%Y-%m-%d') AS date,
        COUNT(*) AS booking_count,
        SUM(CASE WHEN b.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
        SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        IFNULL(SUM(CASE WHEN b.payment_status = 'paid' THEN b.total_price ELSE 0 END), 0) AS gross_payments,
        IFNULL(SUM(CASE WHEN b.payment_status = 'refunded' THEN b.total_price ELSE 0 END), 0) AS refunds,
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.staff_wage ELSE 0 END), 0) AS staff_gross_wages,
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.platform_commission ELSE 0 END), 0) AS platform_commission,
        IFNULL(SUM(CASE WHEN b.status = 'completed' OR b.wage_status = 'paid' THEN b.staff_net_wage ELSE 0 END), 0) AS staff_net_wages
       FROM bookings b
       WHERE ${dateCondition}
       GROUP BY DATE_FORMAT(b.created_at, '%Y-%m-%d')
       ORDER BY date ASC`,
      dateParams
    );

    const dailyBreakdown = (dailyRows || []).map(r => {
      const g = Math.round(parseFloat(r.gross_payments) || 0);
      const rf = Math.round(parseFloat(r.refunds) || 0);
      const netR = Math.max(0, g - rf);
      const sNet = Math.round(parseFloat(r.staff_net_wages) || 0);
      return {
        date: r.date,
        booking_count: parseInt(r.booking_count, 10) || 0,
        paid_count: parseInt(r.paid_count, 10) || 0,
        cancelled_count: parseInt(r.cancelled_count, 10) || 0,
        gross_payments: g,
        refunds: rf,
        net_receipts: netR,
        staff_gross_wages: Math.round(parseFloat(r.staff_gross_wages) || 0),
        platform_commission: Math.round(parseFloat(r.platform_commission) || 0),
        staff_net_wages: sNet,
        platform_profit: Math.round(netR - sNet)
      };
    });

    // 4. Lấy cấu hình tỷ lệ hoa hồng CleanNova hiện hành
    let currentCommissionRate = 0.20;
    try {
      const sysConfigs = await db.query("SELECT config_value FROM system_configs WHERE config_key = 'staff_commission_rate' LIMIT 1");
      if (sysConfigs && sysConfigs.length > 0) {
        const parsedCfg = typeof sysConfigs[0].config_value === 'string' ? JSON.parse(sysConfigs[0].config_value) : sysConfigs[0].config_value;
        currentCommissionRate = parseFloat(parsedCfg.rate) || 0.20;
      }
    } catch (_) {}

    return {
      filter: {
        period: period || 'all',
        from_date: from_date || null,
        to_date: to_date || null
      },
      // 10 Chỉ số tài chính cốt lõi
      gross_payments: grossPayments,
      cash_payments: Math.round(parseFloat(fin.cash_payments) || 0),
      online_payments: Math.round(parseFloat(fin.online_payments) || 0),
      refunds: refunds,
      refund_amount: refunds,
      net_receipts: netReceipts,
      staff_gross_wages: staffGross,
      platform_commission: platformCommission,
      staff_net_wages: staffNet,
      staff_payable: staffPayable,
      staff_settled: staffSettled,
      payment_fees: 0,
      platform_profit: platformProfit,

      // Trạng thái hai ví nhân viên (Mô hình Grab Driver)
      staff_credit_balance_total: Math.round(parseFloat(counts.staff_credit_balance_total) || 0),
      staff_credit_debt_total: Math.round(parseFloat(counts.staff_credit_debt_total) || 0),
      staff_negative_credit_count: parseInt(counts.staff_negative_credit_count, 10) || 0,
      staff_ineligible_count: parseInt(counts.staff_ineligible_count, 10) || 0,
      staff_eligible_count: parseInt(counts.staff_eligible_count, 10) || 0,
      staff_earnings_balance_total: Math.round(parseFloat(counts.staff_earnings_balance_total) || 0),
      staff_credit_topup_total: Math.round(parseFloat(counts.staff_credit_topup_total) || 0),
      staff_interwallet_transfer_total: Math.round(parseFloat(counts.staff_interwallet_transfer_total) || 0),
      staff_withdrawal_total: Math.round(parseFloat(counts.staff_withdrawal_total) || 0),
      staff_pending_withdrawal_total: Math.round(parseFloat(counts.staff_pending_withdrawal_total) || 0),

      // Trạng thái ví hệ thống
      customer_wallet_liability: Math.round(parseFloat(counts.customer_wallet_balance) || 0),
      staff_wallet_balance: Math.round(parseFloat(counts.staff_wallet_balance) || 0),
      total_wallet_balance: Math.round((parseFloat(counts.customer_wallet_balance) || 0) + (parseFloat(counts.staff_wallet_balance) || 0)),

      // Số lượng đối tượng hệ thống
      total_users: parseInt(counts.total_users, 10) || 0,
      total_staff: parseInt(counts.total_staff, 10) || 0,
      total_services: parseInt(counts.total_services, 10) || 0,
      pending_partners: parseInt(counts.pending_partners, 10) || 0,
      total_wallet_transactions: parseInt(counts.total_wallet_transactions, 10) || 0,
      active_vouchers: parseInt(counts.active_vouchers, 10) || 0,
      total_voucher_usages: parseInt(counts.total_voucher_usages, 10) || 0,

      // Thống kê đơn hàng trong kỳ
      total_bookings: parseInt(fin.total_bookings, 10) || 0,
      paid_bookings_count: parseInt(fin.paid_bookings_count, 10) || 0,
      cancelled_bookings_count: parseInt(fin.cancelled_bookings_count, 10) || 0,
      completed_bookings_count: parseInt(fin.completed_bookings_count, 10) || 0,
      pending_bookings: parseInt(fin.pending_bookings, 10) || 0,
      in_progress_bookings: parseInt(fin.in_progress_bookings, 10) || 0,
      gross_booking_value: Math.round(parseFloat(fin.gross_booking_value) || 0),

      // Cấu hình tỷ lệ hoa hồng
      active_commission_rate: currentCommissionRate,

      // Chi tiết chuỗi thời gian
      daily_breakdown: dailyBreakdown,

      // Backward compatibility aliases
      collected_revenue: grossPayments,
      total_revenue: grossPayments,
      totalRevenue: grossPayments,
      total_staff_wages: staffGross,
      settled_staff_wages: staffSettled,
      refunded_amount: refunds,
      estimated_net_profit: platformProfit,
      totalUsers: parseInt(counts.total_users, 10) || 0,
      totalStaff: parseInt(counts.total_staff, 10) || 0,
      activeStaff: parseInt(counts.total_staff, 10) || 0,
      activeServices: parseInt(counts.total_services, 10) || 0,
      totalBookings: parseInt(fin.total_bookings, 10) || 0,
      pendingPartners: parseInt(counts.pending_partners, 10) || 0
    };
  },

  // Xác nhận báo giá chính thức cho đơn dịch vụ vệ sinh sau xây dựng (Admin)
  async confirmQuote(id, { confirmed_price, quote_notes = '', staff_wage = null, commission_rate = null }) {
    const parsedPrice = parseFloat(confirmed_price);
    const calculatedWage = staff_wage !== null ? parseFloat(staff_wage) : Math.round(parsedPrice * 0.70);
    const rate = commission_rate !== null && commission_rate !== undefined ? parseFloat(commission_rate) : 0.20;
    const comm = Math.round(calculatedWage * rate);
    const net = Math.max(0, calculatedWage - comm);
    const result = await db.query(
      `UPDATE bookings 
       SET total_price = ?, confirmed_price = ?, quote_notes = ?, staff_wage = ?, commission_rate = ?, platform_commission = ?, staff_net_wage = ?, quote_status = 'confirmed'
       WHERE id = ?`,
      [parsedPrice, parsedPrice, quote_notes, calculatedWage, rate, comm, net, id]
    );
    return result.affectedRows > 0;
  },

  // Lấy cấu hình tỷ lệ chiết khấu CleanNova
  async getCommissionConfig() {
    const rows = await db.query(
      "SELECT config_key, config_value, description, updated_at FROM system_configs WHERE config_key = 'staff_commission_rate' LIMIT 1"
    );
    if (rows && rows.length > 0) {
      const cfg = typeof rows[0].config_value === 'string' ? JSON.parse(rows[0].config_value) : rows[0].config_value;
      return {
        key: 'staff_commission_rate',
        rate: parseFloat(cfg.rate) || 0.20,
        description: rows[0].description || cfg.description || 'Tỷ lệ chiết khấu CleanNova',
        updated_reason: cfg.updated_reason || '',
        updated_at: rows[0].updated_at
      };
    }
    return {
      key: 'staff_commission_rate',
      rate: 0.20,
      description: 'Tỷ lệ chiết khấu CleanNova mặc định (20%)',
      updated_reason: 'Mặc định hệ thống',
      updated_at: null
    };
  },

  // Cập nhật cấu hình tỷ lệ chiết khấu CleanNova (Admin)
  async updateCommissionConfig(rate, reason, adminId) {
    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 1) {
      const error = new Error('Tỷ lệ chiết khấu phải nằm trong khoảng từ 0.00 (0%) đến 1.00 (100%).');
      error.statusCode = 400;
      throw error;
    }
    const configValue = JSON.stringify({
      rate: parsedRate,
      updated_reason: reason || 'Admin cập nhật chính sách chiết khấu',
      updated_by: adminId,
      updated_at: new Date()
    });
    await db.query(
      `INSERT INTO system_configs (config_key, config_value, description, updated_by)
       VALUES ('staff_commission_rate', ?, 'Tỷ lệ chiết khấu CleanNova khấu trừ từ tiền công nhân viên', ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_by = VALUES(updated_by)`,
      [configValue, adminId]
    );
    return true;
  },

  // Lấy cấu hình bảng giá sau xây dựng
  async getPostConstructionConfigs() {
    const rows = await db.query('SELECT config_key, config_value, updated_at FROM post_construction_configs');
    const result = {};
    for (const row of rows) {
      result[row.config_key] = typeof row.config_value === 'string' ? JSON.parse(row.config_value) : row.config_value;
    }
    return result;
  },

  // Cập nhật cấu hình bảng giá sau xây dựng
  async updatePostConstructionConfig(key, value, adminId) {
    const valStr = JSON.stringify(value);
    await db.query(
      `INSERT INTO post_construction_configs (config_key, config_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_by = VALUES(updated_by)`,
      [key, valStr, adminId]
    );
    return true;
  }
};

module.exports = BookingModel;
