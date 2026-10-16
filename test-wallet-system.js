// ============================================================
// TEST SUITE: CleanNova Wallet & Vouchers System Verification
// ============================================================
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- 1. Login demo customer (demo@nova.app) ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@nova.app', password: 'NovaDemo2026!' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.success, true, 'Login should succeed');
  const token = loginData.data.token;
  console.log(' Customer logged in. Token obtained.');

  console.log('\n--- 2. Get customer wallet (GET /api/wallet/my) ---');
  const walletRes = await fetch(`${BASE_URL}/wallet/my`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const walletData = await walletRes.json();
  assert.strictEqual(walletData.success, true, 'Wallet query should succeed');
  console.log(` Wallet balance: ${walletData.data.balance.toLocaleString('vi-VN')} ${walletData.data.currency}`);
  const initialBalance = walletData.data.balance;

  console.log('\n--- 3. Topup Sandbox (POST /api/wallet/topup) ---');
  const topupAmount = 200000;
  const idempotencyKey = `test-topup-${Date.now()}`;
  const topupRes = await fetch(`${BASE_URL}/wallet/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      amount: topupAmount,
      idempotency_key: idempotencyKey,
      description: 'Nạp thử nghiệm kiểm thử tự động'
    })
  });
  const topupData = await topupRes.json();
  assert.strictEqual(topupData.success, true, 'Topup should succeed');
  assert.strictEqual(topupData.data.balance_after, initialBalance + topupAmount, 'Balance after should equal initial + topup');
  console.log(` Topup successful: +${topupAmount.toLocaleString('vi-VN')} đ. New balance: ${topupData.data.balance_after.toLocaleString('vi-VN')} đ`);

  console.log('\n--- 4. Verify Idempotency on Topup ---');
  const duplicateTopupRes = await fetch(`${BASE_URL}/wallet/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      amount: topupAmount,
      idempotency_key: idempotencyKey,
      description: 'Nạp thử nghiệm lần 2 (cùng idempotency key)'
    })
  });
  const duplicateData = await duplicateTopupRes.json();
  assert.strictEqual(duplicateData.success, true, 'Duplicate topup should succeed idempotently');
  assert.strictEqual(duplicateData.data.isIdempotent, true, 'Should detect idempotency without double credit');
  console.log(' Idempotency key verified: no duplicate charge or credit created!');

  console.log('\n--- 5. Get Active Vouchers (GET /api/vouchers/active) ---');
  const vouchersRes = await fetch(`${BASE_URL}/vouchers/active`);
  const vouchersData = await vouchersRes.json();
  assert.strictEqual(vouchersData.success, true, 'Vouchers query should succeed');
  console.log(` Active vouchers found: ${vouchersData.data.length}`);
  const codes = vouchersData.data.map(v => v.code);
  assert(codes.includes('CLEANOVA20'), 'Should include CLEANOVA20');
  assert(codes.includes('CLEAN50K'), 'Should include CLEAN50K');
  console.log(' Default vouchers CLEANOVA20 and CLEAN50K are active.');

  console.log('\n--- 6. Get Quote with Addons & Voucher ---');
  const quoteRes = await fetch(`${BASE_URL}/bookings/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: 1, // Dọn dẹp theo giờ (150k/h * 1.5 medium = 225k)
      area_size: 'medium',
      frequency: 'once',
      discount_code: 'CLEAN50K',
      addons: ['disinfect'] // +100k
    })
  });
  const quoteData = await quoteRes.json();
  assert.strictEqual(quoteData.success, true, 'Quote calculation should succeed');
  console.log(' Quote details:', {
    subtotal: quoteData.data.subtotal,
    addonAmount: quoteData.data.addonAmount,
    discountAmount: quoteData.data.discountAmount,
    totalPrice: quoteData.data.totalPrice
  });
  assert.strictEqual(quoteData.data.addonAmount, 100000, 'Addon Nano Bạc should be 100k');
  assert.strictEqual(quoteData.data.discountAmount, 50000, 'Discount CLEAN50K should be 50k');

  console.log('\n--- 7. Create booking paid with Wallet (payment_method: "wallet") ---');
  const currentWalletRes = await fetch(`${BASE_URL}/wallet/my`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const curWallet = (await currentWalletRes.json()).data;
  const balanceBeforeBooking = curWallet.balance;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const bookingDateStr = tomorrow.toISOString().slice(0, 10);

  const createBookingRes = await fetch(`${BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      service_id: 1,
      booking_date: bookingDateStr,
      booking_time: '10:00',
      area_size: 'medium',
      frequency: 'once',
      address: 'Số 99 Phố Trần Duy Hưng, Cầu Giấy, Hà Nội',
      phone: '0987654321',
      notes: 'Thanh toán trực tiếp qua Ví CleanNova kiểm thử',
      payment_method: 'wallet',
      discount_code: 'CLEAN50K',
      addons: ['disinfect']
    })
  });
  const createBookingData = await createBookingRes.json();
  assert.strictEqual(createBookingData.success, true, 'Booking with wallet should succeed');
  const newBooking = createBookingData.data;
  console.log(` Booking created: #${newBooking.booking_code}, total: ${newBooking.total_price.toLocaleString('vi-VN')} đ, payment_status: ${newBooking.payment_status}`);
  assert.strictEqual(newBooking.payment_status, 'paid', 'Wallet payment should automatically mark booking as paid');

  const afterBookingWalletRes = await fetch(`${BASE_URL}/wallet/my`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const balanceAfterBooking = (await afterBookingWalletRes.json()).data.balance;
  console.log(` Balance before: ${balanceBeforeBooking.toLocaleString('vi-VN')} đ -> Balance after: ${balanceAfterBooking.toLocaleString('vi-VN')} đ`);
  assert.strictEqual(balanceAfterBooking, balanceBeforeBooking - newBooking.total_price, 'Wallet balance should be deducted exactly by total_price');

  console.log('\n--- 8. Cancel booking with automatic 100% wallet refund ---');
  const cancelRes = await fetch(`${BASE_URL}/bookings/${newBooking.id}/cancel`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      reason: 'Tôi có việc bận đột xuất muốn hoàn tiền vào ví CleanNova để đặt lại sau'
    })
  });
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelData.success, true, 'Cancellation should succeed');
  console.log(' Cancel response:', cancelData.message);

  const afterRefundWalletRes = await fetch(`${BASE_URL}/wallet/my`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const balanceAfterRefund = (await afterRefundWalletRes.json()).data.balance;
  console.log(` Balance after cancellation & refund: ${balanceAfterRefund.toLocaleString('vi-VN')} đ`);
  assert.strictEqual(balanceAfterRefund, balanceBeforeBooking, 'Refund should return exact balance before booking');

  console.log('\n--- 9. Check transaction history (GET /api/wallet/transactions) ---');
  const txRes = await fetch(`${BASE_URL}/wallet/transactions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const txData = await txRes.json();
  assert.strictEqual(txData.success, true, 'Transactions query should succeed');
  console.log(` Found ${txData.data.length} transactions for this user:`);
  txData.data.slice(0, 4).forEach(tx => {
    console.log(` - [${tx.type.toUpperCase()}] ${tx.transaction_code}: ${tx.amount.toLocaleString('vi-VN')} đ (Balance after: ${tx.balance_after.toLocaleString('vi-VN')} đ)`);
  });

  console.log('\n--- 10. Admin Wallet & Transactions Oversight ---');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' })
  });
  const adminToken = (await adminLoginRes.json()).data.token;

  const adminWalletsRes = await fetch(`${BASE_URL}/wallet/admin/wallets`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminWallets = (await adminWalletsRes.json()).data;
  assert(adminWallets.length > 0, 'Admin should see all user wallets');
  console.log(` Admin sees ${adminWallets.length} total user wallets across the system.`);

  console.log('\n============================================================');
  console.log(' ALL CLEANNOVA WALLET & VOUCHER TESTS PASSED 100%! ');
  console.log('============================================================');
}

runTests().catch(err => {
  console.error('\n Test failed with error:', err);
  process.exit(1);
});
