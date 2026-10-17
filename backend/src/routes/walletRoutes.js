// ============================================================
// DABCLEAN BACKEND - Wallet Routes (/api/wallet)
// ============================================================
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Webhook nhận thông báo chuyển khoản ngân hàng (có thể gọi từ bên thứ 3 / mô phỏng)
router.post('/commission/webhook', walletController.handleCommissionWebhook);

// Tất cả các route ví khác đều bắt buộc xác thực token
router.use(verifyToken);

// Kiểm tra trạng thái thanh toán chiết khấu
router.get('/commission/payment/:refCode', walletController.getCommissionPaymentStatus);

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

// 8. Rút tiền về tài khoản ngân hàng (Khách hàng & Nhân viên)
router.post('/withdraw', walletController.withdraw);

// 9. Nhân viên (Staff): Xem tổng quan thù lao & ví
router.get('/staff/summary', requireRole(['staff', 'admin']), walletController.getStaffWageSummary);

// 10. Nhân viên (Staff): Lấy chi tiết Hai Ví Nhân Viên (Ví tín dụng & Ví thu nhập)
router.get('/staff/wallets', requireRole(['staff', 'admin']), walletController.getStaffWallets);

// 11. Nhân viên (Staff): Kiểm tra điều kiện nhận đơn (creditBalance > 100000)
router.get('/staff/eligibility', requireRole(['staff', 'admin']), walletController.checkStaffEligibility);

// 12. Nhân viên (Staff): Nạp tiền vào Ví Tín Dụng
router.post('/staff/topup-credit', requireRole(['staff', 'admin']), walletController.topupStaffCredit);

// 13. Nhân viên (Staff): Chuyển tiền từ Ví Thu Nhập sang Ví Tín Dụng
router.post('/staff/transfer', requireRole(['staff', 'admin']), walletController.transferToCredit);

// 14. Quản trị viên (Admin): Xem danh sách số dư 2 ví của toàn bộ nhân viên
router.get('/admin/staff-wallets', requireRole(['admin']), walletController.getAdminStaffWallets);

module.exports = router;
