// ============================================================
// CLEANOVA BACKEND - Partner Routes (/api/partner)
// ============================================================
const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');

// 1. Đăng ký hồ sơ đối tác / nhân viên (Công khai)
router.post('/register', partnerController.register);

module.exports = router;
