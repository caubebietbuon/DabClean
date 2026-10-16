// ============================================================
// CLEANOVA BACKEND - Wallet Routes (/api/wallet)
// ============================================================
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Tất cả các route ví đều bắt buộc xác thực token
router.use(verifyToken);

// 1. Khách hàng: Lấy thông tin & số dư ví
router.get('/my', walletController.getMyWallet);

// 2. Khách hàng: Lấy lịch sử giao dịch ví (phân trang + lọc loại giao dịch)
router.get('/transactions', walletController.getMyTransactions);

// 3. Khách hàng: Nạp tiền vào ví CleanNova (Sandbox)
router.post('/topup', walletController.topupSandbox);

// 4. Khách hàng: Thanh toán đơn đặt dịch vụ bằng ví CleanNova
router.post('/pay-booking', walletController.payBooking);

// 5. Quản trị viên (Admin): Xem danh sách ví toàn hệ thống
router.get('/admin/wallets', requireRole(['admin']), walletController.getAdminWallets);

// 6. Quản trị viên (Admin): Xem toàn bộ giao dịch ví toàn hệ thống
router.get('/admin/transactions', requireRole(['admin']), walletController.getAdminTransactions);

// 7. Quản trị viên (Admin): Hoàn tiền đơn hàng vào ví
router.post('/admin/refund', requireRole(['admin']), walletController.adminRefund);

module.exports = router;
