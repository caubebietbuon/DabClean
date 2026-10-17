// ============================================================
// DABCLEAN BACKEND - Service Routes (/api/services)
// ============================================================
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

// Lấy danh sách toàn bộ dịch vụ (Công khai)
router.get('/', serviceController.getAllServices);

// Lấy chi tiết một dịch vụ theo ID hoặc slug (Công khai)
router.get('/:idOrSlug', serviceController.getServiceDetail);

module.exports = router;
