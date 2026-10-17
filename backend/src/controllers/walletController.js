// ============================================================
// DABCLEAN BACKEND - Wallet Controller (Ví DabClean)
// ============================================================
const WalletModel = require('../models/walletModel');
const { sanitizeInput } = require('../utils/sanitize');

const walletController = {
  // 1. Lấy thông tin ví và số dư của người dùng hiện tại (GET /api/wallet/my)
  async getMyWallet(req, res, next) {
    try {
      const walletInfo = await WalletModel.getBalance(req.user.id);
      res.json({
        success: true,
        data: walletInfo
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Lấy lịch sử giao dịch ví của người dùng (GET /api/wallet/transactions)
  async getMyTransactions(req, res, next) {
    try {
      const { type, limit = 20, offset = 0 } = req.query;
      const result = await WalletModel.getTransactions(req.user.id, {
        type: type || null,
        limit: parseInt(limit, 10) || 20,
        offset: parseInt(offset, 10) || 0
      });
      res.json({
        success: true,
        data: result.transactions,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Nạp tiền vào ví CleanNova (Chế độ Sandbox phát triển / Cổng thanh toán) (POST /api/wallet/topup)
  async topupSandbox(req, res, next) {
    try {
      const { amount, idempotency_key, description } = req.body;
      const parsedAmount = parseFloat(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền nạp vào ví phải là số dương lớn hơn 0 VNĐ.'
        });
      }

      if (parsedAmount < 10000) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền nạp tối thiểu mỗi lần là 10.000 VNĐ.'
        });
      }

      if (parsedAmount > 50000000) {
        return res.status(400).json({
          success: false,
          message: 'Hạn mức nạp tối đa mỗi lần là 50.000.000 VNĐ.'
        });
      }

      const cleanDesc = description ? sanitizeInput(description) : 'Nạp tiền vào Ví DabClean (Sandbox)';
      const result = await WalletModel.topup({
        userId: req.user.id,
        amount: parsedAmount,
        idempotencyKey: idempotency_key || null,
        description: cleanDesc,
        referenceType: 'sandbox_user'
      });

      res.status(200).json({
        success: true,
        message: `Nạp thành công ${Math.round(parsedAmount).toLocaleString('vi-VN')} đ vào Ví DabClean!`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Thanh toán đơn đặt lịch bằng Ví DabClean (POST /api/wallet/pay-booking)
  async payBooking(req, res, next) {
    try {
      const { booking_id, idempotency_key } = req.body;
      const bookingId = parseInt(booking_id, 10);

      if (!bookingId || isNaN(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mã ID đơn đặt lịch cần thanh toán.'
        });
      }

      const result = await WalletModel.payBooking({
        userId: req.user.id,
        bookingId,
        idempotencyKey: idempotency_key || null
      });

      res.status(200).json({
        success: true,
        message: `Thanh toán thành công đơn #${result.booking_code} bằng Ví DabClean!`,
        data: result
      });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_WALLET_BALANCE') {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_WALLET_BALANCE',
          message: err.message
        });
      }
      next(err);
    }
  },

  // 5. Admin: Xem danh sách ví toàn hệ thống (GET /api/wallet/admin/wallets)
  async getAdminWallets(req, res, next) {
    try {
      const wallets = await WalletModel.getAllWalletsForAdmin();
      res.json({
        success: true,
        data: wallets
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Admin: Xem toàn bộ giao dịch ví toàn hệ thống (GET /api/wallet/admin/transactions)
  async getAdminTransactions(req, res, next) {
    try {
      const { type, limit = 50, offset = 0 } = req.query;
      const transactions = await WalletModel.getAllTransactionsForAdmin({
        type: type || null,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0
      });
      res.json({
        success: true,
        data: transactions
      });
    } catch (err) {
      next(err);
    }
  },

  // 7. Admin: Thực hiện hoàn tiền đơn hàng vào ví (POST /api/wallet/admin/refund)
  async adminRefund(req, res, next) {
    try {
      const { booking_id, reason } = req.body;
      const bookingId = parseInt(booking_id, 10);

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp booking_id cần hoàn tiền.'
        });
      }

      const cleanReason = reason ? sanitizeInput(reason) : 'Quản trị viên hoàn tiền dịch vụ';
      const result = await WalletModel.refundBooking({
        bookingId,
        reason: cleanReason,
        adminId: req.user.id
      });

      res.json({
        success: true,
        message: `Hoàn tiền thành công ${Math.round(result.refund_amount).toLocaleString('vi-VN')} đ vào ví khách hàng!`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  // 8. Rút tiền về tài khoản ngân hàng (POST /api/wallet/withdraw)
  async withdraw(req, res, next) {
    try {
      const amount = req.body.amount;
      const bankName = req.body.bank_name || req.body.bankName;
      const accountNumber = req.body.account_number || req.body.accountNumber;
      const accountName = req.body.account_name || req.body.accountName;
      const note = req.body.note;

      const result = await WalletModel.withdraw({
        userId: req.user.id,
        amount,
        bankName: bankName ? sanitizeInput(bankName) : '',
        accountNumber: accountNumber ? sanitizeInput(accountNumber) : '',
        accountName: accountName ? sanitizeInput(accountName) : '',
        note: note ? sanitizeInput(note) : null
      });
      res.status(200).json({
        success: true,
        message: `Đã tạo lệnh rút tiền thành công ${Math.round(result.amount).toLocaleString('vi-VN')} đ về tài khoản ${result.bank_name} (${result.account_number})!`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  // 9. Lấy tổng quan thù lao & ví của nhân viên (GET /api/wallet/staff/summary)
  async getStaffWageSummary(req, res, next) {
    try {
      const summary = await WalletModel.getStaffWageSummary(req.user.id);
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  },

  // 10. Nhân viên: Lấy chi tiết Hai Ví Nhân Viên (Ví tín dụng & Ví thu nhập) (GET /api/wallet/staff/wallets)
  async getStaffWallets(req, res, next) {
    try {
      const data = await WalletModel.getStaffWallets(req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  },

  // 11. Nhân viên: Kiểm tra điều kiện nhận đơn (creditBalance > 100000) (GET /api/wallet/staff/eligibility)
  async checkStaffEligibility(req, res, next) {
    try {
      const data = await WalletModel.checkStaffBookingEligibility(req.user.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  },

  // 12. Nhân viên: Nạp tiền vào Ví Tín Dụng (POST /api/wallet/staff/topup-credit)
  async topupStaffCredit(req, res, next) {
    try {
      const { amount, idempotency_key, description } = req.body;
      const parsedAmount = parseFloat(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền nạp vào Ví tín dụng phải là số dương lớn hơn 0 VNĐ.'
        });
      }
      if (parsedAmount < 10000) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền nạp tối thiểu vào Ví tín dụng là 10.000 VNĐ.'
        });
      }

      const cleanDesc = description ? sanitizeInput(description) : 'Nạp tiền vào Ví tín dụng đối tác CleanNova (Sandbox)';
      const result = await WalletModel.topupCreditWallet({
        staffId: req.user.id,
        amount: parsedAmount,
        idempotencyKey: idempotency_key || null,
        description: cleanDesc,
        referenceType: 'sandbox_staff_credit'
      });

      res.status(200).json({
        success: true,
        message: `Nạp thành công ${Math.round(parsedAmount).toLocaleString('vi-VN')} đ vào Ví tín dụng đối tác!`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  // 13. Nhân viên: Chuyển tiền từ Ví Thu Nhập sang Ví Tín Dụng (POST /api/wallet/staff/transfer)
  async transferToCredit(req, res, next) {
    try {
      const { amount, idempotency_key, note } = req.body;
      const parsedAmount = parseFloat(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Số tiền chuyển từ Ví thu nhập sang Ví tín dụng phải lớn hơn 0 VNĐ.'
        });
      }

      const cleanNote = note ? sanitizeInput(note) : null;
      const result = await WalletModel.transferEarningsToCredit({
        staffId: req.user.id,
        amount: parsedAmount,
        idempotencyKey: idempotency_key || null,
        note: cleanNote
      });

      res.status(200).json({
        success: true,
        message: `Chuyển thành công ${Math.round(parsedAmount).toLocaleString('vi-VN')} đ sang Ví tín dụng đối tác!`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  // 14. Admin: Lấy danh sách số dư 2 ví của toàn bộ nhân viên (GET /api/wallet/admin/staff-wallets)
  async getAdminStaffWallets(req, res, next) {
    try {
      const list = await WalletModel.getAllStaffWalletsForAdmin();
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = walletController;
