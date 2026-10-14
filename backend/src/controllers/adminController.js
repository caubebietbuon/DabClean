// ============================================================
// CLEANOVA BACKEND - Admin Controller (Dành riêng cho Quản trị viên)
// ============================================================
const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const UserModel = require('../models/userModel');

const adminController = {
  // 1. Thống kê tổng quan Dashboard (GET /api/admin/stats)
  async getStats(req, res, next) {
    try {
      const stats = await BookingModel.getStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Lấy toàn bộ đơn đặt lịch (GET /api/admin/bookings)
  async getAllBookings(req, res, next) {
    try {
      const bookings = await BookingModel.getAll();
      res.json({
        success: true,
        count: bookings.length,
        data: bookings
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Cập nhật trạng thái đơn đặt lịch (PUT /api/admin/bookings/:id/status)
  async updateBookingStatus(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;

      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Trạng thái không hợp lệ. Phải là một trong các giá trị: ${validStatuses.join(', ')}`
        });
      }

      const booking = await BookingModel.getById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      await BookingModel.updateStatus(id, status);

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái đơn ${booking.booking_code} thành "${status}".`
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Thêm gói dịch vụ mới (POST /api/admin/services)
  async createService(req, res, next) {
    try {
      const { name, slug, description, short_description, base_price, price_unit, duration_estimate, icon } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Tên dịch vụ không được để trống.' });
      }
      if (!base_price || isNaN(base_price)) {
        return res.status(400).json({ success: false, message: 'Giá dịch vụ phải là số hợp lệ.' });
      }

      // Tạo slug tự động nếu chưa có
      const generatedSlug = slug || name.trim().toLowerCase().replace(/[\s\W-]+/g, '-');

      const existing = await ServiceModel.getBySlug(generatedSlug);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Đường dẫn slug này đã tồn tại, vui lòng chọn tên khác.' });
      }

      const serviceId = await ServiceModel.create({
        name: name.trim(),
        slug: generatedSlug,
        description: description || name,
        short_description: short_description || '',
        base_price: parseFloat(base_price),
        price_unit: price_unit || 'lần',
        duration_estimate: duration_estimate || '2-4 giờ',
        icon: icon || '🧹'
      });

      const newService = await ServiceModel.getById(serviceId);

      res.status(201).json({
        success: true,
        message: 'Thêm dịch vụ mới thành công!',
        data: newService
      });
    } catch (err) {
      next(err);
    }
  },

  // 5. Cập nhật gói dịch vụ (PUT /api/admin/services/:id)
  async updateService(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, description, short_description, base_price, price_unit, duration_estimate, icon } = req.body;

      const service = await ServiceModel.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ cần cập nhật.' });
      }

      await ServiceModel.update(id, {
        name: name || service.name,
        description: description || service.description,
        short_description: short_description !== undefined ? short_description : service.short_description,
        base_price: base_price !== undefined ? parseFloat(base_price) : service.base_price,
        price_unit: price_unit || service.price_unit,
        duration_estimate: duration_estimate || service.duration_estimate,
        icon: icon || service.icon
      });

      const updated = await ServiceModel.getById(id);

      res.json({
        success: true,
        message: 'Cập nhật dịch vụ thành công!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Xóa dịch vụ (DELETE /api/admin/services/:id)
  async deleteService(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const service = await ServiceModel.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ cần xóa.' });
      }

      await ServiceModel.delete(id);

      res.json({
        success: true,
        message: `Đã xóa dịch vụ "${service.name}".`
      });
    } catch (err) {
      next(err);
    }
  },

  // 7. Lấy danh sách toàn bộ người dùng (GET /api/admin/users)
  async getAllUsers(req, res, next) {
    try {
      const users = await UserModel.getAll();
      res.json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = adminController;
