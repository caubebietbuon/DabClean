// ============================================================
// CLEANOVA BACKEND - Wallet Model (Ví CleanNova & Double-Entry Ledger)
// ============================================================
const crypto = require('crypto');
const db = require('../config/db');

const WalletModel = {
  // Lấy hoặc tạo ví cho người dùng
  async getOrCreateWallet(userId, externalConn = null) {
    const executor = externalConn || db;
    let rows;
    if (externalConn) {
      const [r] = await externalConn.query('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
      rows = r;
    } else {
      rows = await db.query('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
    }

    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Nếu chưa có, tạo mới
    if (externalConn) {
      await externalConn.query(
        'INSERT IGNORE INTO wallets (user_id, balance, currency, status) VALUES (?, 0.00, "VND", "active")',
        [userId]
      );
      const [newRows] = await externalConn.query('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
      return newRows[0];
    } else {
      await db.query(
        'INSERT IGNORE INTO wallets (user_id, balance, currency, status) VALUES (?, 0.00, "VND", "active")',
        [userId]
      );
      const newRows = await db.query('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
      return newRows[0];
    }
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
    if (pool && db.isMySQLConnected()) {
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
    }

    // Fallback nếu chạy test in-memory
    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = parseFloat(wallet.balance) || 0;
    const balanceAfter = balanceBefore + parsedAmount;
    wallet.balance = balanceAfter;
    return {
      success: true,
      amount: parsedAmount,
      balance_before: balanceBefore,
      balance_after: balanceAfter
    };
  },

  /**
   * Thanh toán đơn hàng bằng Ví CleanNova (Atomic Deduction)
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
        const error = new Error(`Số dư Ví CleanNova không đủ. Số dư hiện có: ${Math.round(currentBalance).toLocaleString('vi-VN')} đ, cần thanh toán: ${Math.round(amountToPay).toLocaleString('vi-VN')} đ.`);
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
   * Hoàn tiền đơn hàng vào Ví CleanNova (Atomic Refund)
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
        throw new Error('Đơn đặt lịch này đã được hoàn tiền trước đó.');
      }
      if (booking.payment_status !== 'paid') {
        throw new Error('Chỉ có thể hoàn tiền cho đơn đã thanh toán thành công.');
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

  // Lấy lịch sử giao dịch ví của một người dùng (hỗ trợ phân trang & lọc)
  async getTransactions(userId, { type = null, limit = 20, offset = 0 } = {}) {
    const params = [userId];
    let sql = `SELECT * FROM wallet_transactions WHERE user_id = ?`;

    if (type && ['topup', 'payment', 'refund', 'adjustment'].includes(type)) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 20);
    params.push(parseInt(offset, 10) || 0);

    const rows = await db.query(sql, params);

    // Đếm tổng số bản ghi phục vụ phân trang
    let countSql = `SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = ?`;
    const countParams = [userId];
    if (type && ['topup', 'payment', 'refund', 'adjustment'].includes(type)) {
      countSql += ` AND type = ?`;
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
    if (type && ['topup', 'payment', 'refund', 'adjustment'].includes(type)) {
      sql += ` WHERE t.type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY t.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);

    return await db.query(sql, params);
  }
};

module.exports = WalletModel;
