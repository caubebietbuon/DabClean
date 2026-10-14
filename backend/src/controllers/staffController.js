// ============================================================
// CLEANOVA BACKEND - Staff Controller (Dành riêng cho Nhân viên)
// ============================================================
const bcrypt = require('bcryptjs');
const BookingModel = require('../models/bookingModel');
const UserModel = require('../models/userModel');

const staffController = {
  // 1. Lấy danh sách công việc được phân công cho nhân viên (GET /api/staff/tasks)
  async getMyTasks(req, res, next) {
    try {
      const staffId = req.user.id;
      let tasks = await BookingModel.getByStaffId(staffId);

      const { status } = req.query;
      if (status && status !== 'all') {
        tasks = tasks.filter(t => t.status === status);
      }

      // Thống kê nhanh công việc
      const allMyTasks = await BookingModel.getByStaffId(staffId);
      const stats = {
        total: allMyTasks.length,
        assigned: allMyTasks.filter(t => t.status === 'confirmed').length,
        in_progress: allMyTasks.filter(t => t.status === 'in_progress').length,
        completed: allMyTasks.filter(t => t.status === 'completed').length,
        cancelled: allMyTasks.filter(t => t.status === 'cancelled').length
      };

      res.json({
        success: true,
        stats,
        count: tasks.length,
        data: tasks
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Xem chi tiết công việc cụ thể (GET /api/staff/tasks/:id)
  async getTaskDetail(req, res, next) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const booking = await BookingModel.getById(taskId);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy công việc này.' });
      }

      // Kiểm tra bảo mật: Nhân viên CHỈ được xem công việc được phân công cho chính mình
      if (booking.staff_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Truy cập bị từ chối: Bạn không được phân công phụ trách công việc này.'
        });
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Cập nhật trạng thái công việc (PATCH /api/staff/tasks/:id/status)
  // Quy trình: confirmed (Đã tiếp nhận) -> in_progress (Đang làm) -> completed (Hoàn thành) hoặc cancelled (Báo sự cố)
  async updateTaskStatus(req, res, next) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { status, staff_notes } = req.body;

      const validStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Trạng thái công việc không hợp lệ. Cho phép: ${validStatuses.join(', ')}`
        });
      }

      const booking = await BookingModel.getById(taskId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy công việc này.' });
      }

      // Xác minh quyền phụ trách của nhân viên
      if (booking.staff_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Thao tác bị từ chối: Bạn không có quyền cập nhật công việc của nhân viên khác.'
        });
      }

      const updatedNotes = staff_notes !== undefined ? staff_notes : (booking.staff_notes || '');
      await BookingModel.updateStaffTaskStatus(taskId, req.user.id, status, updatedNotes);

      const updated = await BookingModel.getById(taskId);

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái công việc #${booking.booking_code} thành "${status}".`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Lấy thông tin cá nhân nhân viên (GET /api/staff/profile)
  async getProfile(req, res) {
    res.json({
      success: true,
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        address: req.user.address,
        role: req.user.role,
        status: req.user.status || 'active',
        created_at: req.user.created_at
      }
    });
  },

  // 5. Cập nhật hồ sơ nhân viên (PATCH /api/staff/profile)
  async updateProfile(req, res, next) {
    try {
      const { name, phone, address } = req.body;
      await UserModel.updateProfile(req.user.id, {
        name: name || req.user.name,
        phone: phone || req.user.phone,
        address: address || req.user.address
      });

      const updated = await UserModel.findById(req.user.id);
      res.json({
        success: true,
        message: 'Cập nhật thông tin cá nhân thành công!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Đổi mật khẩu nhân viên (PUT /api/staff/change-password)
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 8 ký tự.' });
      }

      const user = await UserModel.findById(req.user.id);
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(newPassword, salt);
      await UserModel.updatePassword(req.user.id, hashed);

      res.json({
        success: true,
        message: 'Đổi mật khẩu thành công! Hãy dùng mật khẩu mới cho các phiên đăng nhập tiếp theo.'
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = staffController;
