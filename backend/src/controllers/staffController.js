// ============================================================
// DABCLEAN BACKEND - Staff Controller (Dành riêng cho Nhân viên)
// ============================================================
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');
const BookingModel = require('../models/bookingModel');
const UserModel = require('../models/userModel');
const WalletModel = require('../models/walletModel');
const { uploadDirectory } = require('../middleware/jobPhotoUpload');
const { getRequiredAreas, getPhotoProgress } = require('../utils/jobChecklist');
const { sanitizeInput } = require('../utils/sanitize');

async function getAssignedBooking(taskId, req, res) {
  const booking = await BookingModel.getById(taskId);
  if (!booking) {
    res.status(404).json({ success: false, message: 'Không tìm thấy công việc này.' });
    return null;
  }
  if (booking.staff_id !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Thao tác bị từ chối: Bạn không được phân công phụ trách công việc này.'
    });
    return null;
  }
  return booking;
}

async function getChecklistProgress(booking) {
  const photos = await BookingModel.getJobPhotos(booking.id);
  return {
    photos,
    progress: getPhotoProgress(getRequiredAreas(booking.service_name, booking.category || ''), photos)
  };
}

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
        assigned: allMyTasks.filter(t => t.status === 'assigned').length,
        in_progress: allMyTasks.filter(t => t.status === 'arrived' || t.status === 'in_progress').length,
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

  async getTaskChecklist(req, res, next) {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isSafeInteger(taskId) || taskId < 1) {
        return res.status(400).json({ success: false, message: 'Mã công việc không hợp lệ.' });
      }
      const booking = await getAssignedBooking(taskId, req, res);
      if (!booking) return;

      const { photos, progress } = await getChecklistProgress(booking);
      const areas = getRequiredAreas(booking.service_name, booking.category || '');
      const checklist = areas.flatMap(areaName => {
        const beforePhotos = photos.filter(photo =>
          photo.area_name === areaName && photo.stage === 'before'
        );
        if (!beforePhotos.length) {
          return [{ areaName, beforeImage: null, afterImage: null, isCompleted: false }];
        }
        return beforePhotos.map(before => {
          const after = photos.find(photo =>
            photo.area_name === areaName &&
            photo.angle_id === before.angle_id &&
            photo.stage === 'after'
          );
          const toImageMetadata = photo => photo ? {
            url: photo.image_url,
            timestamp: photo.captured_at,
            location: { latitude: Number(photo.latitude), longitude: Number(photo.longitude) },
            uploadedAt: photo.created_at
          } : null;
          return {
            areaName,
            angleId: before.angle_id,
            beforeImage: toImageMetadata(before),
            afterImage: toImageMetadata(after),
            isCompleted: Boolean(after)
          };
        });
      });
      res.json({
        success: true,
        data: {
          jobId: String(booking.id),
          status: booking.status,
          areas,
          checklist,
          photos,
          progress
        }
      });
    } catch (err) {
      next(err);
    }
  },

  async getTaskPhoto(req, res, next) {
    try {
      const { filename } = req.params;
      if (!/^[a-f0-9]{48}\.jpg$/.test(filename)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh công việc.' });
      }
      const imageUrl = `/staff/photos/${filename}`;
      const photo = await BookingModel.getJobPhotoByUrl(imageUrl);
      if (!photo) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh công việc.' });
      }
      const booking = await getAssignedBooking(photo.booking_id, req, res);
      if (!booking) return;

      const filePath = path.join(uploadDirectory, filename);
      try {
        await fs.access(filePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          return res.status(404).json({ success: false, message: 'Tệp ảnh không còn trên máy chủ.' });
        }
        throw err;
      }
      res.type('image/jpeg');
      res.set('Cache-Control', 'private, no-store');
      res.sendFile(filePath, err => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  },

  async uploadTaskPhoto(req, res, next) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh cần tải lên.' });
      }

      try {
        const fileHandle = await fs.open(file.path, 'r');
        const signature = Buffer.alloc(3);
        await fileHandle.read(signature, 0, 3, 0);
        await fileHandle.close();
        if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Tệp tải lên không phải ảnh JPEG hợp lệ.' });
        }

        const taskId = Number(req.params.id);
        if (!Number.isSafeInteger(taskId) || taskId < 1) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Mã công việc không hợp lệ.' });
        }
        const booking = await getAssignedBooking(taskId, req, res);
        if (!booking) {
          await fs.unlink(file.path);
          return;
        }

        const { areaName, angleId, stage, capturedAt, latitude, longitude } = req.body;
        const areas = getRequiredAreas(booking.service_name, booking.category || '');
        if (!areas.includes(areaName)) {
          await fs.unlink(file.path);
          return res.status(400).json({
            success: false,
            message: `Khu vực "${areaName || 'trống'}" không thuộc checklist: ${areas.join(', ')}.`
          });
        }
        if (!['before', 'after'].includes(stage) || !/^[a-zA-Z0-9-]{8,64}$/.test(angleId || '')) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Thông tin giai đoạn hoặc góc chụp không hợp lệ.' });
        }
        if ((stage === 'before' && booking.status !== 'arrived') ||
            (stage === 'after' && booking.status !== 'in_progress')) {
          await fs.unlink(file.path);
          return res.status(409).json({
            success: false,
            message: stage === 'before'
              ? 'Ảnh Before chỉ được thêm sau khi xác nhận đã đến địa chỉ khách hàng.'
              : 'Ảnh After chỉ được thêm khi công việc đang thực hiện.'
          });
        }

        const parsedCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
        const now = Date.now();
        if (Number.isNaN(parsedCapturedAt.getTime()) || parsedCapturedAt.getTime() > now + 5 * 60 * 1000) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Thời điểm chụp ảnh không hợp lệ.' });
        }
        const lat = latitude === undefined || latitude === '' ? NaN : Number(latitude);
        const lng = longitude === undefined || longitude === '' ? NaN : Number(longitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
            !Number.isFinite(lng) || lng < -180 || lng > 180) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Cần cho phép định vị GPS để gửi ảnh kiểm tra.' });
        }

        const photos = await BookingModel.getJobPhotos(taskId);
        if (stage === 'after' && !photos.some(photo =>
          photo.stage === 'before' && photo.area_name === areaName && photo.angle_id === angleId
        )) {
          await fs.unlink(file.path);
          return res.status(409).json({ success: false, message: 'Ảnh After phải khớp với một góc Before đã lưu.' });
        }
        if (photos.some(photo =>
          photo.stage === stage && photo.area_name === areaName && photo.angle_id === angleId
        )) {
          await fs.unlink(file.path);
          return res.status(409).json({ success: false, message: 'Góc chụp này đã có ảnh ở giai đoạn đã chọn.' });
        }

        const imageUrl = `/staff/photos/${file.filename}`;
        const result = await BookingModel.addJobPhoto({
          booking_id: taskId,
          area_name: areaName,
          angle_id: angleId,
          stage,
          image_url: imageUrl,
          captured_at: parsedCapturedAt,
          latitude: lat,
          longitude: lng
        });
        if (!result.affectedRows) {
          await fs.unlink(file.path);
          return res.status(409).json({ success: false, message: 'Không thể lưu ảnh cho góc chụp này.' });
        }

        res.status(201).json({
          success: true,
          message: 'Đã lưu ảnh cùng thời gian tải lên và vị trí GPS.',
          data: {
            id: result.insertId,
            area_name: areaName,
            angle_id: angleId,
            stage,
            image_url: imageUrl,
            captured_at: parsedCapturedAt,
            latitude: lat,
            longitude: lng
          }
        });
      } catch (err) {
        await fs.unlink(file.path).catch(() => {});
        throw err;
      }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: 'Góc chụp này đã có ảnh ở giai đoạn đã chọn.'
        });
      }
      next(err);
    }
  },

  // 3. Cập nhật trạng thái công việc (PATCH /api/staff/tasks/:id/status)
  // Quy trình: assigned -> confirmed -> arrived -> in_progress -> completed
  async updateTaskStatus(req, res, next) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { status, staff_notes, cancel_reason } = req.body;

      const validStatuses = ['confirmed', 'arrived', 'in_progress', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: status === 'assigned'
            ? 'Nhân viên không thể tự ý lùi trạng thái công việc về chờ giao (assigned).'
            : `Trạng thái công việc không hợp lệ. Cho phép: ${validStatuses.join(', ')}`
        });
      }

      const booking = await getAssignedBooking(taskId, req, res);
      if (!booking) return;

      const isSameStatus = status === booking.status;

      // Bảo vệ: Kiểm tra điều kiện ví tín dụng (creditBalance >= 100000) và trạng thái đơn khi nhận việc
      if (!isSameStatus && status === 'confirmed') {
        // Kiểm tra điều kiện ví tín dụng: creditBalance >= 100000
        const eligibility = await WalletModel.checkStaffBookingEligibility(req.user.id);
        if (!eligibility.eligible) {
          return res.status(403).json({
            success: false,
            code: 'INSUFFICIENT_CREDIT_BALANCE',
            message: `Số dư ví tín dụng hiện tại (${eligibility.creditBalance.toLocaleString('vi-VN')} đ) không đủ điều kiện nhận việc (yêu cầu tối thiểu 100.000 đ). Bạn cần nạp hoặc chuyển thêm ít nhất ${eligibility.amountNeeded.toLocaleString('vi-VN')} đ.`,
            data: eligibility
          });
        }

        if (booking.status !== 'assigned') {
          return res.status(409).json({ success: false, message: 'Chỉ có thể xác nhận công việc vừa được quản trị viên phân công.' });
        }
      }
      if (!isSameStatus && status === 'arrived' && booking.status !== 'confirmed') {
        return res.status(409).json({ success: false, message: 'Hãy xác nhận nhận việc trước khi báo đã đến nhà khách hàng.' });
      }
      if (!isSameStatus && status === 'in_progress' && !['arrived', 'confirmed'].includes(booking.status)) {
        return res.status(409).json({ success: false, message: 'Chỉ có thể bắt đầu khi công việc đã được xác nhận hoặc đã đến nơi.' });
      }
      if (!isSameStatus && status === 'completed' && booking.status !== 'in_progress') {
        return res.status(409).json({ success: false, message: 'Chỉ có thể hoàn thành công việc đang thực hiện.' });
      }
      if (booking.status === 'completed' && status !== 'completed') {
        return res.status(409).json({ success: false, message: 'Đơn hàng đã hoàn thành và không thể đổi trạng thái.' });
      }
      if (booking.status === 'cancelled' && status !== 'cancelled') {
        return res.status(409).json({ success: false, message: 'Đơn hàng đã hủy và không thể đổi trạng thái.' });
      }

      // Bảo vệ Bug 7: Nhân viên không được phép hủy đơn khi đã đến nơi hoặc đang thi công
      if (status === 'cancelled' && ['arrived', 'in_progress', 'completed'].includes(booking.status)) {
        return res.status(409).json({
          success: false,
          message: 'Không thể hủy công việc khi đã đến địa chỉ khách hàng hoặc đang thực hiện. Vui lòng liên hệ Quản trị viên để được hỗ trợ.'
        });
      }

      const cancellationReason = typeof cancel_reason === 'string' ? cancel_reason.trim() : '';
      if (status === 'cancelled' && cancellationReason.length < 5) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do hủy công việc (ít nhất 5 ký tự).' });
      }
      if (status === 'cancelled' && cancellationReason.length > 500) {
        return res.status(400).json({ success: false, message: 'Lý do hủy không được vượt quá 500 ký tự.' });
      }

      const { photos, progress } = await getChecklistProgress(booking);
      if (status === 'in_progress' && photos.length > 0 && !progress.canStart) {
        return res.status(409).json({
          success: false,
          message: `Cần ít nhất 1 ảnh Before cho mỗi khu vực: ${progress.missingBeforeAreas.join(', ')}.`
        });
      }
      if (status === 'completed' && photos.length > 0 && !progress.canComplete) {
        const missingPairs = progress.missingAfterAngles
          .map(photo => `${photo.area_name} (${photo.angle_id})`);
        return res.status(409).json({
          success: false,
          message: `Cần bổ sung ảnh After cho tất cả góc Before${missingPairs.length ? `: ${missingPairs.join(', ')}` : ''}.`
        });
      }
      if (status === 'completed' && booking.payment_method === 'cash' && booking.payment_status !== 'paid') {
        return res.status(409).json({ success: false, message: 'Vui lòng xác nhận đã nhận tiền mặt bằng thao tác vuốt trước khi hoàn thành đơn.' });
      }

      const updatedNotes = staff_notes !== undefined ? sanitizeInput(staff_notes) : (booking.staff_notes || '');
      const sanitizedCancelReason = cancellationReason ? sanitizeInput(cancellationReason) : '';
      // Bảo vệ Bug 7: Kiểm tra trạng thái hiện tại (optimistic concurrency) để chống race condition
      const changed = await BookingModel.updateStaffTaskStatus(
        taskId, req.user.id, status, updatedNotes, status === 'cancelled' ? sanitizedCancelReason : '', booking.status
      );
      if (!changed && !isSameStatus) {
        return res.status(409).json({ success: false, message: 'Trạng thái công việc vừa thay đổi. Hãy tải lại danh sách.' });
      }

      const updated = await BookingModel.getById(taskId);
      if (status === 'confirmed') {
        const bookingDate = updated.booking_date instanceof Date
          ? updated.booking_date.toISOString().slice(0, 10)
          : String(updated.booking_date).slice(0, 10);
        const bookingTime = String(updated.booking_time || '').slice(0, 5);
        const staffContact = updated.staff_phone ? ` Liên hệ nhân viên: ${updated.staff_phone}.` : '';
        await BookingModel.createBookingNotification({
          user_id: updated.user_id,
          booking_id: updated.id,
          notification_type: 'staff_accepted_booking',
          title: `Nhân viên đã nhận đơn ${updated.booking_code}`,
          message: `${updated.staff_name || 'Nhân viên DabClean'} đã nhận đơn ${updated.booking_code} cho dịch vụ ${updated.service_name}, lịch ${bookingTime} ngày ${bookingDate}. Địa chỉ: ${updated.address}. Tổng tiền: ${Number(updated.total_price).toLocaleString('vi-VN')} đ.${staffContact}`,
          data: {
            bookingId: updated.id,
            bookingCode: updated.booking_code,
            serviceName: updated.service_name,
            bookingDate,
            bookingTime,
            address: updated.address,
            totalPrice: Number(updated.total_price),
            staffName: updated.staff_name,
            staffPhone: updated.staff_phone
          }
        });
      }

      let settlementResult = null;
      if (status === 'completed' && booking.status !== 'completed') {
        try {
          settlementResult = await WalletModel.settleBookingCommissionAndWage({
            bookingId: taskId,
            adminId: null,
            note: 'Tự động quyết toán khi nhân viên hoàn thành đơn'
          });
        } catch (settleErr) {
          console.error(`[StaffController] Settlement error for booking #${taskId}:`, settleErr.message || settleErr);
        }
      }

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái công việc #${booking.booking_code} thành "${status}".`,
        data: updated,
        settlement: settlementResult
      });
    } catch (err) {
      next(err);
    }
  },

  async confirmCashPayment(req, res, next) {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isSafeInteger(taskId) || taskId < 1) {
        return res.status(400).json({ success: false, message: 'Mã công việc không hợp lệ.' });
      }
      const booking = await getAssignedBooking(taskId, req, res);
      if (!booking) return;
      if (booking.payment_method !== 'cash') {
        return res.status(409).json({ success: false, message: 'Đơn này không sử dụng phương thức thanh toán tiền mặt.' });
      }
      if (booking.status !== 'in_progress') {
        return res.status(409).json({ success: false, message: 'Chỉ xác nhận thu tiền sau khi hoàn tất công việc và ảnh After.' });
      }
      const { progress } = await getChecklistProgress(booking);
      if (!progress.canComplete) {
        return res.status(409).json({ success: false, message: 'Cần hoàn tất tất cả ảnh After trước khi xác nhận thanh toán.' });
      }
      const updated = await BookingModel.markCashPaymentReceived(taskId, req.user.id);
      if (!updated) {
        return res.status(409).json({ success: false, message: 'Thanh toán đã được ghi nhận hoặc trạng thái đơn vừa thay đổi.' });
      }
      res.json({ success: true, message: 'Đã ghi nhận nhân viên thu đủ tiền mặt từ khách hàng.' });
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

      // Bảo vệ Bug 12: Sử dụng findByIdWithPassword để có trường password trên cả MySQL và In-Memory
      const user = await UserModel.findByIdWithPassword(req.user.id);
      if (!user || !user.password) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản nhân viên.' });
      }
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
