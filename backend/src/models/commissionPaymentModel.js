// ============================================================
// DABCLEAN BACKEND - Commission Payment Model (Mô hình Thanh Toán Chiết Khấu Nhận Ca)
// ============================================================
const crypto = require('crypto');
const db = require('../config/db');
const WalletModel = require('./walletModel');
const BookingModel = require('./bookingModel');
const UserModel = require('./userModel');

const BANK_INFO = {
  bank_name: 'MB Bank (Ngân hàng Quân Đội)',
  bank_account_number: '0912345678',
  bank_account_name: 'CONG TY DABCLEAN VIET NAM'
};

const CommissionPaymentModel = {
  BANK_INFO,

  /**
   * Khởi tạo yêu cầu nhận ca & thanh toán chiết khấu
   * Case A: Ví tín dụng đủ tiền -> trừ ví ngay và phân công đơn (status: confirmed)
   * Case B: Ví tín dụng không đủ tiền -> tạo yêu cầu chuyển khoản pending, đơn chưa được nhận
   */
  async initiatePayment({ bookingId, staffId, paymentMethod = 'wallet', idempotencyKey = null }) {
    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      const err = new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý nhận ca và chiết khấu.');
      err.statusCode = 503;
      throw err;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Khóa và kiểm tra thông tin đơn đặt lịch (FOR UPDATE)
      const [bookings] = await connection.query(
        `SELECT b.*, s.name AS service_name, s.icon AS service_icon,
                u.name AS customer_name, u.phone AS customer_phone, u.address AS customer_address
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN users u ON b.user_id = u.id
         WHERE b.id = ? FOR UPDATE`,
        [bookingId]
      );

      if (!bookings || bookings.length === 0) {
        const error = new Error('Không tìm thấy thông tin đơn đặt lịch này.');
        error.statusCode = 404;
        throw error;
      }
      const booking = bookings[0];

      // 2. Kiểm tra tính khả dụng của đơn
      if (booking.status === 'cancelled') {
        const error = new Error('Thao tác bị từ chối: Đơn đặt lịch này đã bị hủy.');
        error.statusCode = 409;
        throw error;
      }
      if (booking.status === 'completed') {
        const error = new Error('Thao tác bị từ chối: Đơn đặt lịch này đã hoàn thành.');
        error.statusCode = 409;
        throw error;
      }

      // Đơn đã được xác nhận hoặc đang làm
      if (['confirmed', 'arrived', 'in_progress'].includes(booking.status)) {
        if (booking.staff_id === staffId) {
          // Idempotent: Chính nhân viên này đã nhận và thanh toán đơn này rồi
          await connection.commit();
          return {
            success: true,
            isIdempotent: true,
            requires_bank_transfer: false,
            message: `Bạn đã nhận và thanh toán chiết khấu cho đơn #${booking.booking_code} trước đó.`,
            data: {
              booking_id: booking.id,
              booking_code: booking.booking_code,
              status: booking.status,
              commission_amount: parseFloat(booking.platform_commission) || 0
            }
          };
        } else {
          const error = new Error('Đơn hàng này đã được nhân viên khác tiếp nhận.');
          error.statusCode = 409;
          throw error;
        }
      }

      // Nếu đơn đang được phân công (assigned) cho một nhân viên khác
      if (booking.status === 'assigned' && booking.staff_id && booking.staff_id !== staffId) {
        const error = new Error('Đơn hàng này đang được phân công cho nhân viên khác.');
        error.statusCode = 409;
        throw error;
      }

      // 3. Tính toán khoản chiết khấu từ nguồn dữ liệu backend đáng tin cậy
      const totalPrice = Math.max(0, Math.round(parseFloat(booking.total_price) || 0));
      const grossWage = Math.max(0, Math.round(parseFloat(booking.staff_wage) || (totalPrice * 0.8) || 0));
      const commissionRate = booking.commission_rate ? parseFloat(booking.commission_rate) : 0.20;
      let commissionAmount = Math.max(
        0,
        Math.round(parseFloat(booking.platform_commission) || (grossWage * commissionRate) || (totalPrice * 0.20))
      );
      if (commissionAmount <= 0 && totalPrice > 0) {
        commissionAmount = Math.round(totalPrice * 0.20);
      }

      if (commissionAmount <= 0) {
        const error = new Error('Khoản chiết khấu của đơn hàng không hợp lệ (bằng 0 đ).');
        error.statusCode = 400;
        throw error;
      }

      // 4. Khóa dòng ví tín dụng của nhân viên (FOR UPDATE)
      await WalletModel.getOrCreateWallet(staffId, connection, 'credit');
      const [creditWallets] = await connection.query(
        'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
        [staffId]
      );
      const creditWallet = creditWallets[0];

      if (creditWallet.status !== 'active') {
        const error = new Error('Ví tín dụng của bạn đang bị khóa hoặc tạm dừng giao dịch.');
        error.statusCode = 400;
        throw error;
      }

      const creditBalance = parseFloat(creditWallet.balance) || 0;
      const prefersBankTransfer = paymentMethod === 'bank_transfer';
      const isWalletInsufficient = creditBalance < commissionAmount;

      // ============================================================
      // TRƯỜNG HỢP B: VÍ TÍN DỤNG THIẾU TIỀN HOẶC CHỌN CHUYỂN KHOẢN
      // ============================================================
      if (prefersBankTransfer || isWalletInsufficient) {
        // Kiểm tra xem đã có yêu cầu thanh toán chuyển khoản pending cho đơn này chưa
        const [existingPending] = await connection.query(
          `SELECT * FROM staff_commission_payments 
           WHERE booking_id = ? AND staff_id = ? AND status = 'pending' 
           LIMIT 1`,
          [booking.id, staffId]
        );

        let paymentRecord = null;
        if (existingPending && existingPending.length > 0) {
          paymentRecord = existingPending[0];
        } else {
          // Tạo yêu cầu thanh toán chuyển khoản mới
          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
          const paymentCode = `CPAY-${dateStr}-${randomHex}`;
          const refCode = `DABCOMM${booking.id}S${staffId}${randomHex.slice(-4)}`;

          const [insResult] = await connection.query(
            `INSERT INTO staff_commission_payments 
             (payment_code, booking_id, staff_id, amount, payment_method, status, reference_code, bank_name, bank_account_number, bank_account_name, idempotency_key)
             VALUES (?, ?, ?, ?, 'bank_transfer', 'pending', ?, ?, ?, ?, ?)`,
            [
              paymentCode,
              booking.id,
              staffId,
              commissionAmount,
              refCode,
              BANK_INFO.bank_name,
              BANK_INFO.bank_account_number,
              BANK_INFO.bank_account_name,
              idempotencyKey || `COMM-PENDING-${booking.id}-${staffId}-${dateStr}`
            ]
          );

          paymentRecord = {
            id: insResult.insertId,
            payment_code: paymentCode,
            booking_id: booking.id,
            staff_id: staffId,
            amount: commissionAmount,
            payment_method: 'bank_transfer',
            status: 'pending',
            reference_code: refCode,
            bank_name: BANK_INFO.bank_name,
            bank_account_number: BANK_INFO.bank_account_number,
            bank_account_name: BANK_INFO.bank_account_name
          };
        }

        // Đơn hàng VẪN GIỮ NGUYÊN trạng thái hiện tại (pending hoặc assigned), KHÔNG chuyển confirmed
        await connection.commit();

        return {
          success: true,
          requires_bank_transfer: true,
          message: `Số dư ví tín dụng hiện tại (${creditBalance.toLocaleString('vi-VN')} đ) không đủ để thanh toán chiết khấu (${commissionAmount.toLocaleString('vi-VN')} đ). Vui lòng chuyển khoản ngân hàng theo hướng dẫn để hoàn tất nhận ca.`,
          data: {
            booking_id: booking.id,
            booking_code: booking.booking_code,
            commission_amount: commissionAmount,
            credit_balance: creditBalance,
            payment: {
              id: paymentRecord.id,
              payment_code: paymentRecord.payment_code,
              reference_code: paymentRecord.reference_code,
              amount: commissionAmount,
              status: 'pending',
              bank_name: paymentRecord.bank_name,
              account_number: paymentRecord.bank_account_number,
              account_name: paymentRecord.bank_account_name,
              transfer_content: paymentRecord.reference_code,
              qr_url: `https://img.vietqr.io/image/MB-${paymentRecord.bank_account_number}-compact2.png?amount=${commissionAmount}&addInfo=${encodeURIComponent(paymentRecord.reference_code)}&accountName=${encodeURIComponent(paymentRecord.bank_account_name)}`
            }
          }
        };
      }

      // ============================================================
      // TRƯỜNG HỢP A: VÍ TÍN DỤNG ĐỦ TIỀN -> TRỪ VÍ & XÁC NHẬN NHẬN ĐƠN
      // ============================================================
      const balanceBefore = creditBalance;
      const balanceAfter = balanceBefore - commissionAmount;

      // 4.1. Trừ số dư ví tín dụng
      await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [balanceAfter, creditWallet.id]);

      // 4.2. Ghi nhật ký giao dịch ví (wallet_transactions)
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
      const txnCode = `WTX-COMM-${dateStr}-${randomHex}`;
      const commDesc = `Khấu trừ chiết khấu nhận đơn #${booking.booking_code} (${commissionAmount.toLocaleString('vi-VN')} đ)`;

      const [txResult] = await connection.query(
        `INSERT INTO wallet_transactions 
         (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id, idempotency_key)
         VALUES (?, ?, ?, 'commission_deduction', ?, ?, ?, 'completed', ?, 'booking', ?, ?)`,
        [
          txnCode,
          creditWallet.id,
          staffId,
          commissionAmount,
          balanceBefore,
          balanceAfter,
          commDesc,
          String(booking.id),
          idempotencyKey || `COMM-WALLET-ACCEPT-${booking.id}-${staffId}`
        ]
      );

      // 4.3. Ghi bút toán sổ cái bất biến (wallet_ledger_entries)
      await connection.query(
        `INSERT INTO wallet_ledger_entries 
         (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
         VALUES (?, ?, 'debit', ?, ?, ?)`,
        [
          txResult.insertId,
          creditWallet.id,
          commissionAmount,
          balanceAfter,
          `Khấu trừ chiết khấu nhận ca: đơn #${booking.booking_code}`
        ]
      );

      // 4.4. Tạo bản ghi thanh toán chiết khấu (staff_commission_payments)
      const paymentCode = `CPAY-${dateStr}-${randomHex}`;
      const refCode = `DABCOMM${booking.id}S${staffId}W${randomHex.slice(-3)}`;

      const [paymentInsert] = await connection.query(
        `INSERT INTO staff_commission_payments 
         (payment_code, booking_id, staff_id, amount, payment_method, status, reference_code, bank_name, bank_account_number, bank_account_name, paid_at, idempotency_key)
         VALUES (?, ?, ?, ?, 'wallet', 'completed', ?, ?, ?, ?, NOW(), ?)`,
        [
          paymentCode,
          booking.id,
          staffId,
          commissionAmount,
          refCode,
          'Ví Tín Dụng DabClean',
          'WALLET_DEDUCTION',
          'CONG TY DABCLEAN VIET NAM',
          idempotencyKey || `COMM-CPAY-WALLET-${booking.id}-${staffId}`
        ]
      );
      const paymentId = paymentInsert.insertId;

      // 4.5. Xác nhận phân công và chuyển trạng thái đơn hàng sang 'confirmed'
      await connection.query(
        `UPDATE bookings 
         SET status = 'confirmed',
             staff_id = ?,
             assigned_at = COALESCE(assigned_at, NOW()),
             commission_status = 'paid',
             commission_payment_id = ?,
             commission_paid_at = NOW(),
             commission_payment_method = 'wallet'
         WHERE id = ?`,
        [staffId, paymentId, booking.id]
      );

      // 4.6. Tạo thông báo cho khách hàng
      const [staffUsers] = await connection.query('SELECT name, phone FROM users WHERE id = ? LIMIT 1', [staffId]);
      const staffInfo = staffUsers && staffUsers[0] ? staffUsers[0] : {};
      const bookingDate = booking.booking_date instanceof Date
        ? booking.booking_date.toISOString().slice(0, 10)
        : String(booking.booking_date).slice(0, 10);
      const bookingTime = String(booking.booking_time || '').slice(0, 5);

      await connection.query(
        `INSERT IGNORE INTO booking_notifications
         (user_id, booking_id, notification_type, title, message, data)
         VALUES (?, ?, 'staff_accepted_booking', ?, ?, ?)`,
        [
          booking.user_id,
          booking.id,
          `Nhân viên đã nhận đơn ${booking.booking_code}`,
          `${staffInfo.name || 'Nhân viên DabClean'} đã thanh toán chiết khấu và nhận đơn ${booking.booking_code} cho dịch vụ ${booking.service_name || 'vệ sinh'}, lịch ${bookingTime} ngày ${bookingDate}.`,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            staffName: staffInfo.name,
            staffPhone: staffInfo.phone
          })
        ]
      );

      // 4.7. Ghi audit log
      await connection.query(
        `INSERT INTO audit_logs (admin_id, action, target_id, target_type, details)
         VALUES (?, 'STAFF_ACCEPT_BOOKING_WALLET', ?, 'booking', ?)`,
        [
          staffId,
          booking.id,
          `Nhân viên #${staffId} (${staffInfo.name}) thanh toán chiết khấu ${commissionAmount.toLocaleString('vi-VN')} đ từ Ví tín dụng và nhận đơn #${booking.booking_code}. Số dư ví mới: ${balanceAfter.toLocaleString('vi-VN')} đ.`
        ]
      );

      await connection.commit();

      return {
        success: true,
        requires_bank_transfer: false,
        message: `Thanh toán chiết khấu thành công từ Ví Tín Dụng. Đã xác nhận nhận ca làm việc #${booking.booking_code}.`,
        data: {
          booking_id: booking.id,
          booking_code: booking.booking_code,
          status: 'confirmed',
          commission_amount: commissionAmount,
          credit_balance_before: balanceBefore,
          credit_balance_after: balanceAfter,
          payment_method: 'wallet',
          payment_id: paymentId
        }
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Xác minh thanh toán chuyển khoản ngân hàng (Webhook / Admin xác nhận thủ công)
   */
  async verifyBankTransfer({ referenceCode, amount, transactionId = null, verifiedBy = null, note = null }) {
    if (!referenceCode || typeof referenceCode !== 'string') {
      const err = new Error('Mã tham chiếu chuyển khoản không hợp lệ.');
      err.statusCode = 400;
      throw err;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      const err = new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng.');
      err.statusCode = 503;
      throw err;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Khóa bản ghi yêu cầu thanh toán chiết khấu
      const [payments] = await connection.query(
        'SELECT * FROM staff_commission_payments WHERE reference_code = ? FOR UPDATE',
        [referenceCode.trim()]
      );

      if (!payments || payments.length === 0) {
        const err = new Error(`Không tìm thấy yêu cầu thanh toán chiết khấu với mã tham chiếu "${referenceCode}".`);
        err.statusCode = 404;
        throw err;
      }
      const payment = payments[0];

      // 2. Chống xử lý trùng lặp (Idempotent)
      if (payment.status === 'completed') {
        await connection.commit();
        return {
          success: true,
          isIdempotent: true,
          message: 'Giao dịch chuyển khoản này đã được xác nhận thành công trước đó.',
          data: {
            payment_id: payment.id,
            booking_id: payment.booking_id,
            status: 'completed'
          }
        };
      }

      // 3. Kiểm tra số tiền chuyển khoản phải khớp chính xác
      const parsedAmount = Math.round(parseFloat(amount) || 0);
      const expectedAmount = Math.round(parseFloat(payment.amount) || 0);
      if (parsedAmount !== expectedAmount) {
        const err = new Error(`Số tiền thực nhận (${parsedAmount.toLocaleString('vi-VN')} đ) không khớp chính xác với khoản chiết khấu phải thanh toán (${expectedAmount.toLocaleString('vi-VN')} đ).`);
        err.statusCode = 400;
        throw err;
      }

      // 4. Khóa đơn đặt lịch (FOR UPDATE)
      const [bookings] = await connection.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [payment.booking_id]
      );

      if (!bookings || bookings.length === 0) {
        const err = new Error('Không tìm thấy đơn đặt lịch tương ứng với yêu cầu thanh toán.');
        err.statusCode = 404;
        throw err;
      }
      const booking = bookings[0];

      // 5. Kiểm tra tính khả dụng của đơn: Đơn có bị hủy hoặc nhân viên khác nhận mất chưa?
      const isBookingAvailable = (booking.status === 'pending' || (booking.status === 'assigned' && (booking.staff_id === payment.staff_id || !booking.staff_id)));

      if (!isBookingAvailable) {
        // ĐƠN KHÔNG CÒN KHẢ DỤNG: Đã bị hủy hoặc nhân viên khác nhận trước khi chuyển khoản thành công
        const reasonDetail = booking.status === 'cancelled'
          ? 'Đơn đặt lịch đã bị khách hoặc quản trị viên hủy trong lúc chờ chuyển khoản.'
          : `Đơn đã được phân công/tiếp nhận bởi nhân viên khác (Staff #${booking.staff_id}).`;

        await connection.query(
          `UPDATE staff_commission_payments 
           SET status = 'failed',
               paid_at = NOW(),
               verified_by = ?,
               bank_transaction_code = ?,
               refund_status = 'pending_review',
               refund_reason = ?,
               notes = ?
           WHERE id = ?`,
          [
            verifiedBy,
            transactionId || `TXN-UNAVAIL-${Date.now()}`,
            reasonDetail,
            `Thanh toán thành công ${parsedAmount.toLocaleString('vi-VN')} đ nhưng đơn không còn khả dụng: ${reasonDetail}. Chuyển sang chờ hoàn tiền.`,
            payment.id
          ]
        );

        await connection.commit();

        return {
          success: false,
          code: 'BOOKING_NOT_AVAILABLE',
          message: `Khoản tiền ${parsedAmount.toLocaleString('vi-VN')} đ đã được nhận, nhưng đơn hàng #${booking.booking_code} không còn khả dụng để phân công (${reasonDetail}). Giao dịch đã được ghi nhận và chuyển sang danh sách chờ hoàn tiền.`,
          data: {
            payment_id: payment.id,
            booking_id: booking.id,
            booking_code: booking.booking_code,
            amount: parsedAmount,
            refund_status: 'pending_review'
          }
        };
      }

      // 6. ĐƠN KHẢ DỤNG -> PHÂN CÔNG ĐƠN CHO NHÂN VIÊN VÀ HOÀN TẤT
      await connection.query(
        `UPDATE staff_commission_payments 
         SET status = 'completed',
             paid_at = NOW(),
             verified_by = ?,
             bank_transaction_code = ?,
             notes = ?
         WHERE id = ?`,
        [verifiedBy, transactionId || `BANK-TXN-${Date.now()}`, note || 'Xác nhận chuyển khoản ngân hàng thành công', payment.id]
      );

      await connection.query(
        `UPDATE bookings 
         SET status = 'confirmed',
             staff_id = ?,
             assigned_at = COALESCE(assigned_at, NOW()),
             commission_status = 'paid',
             commission_payment_id = ?,
             commission_paid_at = NOW(),
             commission_payment_method = 'bank_transfer'
         WHERE id = ?`,
        [payment.staff_id, payment.id, booking.id]
      );

      // Tạo thông báo cho khách hàng
      const [staffUsers] = await connection.query('SELECT name, phone FROM users WHERE id = ? LIMIT 1', [payment.staff_id]);
      const staffInfo = staffUsers && staffUsers[0] ? staffUsers[0] : {};

      await connection.query(
        `INSERT IGNORE INTO booking_notifications
         (user_id, booking_id, notification_type, title, message, data)
         VALUES (?, ?, 'staff_accepted_booking', ?, ?, ?)`,
        [
          booking.user_id,
          booking.id,
          `Nhân viên đã nhận đơn ${booking.booking_code}`,
          `${staffInfo.name || 'Nhân viên DabClean'} đã thanh toán chiết khấu chuyển khoản và tiếp nhận đơn ${booking.booking_code}.`,
          JSON.stringify({
            bookingId: booking.id,
            bookingCode: booking.booking_code,
            staffName: staffInfo.name,
            staffPhone: staffInfo.phone
          })
        ]
      );

      await connection.commit();

      return {
        success: true,
        code: 'ASSIGNED_SUCCESSFULLY',
        message: `Xác nhận chuyển khoản thành công. Đã phân công đơn #${booking.booking_code} cho nhân viên ${staffInfo.name || '#' + payment.staff_id}.`,
        data: {
          payment_id: payment.id,
          booking_id: booking.id,
          booking_code: booking.booking_code,
          staff_id: payment.staff_id,
          amount: parsedAmount,
          status: 'confirmed'
        }
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Xử lý hoàn khoản chiết khấu khi đơn đặt lịch bị hủy
   * - Không thuộc lỗi nhân viên (fault: 'customer' | 'admin' | 'force_majeure'): hoàn lại đúng khoản chiết khấu đã thu
   * - Thuộc lỗi nhân viên (fault: 'staff'): không tự động hoàn, giữ lại chiết khấu
   * - Chưa xác định (fault: 'unclear'): chuyển sang trạng thái pending_review
   */
  async handleCancellationRefund({ bookingId, cancelReason = '', fault = 'unclear', adminId = null }) {
    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      const err = new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng để xử lý hoàn tiền chiết khấu.');
      err.statusCode = 503;
      throw err;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Khóa bản ghi đơn đặt lịch (FOR UPDATE)
      const [bookings] = await connection.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [bookingId]
      );
      if (!bookings || bookings.length === 0) {
        const err = new Error('Không tìm thấy đơn đặt lịch.');
        err.statusCode = 404;
        throw err;
      }
      const booking = bookings[0];

      // Đơn chưa thanh toán chiết khấu -> không phát sinh hoàn tiền chiết khấu
      if (booking.commission_status !== 'paid') {
        await connection.commit();
        return {
          refunded: false,
          reason: 'Đơn hàng chưa thanh toán chiết khấu, không phát sinh hoàn tiền.'
        };
      }

      // Chống hoàn tiền hai lần (Idempotency)
      if (booking.commission_status === 'refunded') {
        const err = new Error('Khoản chiết khấu của đơn này đã được hoàn trước đó.');
        err.statusCode = 409;
        throw err;
      }

      // 2. Khóa bản ghi thanh toán chiết khấu thành công (FOR UPDATE)
      const [payments] = await connection.query(
        `SELECT * FROM staff_commission_payments 
         WHERE booking_id = ? AND status = 'completed' 
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [bookingId]
      );

      if (!payments || payments.length === 0) {
        await connection.commit();
        return {
          refunded: false,
          reason: 'Không tìm thấy bản ghi thanh toán chiết khấu hoàn tất cho đơn này.'
        };
      }
      const payment = payments[0];
      const refundAmount = parseFloat(payment.amount) || 0;

      // 3. Phân nhánh theo trách nhiệm lỗi:
      // ============================================================
      // 3.1. NGUYÊN NHÂN THUỘC LỖI NHÂN VIÊN (fault === 'staff')
      // ============================================================
      if (fault === 'staff') {
        await connection.query(
          `UPDATE staff_commission_payments 
           SET refund_status = 'rejected',
               refund_reason = ?,
               refunded_by = ?
           WHERE id = ?`,
          [cancelReason || 'Hủy đơn do lỗi nhân viên (không hoàn chiết khấu)', adminId, payment.id]
        );

        await connection.query(
          `UPDATE bookings 
           SET commission_refund_status = 'rejected',
               commission_refund_reason = ?
           WHERE id = ?`,
          [cancelReason || 'Hủy đơn do lỗi nhân viên', booking.id]
        );

        await connection.commit();
        return {
          refunded: false,
          fault: 'staff',
          message: 'Đơn hàng bị hủy do lỗi từ phía nhân viên. Khoản chiết khấu không được hoàn lại theo chính sách.'
        };
      }

      // ============================================================
      // 3.2. NGUYÊN NHÂN KHÔNG THUỘC LỖI NHÂN VIÊN (fault !== 'staff' && fault !== 'unclear')
      // ============================================================
      if (fault === 'customer' || fault === 'admin' || fault === 'force_majeure' || fault === 'not_staff') {
        if (payment.payment_method === 'wallet') {
          // Thanh toán qua ví -> Hoàn trực tiếp 100% vào Ví Tín Dụng của nhân viên
          await WalletModel.getOrCreateWallet(payment.staff_id, connection, 'credit');
          const [wallets] = await connection.query(
            'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
            [payment.staff_id]
          );
          const creditWallet = wallets[0];
          const balanceBefore = parseFloat(creditWallet.balance) || 0;
          const balanceAfter = balanceBefore + refundAmount;

          await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [balanceAfter, creditWallet.id]);

          const now = new Date();
          const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
          const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
          const txnCode = `WTX-REFUND-COMM-${dateStr}-${randomHex}`;
          const desc = `Hoàn chiết khấu đơn #${booking.booking_code}: ${cancelReason || 'Khách hủy / không do lỗi nhân viên'}`;

          const [txResult] = await connection.query(
            `INSERT INTO wallet_transactions 
             (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id)
             VALUES (?, ?, ?, 'refund', ?, ?, ?, 'completed', ?, 'booking', ?)`,
            [txnCode, creditWallet.id, payment.staff_id, refundAmount, balanceBefore, balanceAfter, desc, String(booking.id)]
          );

          await connection.query(
            `INSERT INTO wallet_ledger_entries 
             (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
             VALUES (?, ?, 'credit', ?, ?, ?)`,
            [txResult.insertId, creditWallet.id, refundAmount, balanceAfter, desc]
          );

          await connection.query(
            `UPDATE staff_commission_payments 
             SET status = 'refunded',
                 refund_status = 'refunded',
                 refund_reason = ?,
                 refunded_at = NOW(),
                 refunded_by = ?
             WHERE id = ?`,
            [cancelReason || 'Hoàn tiền chiết khấu vào Ví Tín Dụng', adminId, payment.id]
          );

          await connection.query(
            `UPDATE bookings 
             SET commission_status = 'refunded',
                 commission_refund_status = 'refunded',
                 commission_refund_reason = ?,
                 commission_refunded_at = NOW()
             WHERE id = ?`,
            [cancelReason, booking.id]
          );

          await connection.commit();

          return {
            refunded: true,
            refund_method: 'wallet',
            amount: refundAmount,
            credit_balance_after: balanceAfter,
            message: `Đã hoàn trả thành công ${refundAmount.toLocaleString('vi-VN')} đ chiết khấu vào Ví Tín Dụng của nhân viên.`
          };
        } else {
          // Thanh toán bằng chuyển khoản -> Lưu trạng thái pending_review để Admin đối soát chi trả
          await connection.query(
            `UPDATE staff_commission_payments 
             SET refund_status = 'pending_review',
                 refund_reason = ?,
                 refunded_by = ?,
                 notes = 'Hủy đơn không do lỗi nhân viên. Đang chờ Admin hoàn trả chiết khấu về tài khoản ngân hàng.'
             WHERE id = ?`,
            [cancelReason, adminId, payment.id]
          );

          await connection.query(
            `UPDATE bookings 
             SET commission_refund_status = 'pending_review',
                 commission_refund_reason = ?
             WHERE id = ?`,
            [cancelReason, booking.id]
          );

          await connection.commit();

          return {
            refunded: false,
            pending_bank_refund: true,
            amount: refundAmount,
            message: `Đã ghi nhận yêu cầu hoàn khoản chiết khấu chuyển khoản ${refundAmount.toLocaleString('vi-VN')} đ, đang chờ Quản trị viên đối soát chi trả.`
          };
        }
      }

      // ============================================================
      // 3.3. NGUYÊN NHÂN CHƯA XÁC ĐỊNH (fault === 'unclear')
      // ============================================================
      await connection.query(
        `UPDATE staff_commission_payments 
         SET refund_status = 'pending_review',
             refund_reason = ?,
             refunded_by = ?,
             notes = 'Nguyên nhân hủy chưa xác định. Chuyển sang chờ Admin xem xét khiếu nại.'
         WHERE id = ?`,
        [cancelReason || 'Chờ xem xét nguyên nhân hủy', adminId, payment.id]
      );

      await connection.query(
        `UPDATE bookings 
         SET commission_refund_status = 'pending_review',
             commission_refund_reason = ?
         WHERE id = ?`,
        [cancelReason || 'Chờ xem xét nguyên nhân hủy', booking.id]
      );

      await connection.commit();

      return {
        refunded: false,
        pending_review: true,
        message: 'Nguyên nhân hủy chưa xác định. Khoản chiết khấu đã được chuyển sang trạng thái chờ xem xét (pending_review).'
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Quản trị viên phê duyệt hoặc từ chối hoàn chiết khấu đang ở trạng thái pending_review
   */
  async reviewCommissionRefund({ paymentId, decision, refundMethod = 'wallet', adminId, note = null }) {
    if (!['approve', 'reject'].includes(decision)) {
      const err = new Error('Quyết định không hợp lệ. Phải là "approve" hoặc "reject".');
      err.statusCode = 400;
      throw err;
    }

    const pool = db.getPool();
    if (!pool || !db.isMySQLConnected()) {
      const err = new Error('Hệ thống cơ sở dữ liệu hiện không khả dụng.');
      err.statusCode = 503;
      throw err;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [payments] = await connection.query(
        'SELECT * FROM staff_commission_payments WHERE id = ? FOR UPDATE',
        [paymentId]
      );
      if (!payments || payments.length === 0) {
        const err = new Error('Không tìm thấy bản ghi thanh toán chiết khấu.');
        err.statusCode = 404;
        throw err;
      }
      const payment = payments[0];

      if (payment.refund_status !== 'pending_review') {
        const err = new Error(`Bản ghi thanh toán hiện không ở trạng thái chờ duyệt hoàn tiền (trạng thái: ${payment.refund_status}).`);
        err.statusCode = 409;
        throw err;
      }

      const refundAmount = parseFloat(payment.amount) || 0;

      if (decision === 'reject') {
        await connection.query(
          `UPDATE staff_commission_payments 
           SET refund_status = 'rejected',
               refunded_by = ?,
               notes = ?
           WHERE id = ?`,
          [adminId, note || 'Admin từ chối hoàn chiết khấu sau khi xem xét', payment.id]
        );

        await connection.query(
          `UPDATE bookings 
           SET commission_refund_status = 'rejected'
           WHERE id = ?`,
          [payment.booking_id]
        );

        await UserModel.logAudit(adminId, 'REJECT_COMMISSION_REFUND', payment.id, 'commission_payment', `Từ chối hoàn chiết khấu #${payment.payment_code} cho thợ #${payment.staff_id}: ${note || 'Không đủ điều kiện'}`);

        await connection.commit();
        return { success: true, decision: 'reject', message: 'Đã từ chối yêu cầu hoàn chiết khấu.' };
      }

      // Phê duyệt hoàn tiền
      if (refundMethod === 'wallet') {
        // Hoàn về ví tín dụng
        await WalletModel.getOrCreateWallet(payment.staff_id, connection, 'credit');
        const [wallets] = await connection.query(
          'SELECT * FROM wallets WHERE user_id = ? AND wallet_type = "credit" FOR UPDATE',
          [payment.staff_id]
        );
        const creditWallet = wallets[0];
        const balanceBefore = parseFloat(creditWallet.balance) || 0;
        const balanceAfter = balanceBefore + refundAmount;

        await connection.query('UPDATE wallets SET balance = ? WHERE id = ?', [balanceAfter, creditWallet.id]);

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const txnCode = `WTX-ADMIN-REFUND-${dateStr}-${randomHex}`;

        const [txResult] = await connection.query(
          `INSERT INTO wallet_transactions 
           (transaction_code, wallet_id, user_id, type, amount, balance_before, balance_after, status, description, reference_type, reference_id)
           VALUES (?, ?, ?, 'refund', ?, ?, ?, 'completed', ?, 'booking', ?)`,
          [txnCode, creditWallet.id, payment.staff_id, refundAmount, balanceBefore, balanceAfter, `Admin duyệt hoàn chiết khấu #${payment.payment_code}: ${note || ''}`, String(payment.booking_id)]
        );

        await connection.query(
          `INSERT INTO wallet_ledger_entries 
           (transaction_id, wallet_id, entry_type, amount, running_balance, notes)
           VALUES (?, ?, 'credit', ?, ?, ?)`,
          [txResult.insertId, creditWallet.id, refundAmount, balanceAfter, `Admin duyệt hoàn chiết khấu đơn #${payment.booking_id}`]
        );

        await connection.query(
          `UPDATE staff_commission_payments 
           SET status = 'refunded',
               refund_status = 'refunded',
               refunded_at = NOW(),
               refunded_by = ?,
               notes = ?
           WHERE id = ?`,
          [adminId, note || 'Admin duyệt hoàn chiết khấu về Ví Tín Dụng', payment.id]
        );

        await connection.query(
          `UPDATE bookings 
           SET commission_status = 'refunded',
               commission_refund_status = 'refunded',
               commission_refunded_at = NOW()
           WHERE id = ?`,
          [payment.booking_id]
        );
      } else {
        // Hoàn tiền qua ngân hàng ngoài
        await connection.query(
          `UPDATE staff_commission_payments 
           SET status = 'refunded',
               refund_status = 'refunded',
               refunded_at = NOW(),
               refunded_by = ?,
               notes = ?
           WHERE id = ?`,
          [adminId, note || 'Admin duyệt hoàn chiết khấu qua chuyển khoản ngân hàng', payment.id]
        );

        await connection.query(
          `UPDATE bookings 
           SET commission_status = 'refunded',
               commission_refund_status = 'refunded',
               commission_refunded_at = NOW()
           WHERE id = ?`,
          [payment.booking_id]
        );
      }

      await UserModel.logAudit(adminId, 'APPROVE_COMMISSION_REFUND', payment.id, 'commission_payment', `Duyệt hoàn ${refundAmount.toLocaleString('vi-VN')} đ chiết khấu #${payment.payment_code} cho thợ #${payment.staff_id} theo hình thức ${refundMethod}: ${note || ''}`);

      await connection.commit();
      return {
        success: true,
        decision: 'approve',
        refundMethod,
        amount: refundAmount,
        message: `Đã phê duyệt hoàn chiết khấu ${refundAmount.toLocaleString('vi-VN')} đ thành công.`
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  /**
   * Lấy chi tiết thanh toán theo mã tham chiếu
   */
  async getPaymentByReferenceCode(refCode) {
    const rows = await db.query(
      `SELECT cp.*, b.booking_code, b.booking_date, b.booking_time, b.address, b.total_price,
              s.name AS service_name, s.icon AS service_icon,
              u.name AS staff_name, u.phone AS staff_phone
       FROM staff_commission_payments cp
       JOIN bookings b ON cp.booking_id = b.id
       LEFT JOIN services s ON b.service_id = s.id
       JOIN users u ON cp.staff_id = u.id
       WHERE cp.reference_code = ? LIMIT 1`,
      [refCode]
    );
    return rows[0] || null;
  },

  /**
   * Lấy chi tiết thanh toán theo ID
   */
  async getPaymentById(id) {
    const rows = await db.query(
      `SELECT cp.*, b.booking_code, u.name AS staff_name, u.phone AS staff_phone
       FROM staff_commission_payments cp
       JOIN bookings b ON cp.booking_id = b.id
       JOIN users u ON cp.staff_id = u.id
       WHERE cp.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Lấy danh sách các đơn khả dụng cho nhân viên xem và nhận ca
   * (Đơn pending chưa ai nhận hoặc đơn assigned cho chính nhân viên này)
   */
  async getAvailableBookingsForStaff(staffId) {
    return await db.query(
      `SELECT b.id, b.booking_code, b.booking_date, b.booking_time, b.address, b.area_size,
              b.total_price, b.staff_wage, b.commission_rate, b.platform_commission, b.staff_net_wage,
              b.status, b.staff_id, b.commission_status, b.payment_method,
              s.name AS service_name, s.icon AS service_icon, s.duration_estimate
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE (b.status = 'pending' AND (b.staff_id IS NULL OR b.staff_id = ?))
          OR (b.status = 'assigned' AND b.staff_id = ?)
       ORDER BY b.booking_date ASC, b.booking_time ASC
       LIMIT 50`,
      [staffId, staffId]
    );
  },

  /**
   * Lấy danh sách giao dịch chiết khấu toàn hệ thống cho Quản trị viên đối soát
   */
  async getAllForAdmin({ status = null, paymentMethod = null, search = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT cp.*, b.booking_code, b.total_price, b.status AS booking_status,
             s.name AS service_name,
             u.name AS staff_name, u.email AS staff_email, u.phone AS staff_phone,
             adm.name AS verified_by_name, ref_adm.name AS refunded_by_name
      FROM staff_commission_payments cp
      JOIN bookings b ON cp.booking_id = b.id
      LEFT JOIN services s ON b.service_id = s.id
      JOIN users u ON cp.staff_id = u.id
      LEFT JOIN users adm ON cp.verified_by = adm.id
      LEFT JOIN users ref_adm ON cp.refunded_by = ref_adm.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND cp.status = ?';
      params.push(status);
    }
    if (paymentMethod && paymentMethod !== 'all') {
      sql += ' AND cp.payment_method = ?';
      params.push(paymentMethod);
    }
    if (search && search.trim()) {
      sql += ' AND (b.booking_code LIKE ? OR cp.reference_code LIKE ? OR cp.payment_code LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }

    sql += ' ORDER BY cp.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10) || 50);
    params.push(parseInt(offset, 10) || 0);

    const rows = await db.query(sql, params);
    return rows;
  }
};

module.exports = CommissionPaymentModel;
