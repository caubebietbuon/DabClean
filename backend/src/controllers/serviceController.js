// ============================================================
// CLEANOVA BACKEND - Service Controller (Khách hàng xem dịch vụ)
// ============================================================
const ServiceModel = require('../models/serviceModel');

const serviceController = {
  // 1. Lấy danh sách dịch vụ (GET /api/services)
  async getAllServices(req, res, next) {
    try {
      const search = req.query.search || '';
      const services = await ServiceModel.getAll(search);
      res.json({
        success: true,
        count: services.length,
        data: services
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Lấy chi tiết một dịch vụ (GET /api/services/:idOrSlug)
  async getServiceDetail(req, res, next) {
    try {
      const { idOrSlug } = req.params;
      let service = null;

      if (!isNaN(idOrSlug)) {
        service = await ServiceModel.getById(parseInt(idOrSlug, 10));
      } else {
        service = await ServiceModel.getBySlug(idOrSlug);
      }

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy gói dịch vụ yêu cầu.'
        });
      }

      res.json({
        success: true,
        data: service
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = serviceController;
