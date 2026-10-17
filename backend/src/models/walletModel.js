// ============================================================
// DABCLEAN BACKEND - Wallet Model (Ví DabClean & Double-Entry Ledger)
// ============================================================
const crypto = require('crypto');
const db = require('../config/db');

// Bug 11: Chuẩn hóa ngưỡng tối thiểu để nhân viên đủ điều kiện nhận việc (100.000 VNĐ)
const STAFF_MIN_CREDIT_THRESHOLD = 100000;

const WalletModel = {
  // Lấy hoặc tạo ví cho người dùng (Hỗ trợ customer, credit, earnings)
  async getOrCreateWallet(userId, externalConn = null, walletType = null) {
    let targetType = walletType;
    if (!targetType) {
      let role = 'customer';
      if (externalConn) {
        const [u] = await externalConn.query('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
        if (u && u.length > 0) role = u[0].role;
      } else {
        const u = await db.query('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
        if (u && u.length > 0) role = u[0].role;
      }
      targetType = role === 'staff' ? 'earnings' : 'customer';
    }

    let rows;
    if (externalConn) {
      const [r] = await externalConn.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ? LIMIT 1',
        [userId, targetType]
      );
      rows = r;
    } else {
      rows = await db.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ? LIMIT 1',
        [userId, targetType]
      );
    }

    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Nếu chưa có, tạo mới an toàn
    if (externalConn) {
      await externalConn.query(
        'INSERT INTO wallets (user_id, wallet_type, balance, currency, status) VALUES (?, ?, 0.00, "VND", "active") ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
        [userId, targetType]
      );
      const [newRows] = await externalConn.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ? LIMIT 1',
        [userId, targetType]
      );
      return newRows[0];
    } else {
      await db.query(
        'INSERT INTO wallets (user_id, wallet_type, balance, currency, status) VALUES (?, ?, 0.00, "VND", "active") ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
        [userId, targetType]
      );
      const newRows = await db.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ? LIMIT 1',
        [userId, targetType]
      );
      return newRows[0];
    }
  },

  // Đảm bảo khởi tạo cả 2 ví cho nhân viên: Ví tín dụng ('credit') và Ví thu nhập ('earnings')
  async getOrCreateStaffWallets(staffId, externalConn = null) {
    const creditWallet = await this.getOrCreateWallet(staffId, externalConn, 'credit');
    const earningsWallet = await this.getOrCreateWallet(staffId, externalConn, 'earnings');
    return { creditWallet, earningsWallet };
  },

  // Lấy số dư ví của người dùng
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      walletId: wallet.id,
      userId: wallet.user_id,
      balance: parseFloat(wallet.balance) || 0,
      currency: wallet.currency || 'VND',
      status: wallet.status
    };
  },

  /**
   * Nạp tiền vào ví (Chế độ Sandbox / Gateway Verified Callback)
   * Đảm bảo tính Idempotency và ghi sổ cái bất biến (Double-entry ledger)
   */
  async topup({ userId, amount, idempotencyKey = null, description = 'Nạp tiền vào ví CleanNova (Sandbox)', referenceType = 'sandbox', referenceId = null }) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      const error = new Error('Số tiền nạp phải là số dương lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }
    if (parsedAmount > 50000000) {
      const error = new Error('Hạn mức mỗi lần nạp tối đa là 50.000.000 VNĐ.');
      error.statusCode = 400;
      throw error;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      const error = new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý giao dịch nạp tiền ví. Chức năng nạp tiền yêu cầu cơ sở dữ liệu MySQL hoạt động.');
      error.statusCode = 503;
      throw error;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Kiểm tra Idempotency key nếu có
      if (idempotencyKey) {
        const [existingTx] = await connection.query(
          'SELECT * FROM wallet_transactions WHERE idempotency_key = ? LIMIT 1',
          [idempotencyKey]
        );
        if (existingTx && existingTx.length > 0) {
          await connection.commit();
          return {
            success: true,
            isIdempotent: true,
            transaction: existingTx[0]
          };
        }
      }

      // 2. Khóa dòng bản ghi ví người dùng (Row-level lock chống Race Condition)
      await this.getOrCreateWallet(userId, connection);
      const [wallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      const wallet = wallets[0];
      if (wallet.status !== 'active') {
        throw new Error('Ví của bạn đang bị khóa hoặc tạm dừng giao dịch.');
      }

      const balanceBefore = parseFloat(wallet.balance) || 0;
      const balanceAfter = balanceBefore + parsedAmount;

      // 3. Sinh mã giao dịch duy nhất
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-TOPUP-${dateStr}-${randomHex}`;

      // 4. Cập nhật số dư ví
      await connection.query(
        'UPDATE wallets SET balance = ? WHERE id = ?',
        [balanceAfter, wallet.id]
      );

      // 5. Ghi log giao dịch ví
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'topup', ?, ?, ?, 'completed', ?, ?, ?, ?)`,
        [txnCode, wallet.id, userId, parsedAmount, balanceBefore, balanceAfter, description, referenceType, referenceId, idempotencyKey]
      );
      const transactionId = txResult.insertId;

      // 6. Ghi bút toán sổ cái bất biến (Ledger Entry - Credit)
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'credit', ?, ?, ?)`,
        [transactionId, wallet.id, parsedAmount, balanceAfter, `Nạp tiền: ${description}`]
      );

      await connection.commit();

      return {
        success: true,
        transaction_code: txnCode,
        amount: parsedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        wallet_id: wallet.id
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Thanh toán đơn hàng bằng Ví DabClean (Atomic Deduction)
   * Chống thanh toán trùng, trừ tiền đúng 1 lần và ghi bút toán sổ cái (Debit)
   */
  async payBooking({ userId, bookingId, idempotencyKey = null }) {
    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý thanh toán.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Kiểm tra đơn đặt lịch
      const [bookings] = await connection.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [bookingId]
      );
      if (!bookings || bookings.length === 0) {
        throw new Error('Không tìm thấy thông tin đơn đặt lịch.');
      }
      const booking = bookings[0];

      // Xác minh quyền sở hữu
      if (booking.user_id !== userId) {
        const error = new Error('Bạn không có quyền thanh toán cho đơn hàng này.');
        error.statusCode = 403;
        throw error;
      }

      // Kiểm tra trạng thái thanh toán
      if (booking.payment_status === 'paid') {
        throw new Error('Đơn đặt lịch này đã được thanh toán trước đó.');
      }
      if (booking.status === 'cancelled') {
        throw new Error('Không thể thanh toán cho đơn hàng đã bị hủy.');
      }

      const amountToPay = parseFloat(booking.total_price) || 0;

      // 2. Khóa dòng bản ghi ví người dùng
      await this.getOrCreateWallet(userId, connection);
      const [wallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      const wallet = wallets[0];
      if (wallet.status !== 'active') {
        throw new Error('Ví của bạn đang bị khóa, không thể thực hiện thanh toán.');
      }

      const currentBalance = parseFloat(wallet.balance) || 0;
      if (currentBalance < amountToPay) {
        const error = new Error(`Số dư Ví DabClean không đủ. Số dư hiện có: ${Math.round(currentBalance).toLocaleString('vi-VN')} đ, cần thanh toán: ${Math.round(amountToPay).toLocaleString('vi-VN')} đ.`);
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_WALLET_BALANCE';
        throw error;
      }

      const balanceBefore = currentBalance;
      const balanceAfter = currentBalance - amountToPay;

      // 3. Sinh mã giao dịch duy nhất
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-PAY-${dateStr}-${randomHex}`;

      // 4. Trừ tiền ví
      await connection.query(
        'UPDATE wallets SET balance = ? WHERE id = ?',
        [balanceAfter, wallet.id]
      );

      // 5. Ghi log giao dịch ví (Payment)
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'payment', ?, ?, ?, 'completed', ?, 'booking', ?, ?)`,
        [txnCode, wallet.id, userId, amountToPay, balanceBefore, balanceAfter, `Thanh toán đơn dịch vụ CleanNova #${booking.booking_code}`, String(booking.id), idempotencyKey]
      );
      const transactionId = txResult.insertId;

      // 6. Ghi bút toán sổ cái bất biến (Ledger Entry - Debit)
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'debit', ?, ?, ?)`,
        [transactionId, wallet.id, amountToPay, balanceAfter, `Trừ tiền thanh toán đơn ${booking.booking_code}`]
      );

      // 7. Cập nhật trạng thái đơn đặt lịch
      await connection.query(
        `UPDATE bookings SET payment_method = 'wallet', payment_status = 'paid', paid_at = NOW() WHERE id = ?`,
        [booking.id]
      );

      await connection.commit();

      return {
        success: true,
        transaction_code: txnCode,
        amount_paid: amountToPay,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        booking_id: booking.id,
        booking_code: booking.booking_code
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Hoàn tiền đơn hàng vào Ví DabClean (Atomic Refund)
   * Áp dụng khi khách hủy đơn đã trả tiền hoặc admin duyệt hoàn tiền
   */
  async refundBooking({ bookingId, reason = 'Hoàn tiền hủy đơn đặt dịch vụ', adminId = null }) {
    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý hoàn tiền.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Kiểm tra đơn
      const [bookings] = await connection.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [bookingId]
      );
      if (!bookings || bookings.length === 0) {
        throw new Error('Không tìm thấy thông tin đơn đặt lịch cần hoàn tiền.');
      }
      const booking = bookings[0];

      if (booking.payment_status === 'refunded') {
        const error = new Error('Đơn đặt lịch này đã được hoàn tiền trước đó.');
        error.statusCode = 409;
        throw error;
      }
      if (booking.payment_status !== 'paid') {
        const error = new Error('Chỉ có thể hoàn tiền cho đơn đã thanh toán thành công.');
        error.statusCode = 400;
        throw error;
      }

      const refundAmount = parseFloat(booking.total_price) || 0;
      if (refundAmount <= 0) {
        throw new Error('Số tiền hoàn trả không hợp lệ.');
      }

      // 2. Khóa dòng bản ghi ví người dùng
      await this.getOrCreateWallet(booking.user_id, connection);
      const [wallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? FOR UPDATE',
        [booking.user_id]
      );
      const wallet = wallets[0];

      const balanceBefore = parseFloat(wallet.balance) || 0;
      const balanceAfter = balanceBefore + refundAmount;

      // 3. Sinh mã giao dịch duy nhất
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-REFUND-${dateStr}-${randomHex}`;

      // 4. Cộng tiền hoàn vào ví
      await connection.query(
        'UPDATE wallets SET balance = ? WHERE id = ?',
        [balanceAfter, wallet.id]
      );

      // 5. Ghi log giao dịch ví (Refund)
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id)
         VALUES (?, ?, ?, 'refund', ?, ?, ?, 'completed', ?, 'booking', ?)`,
        [txnCode, wallet.id, booking.user_id, refundAmount, balanceBefore, balanceAfter, `Hoàn tiền đơn #${booking.booking_code}: ${reason}`, String(booking.id)]
      );
      const transactionId = txResult.insertId;

      // 6. Ghi bút toán sổ cái bất biến (Ledger Entry - Credit)
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'credit', ?, ?, ?)`,
        [transactionId, wallet.id, refundAmount, balanceAfter, `Hoàn tiền vào ví: ${reason}`]
      );

      // 7. Cập nhật đơn hàng
      await connection.query(
        `UPDATE bookings SET payment_status = 'refunded', status = 'cancelled', cancel_reason = ? WHERE id = ?`,
        [reason, booking.id]
      );

      await connection.commit();

      return {
        success: true,
        transaction_code: txnCode,
        refund_amount: refundAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        booking_id: booking.id
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // Lấy lịch sử giao dịch ví của một người dùng (hỗ trợ phân trang & lọc theo loại GD và loại ví)
  async getTransactions(userId, { type = null, wallet_type = null, limit = 20, offset = 0 } = {}) {
    const params = [userId];
    let sql = `
      SELECT t.*, w.wallet_type
      FROM wallet_transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE t.user_id = ?
    `;

    if (wallet_type && ['credit', 'earnings', 'customer'].includes(wallet_type)) {
      sql += ` AND w.wallet_type = ?`;
      params.push(wallet_type);
    }

    if (type && ['topup', 'payment', 'refund', 'adjustment', 'wage', 'commission_deduction', 'transfer', 'withdrawal'].includes(type)) {
      sql += ` AND t.type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY t.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 20);
    params.push(parseInt(offset, 10) || 0);

    const rows = await db.query(sql, params);

    // Đếm tổng số bản ghi phục vụ phân trang
    let countSql = `
      SELECT COUNT(*) AS total 
      FROM wallet_transactions t
      JOIN wallets w ON t.wallet_id = w.id
      WHERE t.user_id = ?
    `;
    const countParams = [userId];
    if (wallet_type && ['credit', 'earnings', 'customer'].includes(wallet_type)) {
      countSql += ` AND w.wallet_type = ?`;
      countParams.push(wallet_type);
    }
    if (type && ['topup', 'payment', 'refund', 'adjustment', 'wage', 'commission_deduction', 'transfer', 'withdrawal'].includes(type)) {
      countSql += ` AND t.type = ?`;
      countParams.push(type);
    }
    const countRows = await db.query(countSql, countParams);
    const total = countRows[0] ? parseInt(countRows[0].total, 10) : 0;

    return {
      transactions: rows,
      total,
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0
    };
  },

  // Lấy danh sách ví toàn hệ thống (Dành cho Admin)
  async getAllWalletsForAdmin() {
    return await db.query(`
      SELECT w.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.role AS user_role
      FROM wallets w
      LEFT JOIN users u ON w.user_id = u.id
      ORDER BY w.balance DESC, w.id ASC
    `);
  },

  // Lấy toàn bộ giao dịch ví toàn hệ thống (Dành cho Admin)
  async getAllTransactionsForAdmin({ type = null, limit = 50, offset = 0 } = {}) {
    const params = [];
    let sql = `
      SELECT t.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM wallet_transactions t
      LEFT JOIN users u ON t.user_id = u.id
    `;
    if (type && ['topup', 'payment', 'refund', 'adjustment', 'wage', 'withdrawal'].includes(type)) {
      sql += ` WHERE t.type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY t.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);

    return await db.query(sql, params);
  },

  /**
   * Kiểm tra điều kiện nhận đơn của nhân viên theo chính sách Ví Tín Dụng CleanNova:
   * Nhân viên được phép nhận đơn khi số dư ví tín dụng bằng hoặc lớn hơn 100.000 VNĐ.
   * Điều kiện bắt buộc: creditBalance >= 100000.
   */
  async checkStaffBookingEligibility(staffId) {
    const { creditWallet } = await this.getOrCreateStaffWallets(staffId);
    const creditBalance = parseFloat(creditWallet.balance) || 0;
    const minThreshold = STAFF_MIN_CREDIT_THRESHOLD;
    const isEligible = creditBalance >= minThreshold;
    const amountNeeded = isEligible ? 0 : Math.max(0, minThreshold - creditBalance);

    return {
      eligible: isEligible,
      creditBalance: creditBalance,
      credit_balance: creditBalance,
      minRequiredBalance: minThreshold,
      min_threshold: minThreshold,
      amountNeeded: amountNeeded,
      amount_needed: amountNeeded,
      message: isEligible
        ? 'Đủ điều kiện nhận đơn mới.'
        : `Chưa đủ điều kiện nhận đơn: Số dư ví tín dụng hiện tại (${creditBalance.toLocaleString('vi-VN')} đ) phải từ 100.000 VNĐ trở lên. Vui lòng nạp thêm tối thiểu ${amountNeeded.toLocaleString('vi-VN')} đ hoặc chuyển từ Ví thu nhập để đủ điều kiện.`
    };
  },

  /**
   * Lấy chi tiết thông tin Hai Ví Nhân Viên (Ví tín dụng & Ví thu nhập)
   */
  async getStaffWallets(staffId) {
    const { creditWallet, earningsWallet } = await this.getOrCreateStaffWallets(staffId);
    const creditBal = parseFloat(creditWallet.balance) || 0;
    const earningsBal = parseFloat(earningsWallet.balance) || 0;
    const isEligible = creditBal >= STAFF_MIN_CREDIT_THRESHOLD;
    const amountNeeded = isEligible ? 0 : Math.max(0, STAFF_MIN_CREDIT_THRESHOLD - creditBal);

    // Thống kê ví tín dụng: Tổng tiền đã nạp & Tổng chiết khấu đã trừ
    const cStats = await db.query(
      `SELECT 
        IFNULL(SUM(CASE WHEN type = 'topup' THEN amount ELSE 0 END), 0) AS total_deposited,
        IFNULL(SUM(CASE WHEN type = 'commission_deduction' THEN amount ELSE 0 END), 0) AS total_commission_deducted
       FROM wallet_transactions 
       WHERE wallet_id = ? AND status = 'completed'`,
      [creditWallet.id]
    );

    // Thống kê ví thu nhập: Tổng thù lao ròng, Tổng tiền đã rút, Tổng tiền chuyển sang ví tín dụng
    const eStats = await db.query(
      `SELECT 
        IFNULL(SUM(CASE WHEN type = 'wage' THEN amount ELSE 0 END), 0) AS total_net_wages_credited,
        IFNULL(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) AS total_withdrawn,
        IFNULL(SUM(CASE WHEN type = 'transfer' AND description LIKE '%Chuyển tiền%' THEN amount ELSE 0 END), 0) AS total_transferred_to_credit
       FROM wallet_transactions 
       WHERE wallet_id = ? AND status = 'completed'`,
      [earningsWallet.id]
    );

    // Thống kê đơn hàng hoàn thành
    const bStats = await db.query(
      `SELECT 
        IFNULL(SUM(CASE WHEN status = 'completed' THEN staff_wage ELSE 0 END), 0) AS total_gross_earnings,
        IFNULL(SUM(CASE WHEN status = 'completed' THEN staff_net_wage ELSE 0 END), 0) AS total_net_earnings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_jobs
       FROM bookings 
       WHERE staff_id = ?`,
      [staffId]
    );

    const creditData = (cStats && cStats[0]) || {};
    const earningsData = (eStats && eStats[0]) || {};
    const bookingData = (bStats && bStats[0]) || {};

    return {
      staff_id: staffId,
      credit_wallet: {
        id: creditWallet.id,
        wallet_type: 'credit',
        balance: creditBal,
        currency: 'VND',
        status: creditWallet.status,
        total_deposited: parseFloat(creditData.total_deposited) || 0,
        total_commission_deducted: parseFloat(creditData.total_commission_deducted) || 0,
        min_threshold: 100000,
        is_eligible: isEligible,
        amount_needed: amountNeeded
      },
      earnings_wallet: {
        id: earningsWallet.id,
        wallet_type: 'earnings',
        balance: earningsBal,
        currency: 'VND',
        status: earningsWallet.status,
        withdrawable_balance: earningsBal,
        total_gross_earnings: parseFloat(bookingData.total_gross_earnings) || 0,
        total_net_earnings: parseFloat(bookingData.total_net_earnings) || 0,
        total_withdrawn: parseFloat(earningsData.total_withdrawn) || 0,
        total_transferred_to_credit: parseFloat(earningsData.total_transferred_to_credit) || 0
      },
      is_eligible_for_booking: isEligible,
      min_booking_threshold: 100000,
      amount_needed: amountNeeded
    };
  },

  /**
   * Nạp tiền vào Ví Tín Dụng đối tác (Credit Wallet Topup)
   * Nếu số dư ví tín dụng đang âm, tiền nạp tự động bù khoản âm trước khi tạo số dư dương
   */
  async topupCreditWallet({ staffId, amount, idempotencyKey = null, description = 'Nạp tiền vào Ví tín dụng CleanNova', referenceType = 'sandbox_topup', referenceId = null }) {
    if (referenceType === 'sandbox_staff_credit' || referenceType === 'staff_direct') {
      const error = new Error('Chức năng nạp tiền chủ động vào Ví Tín Dụng đã bị vô hiệu hóa.');
      error.statusCode = 403;
      error.code = 'FEATURE_DISABLED';
      throw error;
    }
    const parsedAmount = Math.round(parseFloat(amount) || 0);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      const error = new Error('Số tiền nạp phải là số dương lớn hơn 0.');
      error.statusCode = 400;
      throw error;
    }
    if (parsedAmount > 50000000) {
      const error = new Error('Hạn mức mỗi lần nạp tối đa là 50.000.000 VNĐ.');
      error.statusCode = 400;
      throw error;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Kiểm tra Idempotency key chống nạp tiền lặp
      if (idempotencyKey) {
        const [existingTx] = await connection.query(
          'SELECT * FROM wallet_transactions WHERE idempotency_key = ? LIMIT 1',
          [idempotencyKey]
        );
        if (existingTx && existingTx.length > 0) {
          await connection.commit();
          const { creditWallet } = await this.getOrCreateStaffWallets(staffId);
          const creditBal = parseFloat(creditWallet.balance) || 0;
          return {
            success: true,
            isIdempotent: true,
            transaction: existingTx[0],
            credit_balance: creditBal,
            is_eligible: creditBal >= STAFF_MIN_CREDIT_THRESHOLD
          };
        }
      }

      // 2. Khóa dòng bản ghi ví tín dụng của nhân viên
      await this.getOrCreateWallet(staffId, connection, 'credit');
      const [wallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
        [staffId]
      );
      const wallet = wallets[0];
      if (wallet.status !== 'active') {
        const error = new Error('Ví tín dụng của bạn đang bị khóa hoặc tạm dừng giao dịch.');
        error.statusCode = 400;
        throw error;
      }

      // 3. Tính toán số dư mới: Tiền nạp bù số dư âm trước
      const balanceBefore = parseFloat(wallet.balance) || 0;
      const balanceAfter = balanceBefore + parsedAmount;

      // 4. Sinh mã giao dịch duy nhất
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-CRD-TOPUP-${dateStr}-${randomHex}`;

      // 5. Cập nhật số dư ví tín dụng
      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [balanceAfter, wallet.id]);

      // 6. Ghi log giao dịch ví
      const desc = description || `Nạp tiền Ví tín dụng (+${parsedAmount.toLocaleString('vi-VN')} đ)`;
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'topup', ?, ?, ?, 'completed', ?, ?, ?, ?)`,
        [txnCode, wallet.id, staffId, parsedAmount, balanceBefore, balanceAfter, desc, referenceType, referenceId, idempotencyKey]
      );
      const transactionId = txResult.insertId;

      // 7. Ghi bút toán sổ cái bất biến (Ledger Entry - Credit)
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'credit', ?, ?, ?)`,
        [transactionId, wallet.id, parsedAmount, balanceAfter, `Nạp tiền Ví tín dụng: ${desc}`]
      );

      await connection.commit();

      const isEligible = balanceAfter >= STAFF_MIN_CREDIT_THRESHOLD;
      return {
        success: true,
        transaction_code: txnCode,
        amount: parsedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        wallet_id: wallet.id,
        is_eligible: isEligible,
        amount_needed: isEligible ? 0 : Math.max(0, STAFF_MIN_CREDIT_THRESHOLD - balanceAfter)
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Chuyển tiền từ Ví Thu Nhập sang Ví Tín Dụng (Inter-wallet Transfer)
   * Kiểm tra số dư khả dụng, ghi nhận bút toán kép trong 1 transaction duy nhất,
   * rollback toàn bộ nếu có lỗi, và tuyệt đối không tạo doanh thu giả cho CleanNova.
   */
  async transferEarningsToCredit({ staffId, amount, idempotencyKey = null, note = null }) {
    const parsedAmount = Math.round(parseFloat(amount) || 0);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      const error = new Error('Số tiền chuyển sang Ví tín dụng phải lớn hơn 0 VNĐ.');
      error.statusCode = 400;
      throw error;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Kiểm tra Idempotency key nếu có
      if (idempotencyKey) {
        const [existingTx] = await connection.query(
          'SELECT * FROM wallet_transactions WHERE idempotency_key = ? LIMIT 1',
          [`${idempotencyKey}-OUT`]
        );
        if (existingTx && existingTx.length > 0) {
          await connection.commit();
          const wallets = await this.getStaffWallets(staffId);
          return {
            success: true,
            isIdempotent: true,
            ...wallets
          };
        }
      }

      // 2. Khóa dòng cả 2 ví của nhân viên
      await this.getOrCreateWallet(staffId, connection, 'earnings');
      await this.getOrCreateWallet(staffId, connection, 'credit');

      const [earningsWallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "earnings" FOR UPDATE',
        [staffId]
      );
      const [creditWallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
        [staffId]
      );

      const earningsWallet = earningsWallets[0];
      const creditWallet = creditWallets[0];

      if (earningsWallet.status !== 'active' || creditWallet.status !== 'active') {
        const error = new Error('Một trong hai ví của bạn đang bị khóa hoặc tạm dừng giao dịch.');
        error.statusCode = 400;
        throw error;
      }

      const earningsBefore = parseFloat(earningsWallet.balance) || 0;
      if (earningsBefore < parsedAmount) {
        const error = new Error(`Số dư khả dụng Ví thu nhập không đủ. Hiện có: ${earningsBefore.toLocaleString('vi-VN')} đ, yêu cầu chuyển: ${parsedAmount.toLocaleString('vi-VN')} đ.`);
        error.statusCode = 400;
        throw error;
      }

      const creditBefore = parseFloat(creditWallet.balance) || 0;
      const earningsAfter = earningsBefore - parsedAmount;
      const creditAfter = creditBefore + parsedAmount;

      // 3. Cập nhật số dư 2 ví
      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [earningsAfter, earningsWallet.id]);
      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [creditAfter, creditWallet.id]);

      // 4. Sinh mã giao dịch duy nhất dùng chung cho cặp bút toán
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const xferCode = `WTX-XFER-${dateStr}-${randomHex}`;

      const transferDesc = note || `Chuyển ${parsedAmount.toLocaleString('vi-VN')} đ từ Ví thu nhập sang Ví tín dụng`;

      // 5. Ghi log giao dịch trừ tiền ở Ví Thu Nhập (Outflow)
      const [txOut] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'transfer', ?, ?, ?, 'completed', ?, 'interwallet_transfer', ?, ?)`,
        [`${xferCode}-OUT`, earningsWallet.id, staffId, parsedAmount, earningsBefore, earningsAfter, transferDesc, String(creditWallet.id), idempotencyKey ? `${idempotencyKey}-OUT` : null]
      );

      // Bút toán sổ cái: Debit ví thu nhập
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'debit', ?, ?, ?)`,
        [txOut.insertId, earningsWallet.id, parsedAmount, earningsAfter, `Chuyển sang Ví tín dụng #${creditWallet.id}`]
      );

      // 6. Ghi log giao dịch cộng tiền ở Ví Tín Dụng (Inflow)
      const [txIn] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'transfer', ?, ?, ?, 'completed', ?, 'interwallet_transfer', ?, ?)`,
        [`${xferCode}-IN`, creditWallet.id, staffId, parsedAmount, creditBefore, creditAfter, transferDesc, String(earningsWallet.id), idempotencyKey ? `${idempotencyKey}-IN` : null]
      );

      // Bút toán sổ cái: Credit ví tín dụng
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'credit', ?, ?, ?)`,
        [txIn.insertId, creditWallet.id, parsedAmount, creditAfter, `Nhận từ Ví thu nhập #${earningsWallet.id}`]
      );

      await connection.commit();

      const isEligible = creditAfter >= STAFF_MIN_CREDIT_THRESHOLD;
      return {
        success: true,
        transaction_code: xferCode,
        amount_transferred: parsedAmount,
        earnings_balance: earningsAfter,
        credit_balance: creditAfter,
        is_eligible: isEligible,
        amount_needed: isEligible ? 0 : Math.max(0, STAFF_MIN_CREDIT_THRESHOLD - creditAfter)
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Quyết toán thù lao và chiết khấu hai ví nhân viên CleanNova:
   * 
   * Trường hợp A (Khách thanh toán tiền mặt):
   * - Nhân viên đã giữ trực tiếp toàn bộ tiền mặt từ khách.
   * - Ví tín dụng: Trừ khoản chiết khấu CleanNova (platform_commission). Cho phép âm số dư nếu không đủ.
   * - Ví thu nhập: KHÔNG thay đổi, tránh đúp thu nhập.
   * 
   * Trường hợp B (Khách thanh toán trực tuyến):
   * - CleanNova thu tiền khách hàng.
   * - Ví tín dụng: Trừ khoản chiết khấu CleanNova (platform_commission).
   * - Ví thu nhập: CỘNG thù lao thực nhận (staff_net_wage).
   * 
   * Đảm bảo tính Idempotency: Không trừ chiết khấu và không cộng thù lao 2 lần cho cùng một đơn.
   */
  async settleBookingCommissionAndWage({ bookingId, adminId = null, note = null }) {
    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Cơ sở dữ liệu MySQL hiện không khả dụng để xử lý quyết toán thù lao.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Khóa bản ghi đơn đặt lịch với FOR UPDATE
      const [bookings] = await connection.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [bookingId]
      );
      if (!bookings || bookings.length === 0) {
        const error = new Error('Không tìm thấy thông tin đơn đặt lịch.');
        error.statusCode = 404;
        throw error;
      }
      const booking = bookings[0];

      if (booking.status !== 'completed') {
        const error = new Error('Chỉ có thể quyết toán thù lao cho đơn hàng đã hoàn thành thực tế.');
        error.statusCode = 400;
        throw error;
      }

      // Kiểm tra tính Idempotency: Không xử lý 2 lần
      const [existingComm] = await connection.query(
        'SELECT id FROM wallet_transactions WHERE idempotency_key = ? LIMIT 1',
        [`COMMISSION-BOOKING-${booking.id}`]
      );
      if ((existingComm && existingComm.length > 0) || booking.wage_status === 'paid') {
        await connection.commit();
        return {
          success: true,
          isIdempotent: true,
          alreadySettled: true,
          booking_id: booking.id,
          booking_code: booking.booking_code
        };
      }

      if (!booking.staff_id) {
        const error = new Error('Đơn hàng chưa có nhân viên phụ trách được phân công.');
        error.statusCode = 400;
        throw error;
      }

      const grossWage = Math.max(0, Math.round(parseFloat(booking.staff_wage) || 0));
      if (grossWage <= 0) {
        const error = new Error('Tiền công nhân viên (Gross) của đơn hàng này không hợp lệ hoặc bằng 0 đ.');
        error.statusCode = 400;
        throw error;
      }

      // 2. Xác định tỷ lệ chiết khấu snapshot hoặc từ cấu hình hệ thống
      let commissionRate = booking.commission_rate !== undefined && booking.commission_rate !== null
        ? parseFloat(booking.commission_rate)
        : null;

      if (commissionRate === null || isNaN(commissionRate) || commissionRate <= 0) {
        const [sysConfigs] = await connection.query(
          "SELECT config_value FROM system_configs WHERE config_key = 'staff_commission_rate' LIMIT 1"
        );
        if (sysConfigs && sysConfigs.length > 0) {
          const cfg = typeof sysConfigs[0].config_value === 'string'
            ? JSON.parse(sysConfigs[0].config_value)
            : sysConfigs[0].config_value;
          commissionRate = parseFloat(cfg.rate);
        }
        if (isNaN(commissionRate) || commissionRate < 0) commissionRate = 0.20;
      }

      const platformCommission = Math.min(grossWage, Math.round(grossWage * commissionRate));
      const netWage = Math.max(0, grossWage - platformCommission);
      const isCashPayment = booking.payment_method === 'cash';

      // 3. Khóa dòng cả 2 ví của nhân viên
      await this.getOrCreateWallet(booking.staff_id, connection, 'credit');
      await this.getOrCreateWallet(booking.staff_id, connection, 'earnings');

      const [creditWallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
        [booking.staff_id]
      );
      const [earningsWallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "earnings" FOR UPDATE',
        [booking.staff_id]
      );

      const creditWallet = creditWallets[0];
      const earningsWallet = earningsWallets[0];

      if (creditWallet.status !== 'active' || earningsWallet.status !== 'active') {
        const error = new Error('Ví của nhân viên đang bị khóa hoặc tạm dừng giao dịch.');
        error.statusCode = 400;
        throw error;
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();

      // 4. BƯỚC 1: Trừ chiết khấu từ Ví Tín Dụng (Áp dụng cho CẢ ĐƠN TIỀN MẶT và TRỰC TUYẾN)
      // NẾU CHIẾT KHẤU ĐÃ ĐƯỢC THU TRƯỚC ĐÓ KHI NHẬN ĐƠN (commission_status === 'paid'),
      // KHÔNG ĐƯỢC TRỪ TIẾP LẦN HAI ĐỂ BẢO ĐẢM NGUYÊN TẮC KHÔNG TRỪ TIỀN TRÙNG LẶP.
      const creditBefore = parseFloat(creditWallet.balance) || 0;
      let creditAfter = creditBefore;
      let txCommId = null;

      if (booking.commission_status === 'paid') {
        // Chiết khấu đã được thanh toán từ trước (bằng trừ ví lúc nhận ca hoặc chuyển khoản ngân hàng)
        // Bỏ qua bước trừ ví tín dụng tại đây
      } else {
        // Áp dụng cho các đơn cũ chưa thu chiết khấu lúc nhận việc
        creditAfter = creditBefore - platformCommission;
        await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [creditAfter, creditWallet.id]);

        const commTxnCode = `WTX-COMM-${dateStr}-${randomHex}`;
        const commDesc = `Khấu trừ chiết khấu DabClean đơn #${booking.booking_code} (${Math.round(commissionRate * 100)}% của ${grossWage.toLocaleString('vi-VN')} đ)`;
        const [txComm] = await connection.query(
          `INSERT INTO wallet_transactions 
           (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
           VALUES (?, ?, ?, 'commission_deduction', ?, ?, ?, 'completed', ?, 'booking', ?, ?)`,
          [commTxnCode, creditWallet.id, booking.staff_id, platformCommission, creditBefore, creditAfter, commDesc, String(booking.id), `COMMISSION-BOOKING-${booking.id}`]
        );
        txCommId = txComm.insertId;

        await connection.query(
          `INSERT INTO wallet_ledger_entries 
           (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
           VALUES (?, ?, 'debit', ?, ?, ?)`,
          [txCommId, creditWallet.id, platformCommission, creditAfter, `Khấu trừ chiết khấu DabClean đơn #${booking.booking_code}`]
        );
      }

      // 5. BƯỚC 2: Xử lý Ví Thu Nhập theo phương thức thanh toán
      let earningsBefore = parseFloat(earningsWallet.balance) || 0;
      let earningsAfter = earningsBefore;
      let wageTxnCode = null;

      if (!isCashPayment) {
        // TRƯỜNG HỢP B: Đơn trực tuyến (CleanNova thu tiền) -> Cộng phần thực nhận vào Ví Thu Nhập
        earningsAfter = earningsBefore + netWage;
        await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [earningsAfter, earningsWallet.id]);

        wageTxnCode = `WTX-WAGE-${dateStr}-${randomHex}`;
        const wageDesc = `Thù lao thực nhận đơn #${booking.booking_code} (Khách trả trực tuyến)`;
        const [txWage] = await connection.query(
          `INSERT INTO wallet_transactions 
           (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
           VALUES (?, ?, ?, 'wage', ?, ?, ?, 'completed', ?, 'booking', ?, ?)`,
          [wageTxnCode, earningsWallet.id, booking.staff_id, netWage, earningsBefore, earningsAfter, wageDesc, String(booking.id), `WAGE-BOOKING-${booking.id}`]
        );

        await connection.query(
          `INSERT INTO wallet_ledger_entries 
           (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
           VALUES (?, ?, 'credit', ?, ?, ?)`,
          [txWage.insertId, earningsWallet.id, netWage, earningsAfter, `Cộng thù lao thực nhận: đơn #${booking.booking_code}`]
        );
      } else {
        // TRƯỜNG HỢP A: Đơn tiền mặt -> Khách trả trực tiếp cho thợ, thợ giữ tiền mặt, Ví Thu Nhập KHÔNG thay đổi
      }

      // 6. Cập nhật trạng thái đơn đặt lịch
      const effectiveAdminId = adminId || booking.staff_id;
      await connection.query(
        `UPDATE bookings 
         SET wage_status = 'paid',
             wage_settled_at = NOW(),
             wage_settled_by = ?,
             commission_rate = ?,
             platform_commission = ?,
             staff_net_wage = ?
         WHERE id = ?`,
        [effectiveAdminId, commissionRate, platformCommission, netWage, booking.id]
      );

      // 7. Ghi staff_payout_logs để phục vụ kiểm toán tài chính
      const isAlreadyPaid = booking.commission_status === 'paid';
      const payoutNote = note || (isAlreadyPaid
        ? (isCashPayment
            ? `Đơn tiền mặt: Chiết khấu đã thu trước khi nhận việc (${platformCommission.toLocaleString('vi-VN')} đ)`
            : `Đơn trực tuyến: Chiết khấu đã thu trước, Cộng thù lao ${netWage.toLocaleString('vi-VN')} đ (Thu nhập)`)
        : (isCashPayment 
            ? `Đơn tiền mặt: Trừ chiết khấu ${platformCommission.toLocaleString('vi-VN')} đ từ Ví tín dụng`
            : `Đơn trực tuyến: Trừ chiết khấu ${platformCommission.toLocaleString('vi-VN')} đ (Tín dụng), Cộng thù lao ${netWage.toLocaleString('vi-VN')} đ (Thu nhập)`));
      
      await connection.query(
        `INSERT INTO staff_payout_logs 
         (booking_id, staff_id, admin_id, gross_wage, commission_rate, platform_commission, net_wage, amount, action, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pay', ?)`,
        [booking.id, booking.staff_id, effectiveAdminId, grossWage, commissionRate, platformCommission, netWage, isCashPayment ? 0 : netWage, payoutNote]
      );

      // 8. Ghi audit log
      await connection.query(
        `INSERT INTO audit_logs (admin_id, action, target_id, target_type, details)
         VALUES (?, 'SETTLE_STAFF_TWO_WALLETS', ?, 'booking', ?)`,
        [
          effectiveAdminId,
          booking.id,
          `Quyết toán 2 ví đơn #${booking.booking_code}: PT thanh toán ${booking.payment_method}. Tiền công gộp ${grossWage.toLocaleString('vi-VN')} đ, Chiết khấu trừ Ví tín dụng: ${platformCommission.toLocaleString('vi-VN')} đ (Số dư TD mới: ${creditAfter.toLocaleString('vi-VN')} đ). ${isCashPayment ? 'Khách trả tiền mặt: Giữ nguyên ví thu nhập.' : `Cộng ví thu nhập: ${netWage.toLocaleString('vi-VN')} đ (Số dư TN mới: ${earningsAfter.toLocaleString('vi-VN')} đ).`}`
        ]
      );

      await connection.commit();

      return {
        success: true,
        booking_id: booking.id,
        booking_code: booking.booking_code,
        payment_method: booking.payment_method,
        gross_wage: grossWage,
        commission_rate: commissionRate,
        platform_commission: platformCommission,
        net_wage: netWage,
        credit_balance_before: creditBefore,
        credit_balance_after: creditAfter,
        earnings_balance_before: earningsBefore,
        earnings_balance_after: earningsAfter,
        is_eligible_for_booking: creditAfter >= STAFF_MIN_CREDIT_THRESHOLD
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Alias: Quyết toán thù lao đơn đặt lịch (tương thích các controller hiện có)
   */
  async payoutWage({ bookingId, adminId, note = null }) {
    return await this.settleBookingCommissionAndWage({ bookingId, adminId, note });
  },

  /**
   * Rút tiền từ ví về tài khoản ngân hàng (Staff rút từ Ví Thu Nhập / Customer rút từ Ví Khách)
   */
  async withdraw({ userId, amount, bankName, accountNumber, accountName, note = null }) {
    const parsedAmount = Math.round(parseFloat(amount) || 0);
    if (parsedAmount < 50000) {
      const error = new Error('Số tiền rút tối thiểu mỗi lần là 50.000 VNĐ.');
      error.statusCode = 400;
      throw error;
    }

    if (!bankName || !accountNumber || !accountName) {
      const error = new Error('Vui lòng cung cấp đầy đủ thông tin ngân hàng: Tên ngân hàng, Số tài khoản và Tên chủ tài khoản.');
      error.statusCode = 400;
      throw error;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      throw new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý yêu cầu rút tiền.');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Xác định loại ví: Nếu là Staff -> rút từ 'earnings'; nếu là Customer -> rút từ 'customer'
      const [users] = await connection.query('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
      const userRole = users && users[0] ? users[0].role : 'customer';
      const targetType = userRole === 'staff' ? 'earnings' : 'customer';

      await this.getOrCreateWallet(userId, connection, targetType);
      const [wallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = ? FOR UPDATE',
        [userId, targetType]
      );
      const wallet = wallets[0];
      if (wallet.status !== 'active') {
        const error = new Error('Ví của bạn đang bị khóa hoặc tạm dừng giao dịch.');
        error.statusCode = 400;
        throw error;
      }

      const balanceBefore = parseFloat(wallet.balance) || 0;
      if (balanceBefore < parsedAmount) {
        const error = new Error(`Số dư khả dụng không đủ. Số dư hiện có: ${balanceBefore.toLocaleString('vi-VN')} đ, số tiền yêu cầu rút: ${parsedAmount.toLocaleString('vi-VN')} đ.`);
        error.statusCode = 400;
        throw error;
      }

      const balanceAfter = balanceBefore - parsedAmount;

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-WD-${dateStr}-${randomHex}`;

      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [balanceAfter, wallet.id]);

      const desc = `Rút tiền về ${bankName} (${accountNumber} - ${String(accountName).toUpperCase()})`;
      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id)
         VALUES (?, ?, ?, 'withdrawal', ?, ?, ?, 'completed', ?, 'bank_payout', ?)`,
        [txnCode, wallet.id, userId, parsedAmount, balanceBefore, balanceAfter, desc, accountNumber]
      );

      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'debit', ?, ?, ?)`,
        [txResult.insertId, wallet.id, parsedAmount, balanceAfter, `Khấu trừ số dư rút tiền: ${desc}`]
      );

      await connection.commit();

      return {
        success: true,
        transaction_code: txnCode,
        amount: parsedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        wallet_type: targetType,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Lấy tổng quan thù lao & 2 ví của nhân viên
   */
  async getStaffWageSummary(staffId) {
    const twoWallets = await this.getStaffWallets(staffId);
    const earningsBal = twoWallets.earnings_wallet.balance;
    const creditBal = twoWallets.credit_wallet.balance;

    const statsRows = await db.query(
      `SELECT 
        IFNULL(SUM(CASE WHEN b.status = 'completed' THEN b.staff_wage ELSE 0 END), 0) AS gross_earnings,
        IFNULL(SUM(CASE WHEN b.status = 'completed' THEN b.platform_commission ELSE 0 END), 0) AS commission_deducted,
        IFNULL(SUM(CASE WHEN b.wage_status = 'paid' THEN b.staff_net_wage ELSE 0 END), 0) AS net_earnings_paid,
        IFNULL(SUM(CASE WHEN b.status = 'completed' AND b.wage_status IN ('pending', 'approved') THEN b.staff_net_wage ELSE 0 END), 0) AS pending_wages,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) AS completed_jobs_count,
        COUNT(CASE WHEN b.wage_status = 'paid' THEN 1 END) AS paid_jobs_count
       FROM bookings b
       WHERE b.staff_id = ?`,
      [staffId]
    );

    const stats = (statsRows && statsRows[0]) || {};

    const bookingList = await db.query(
      `SELECT b.id, b.booking_code, b.booking_date, b.booking_time, b.status, b.wage_status,
              b.payment_method, b.payment_status,
              b.staff_wage, b.commission_rate, b.platform_commission, b.staff_net_wage,
              b.wage_settled_at, s.name AS service_name, s.icon AS service_icon
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.staff_id = ?
       ORDER BY b.id DESC
       LIMIT 50`,
      [staffId]
    );

    const txResult = await this.getTransactions(staffId, { limit: 30 });

    const summaryData = {
      gross_earnings: parseFloat(stats.gross_earnings) || 0,
      commission_deducted: parseFloat(stats.commission_deducted) || 0,
      net_earnings: parseFloat(stats.net_earnings_paid) || 0,
      net_earnings_paid: parseFloat(stats.net_earnings_paid) || 0,
      pending_wages: parseFloat(stats.pending_wages) || 0,
      completed_jobs_count: parseInt(stats.completed_jobs_count, 10) || 0,
      paid_jobs_count: parseInt(stats.paid_jobs_count, 10) || 0
    };

    return {
      wallet: twoWallets.earnings_wallet,
      credit_wallet: twoWallets.credit_wallet,
      earnings_wallet: twoWallets.earnings_wallet,
      available_balance: earningsBal,
      credit_balance: creditBal,
      is_eligible_for_booking: twoWallets.is_eligible_for_booking,
      min_booking_threshold: 100000,
      amount_needed: twoWallets.amount_needed,
      summary: summaryData,
      ...summaryData,
      bookings: bookingList || [],
      transactions: txResult.transactions || []
    };
  },

  /**
   * Lấy danh sách ví đối tác toàn hệ thống phục vụ Admin Dashboard đối soát
   */
  async getAllStaffWalletsForAdmin() {
    return await db.query(`
      SELECT 
        u.id AS staff_id,
        u.name,
        u.email,
        u.phone,
        u.status AS user_status,
        IFNULL(cw.id, 0) AS credit_wallet_id,
        IFNULL(cw.balance, 0) AS credit_balance,
        IFNULL(ew.id, 0) AS earnings_wallet_id,
        IFNULL(ew.balance, 0) AS earnings_balance,
        CASE WHEN IFNULL(cw.balance, 0) >= 100000 THEN 1 ELSE 0 END AS is_eligible,
        CASE WHEN IFNULL(cw.balance, 0) < 0 THEN ABS(cw.balance) ELSE 0 END AS credit_debt,
        IFNULL((
          SELECT SUM(staff_wage) FROM bookings 
          WHERE staff_id = u.id AND (status = 'completed' OR wage_status = 'paid')
        ), 0) AS total_gross_wages,
        IFNULL((
          SELECT SUM(amount) FROM wallet_transactions 
          WHERE wallet_id = cw.id AND type = 'commission_deduction' AND status = 'completed'
        ), 0) AS total_commission_deducted,
        IFNULL((
          SELECT SUM(amount) FROM wallet_transactions 
          WHERE wallet_id = cw.id AND type = 'topup' AND reference_type = 'credit_topup' AND status = 'completed'
        ), 0) AS total_credit_topup,
        IFNULL((
          SELECT SUM(amount) FROM wallet_transactions 
          WHERE user_id = u.id AND type = 'withdrawal' AND status = 'completed'
        ), 0) AS total_withdrawn
      FROM users u
      LEFT JOIN wallets cw ON u.id = cw.user_id AND cw.wallet_type = 'credit'
      LEFT JOIN wallets ew ON u.id = ew.user_id AND ew.wallet_type = 'earnings'
      WHERE u.role = 'staff'
      ORDER BY cw.balance ASC, u.id ASC
    `);
  }
};

WalletModel.STAFF_MIN_CREDIT_THRESHOLD = STAFF_MIN_CREDIT_THRESHOLD;

module.exports = WalletModel;
