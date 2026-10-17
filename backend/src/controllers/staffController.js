// ============================================================
// DABCLEAN BACKEND - Staff Controller (Dành riêng cho Nhân viên)
// ============================================================
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const path = require('path');
const BookingModel = require('../models/bookingModel');
const UserModel = require('../models/userModel');
const WalletModel = require('../models/walletModel');
const CommissionPaymentModel = require('../models/commissionPaymentModel');
const { uploadDirectory } = require('../middleware/jobPhotoUpload');
const { getRequiredAreas, getPhotoProgress } = require('../utils/jobChecklist');
const { sanitizeInput } = require('../utils/sanitize');
const db = require('../config/db');

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
  // 0a. Lấy danh sách việc làm khả dụng để nhận ca (GET /api/staff/available-bookings)
  async getAvailableBookings(req, res, next) {
    try {
      const bookings = await CommissionPaymentModel.getAvailableBookingsForStaff(req.user.id);
      res.json({
        success: true,
        count: bookings.length,
        data: bookings
      });
    } catch (err) {
      next(err);
    }
  },

  // 0b. Nhân viên tiếp nhận công việc & thanh toán chiết khấu (POST /api/staff/tasks/:id/accept)
  async acceptBooking(req, res, next) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { payment_method = 'wallet', idempotency_key } = req.body;

      const result = await CommissionPaymentModel.initiatePayment({
        bookingId: taskId,
        staffId: req.user.id,
        paymentMethod: payment_method,
        idempotencyKey: idempotency_key || null
      });

      if (result.requires_bank_transfer) {
        return res.status(200).json({
          success: true,
          requires_bank_transfer: true,
          code: 'PAYMENT_REQUIRED',
          message: result.message,
          data: result.data
        });
      }

      return res.status(200).json({
        success: true,
        requires_bank_transfer: false,
        message: result.message,
        data: result.data
      });
    } catch (err) {
      next(err);
    }
  },

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

      const photos = await BookingModel.getJobPhotos(taskId);
      booking.photos = photos || [];

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
      if (!/^[a-f0-9]{48}\.(jpg|jpeg|png|webp)$/i.test(filename)) {
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
        const signature = Buffer.alloc(4);
        await fileHandle.read(signature, 0, 4, 0);
        await fileHandle.close();
        const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
        const isPng = signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47;
        const isWebp = signature[0] === 0x52 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x46;
        if (!isJpeg && !isPng && !isWebp) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Tệp tải lên không phải ảnh hợp lệ (hỗ trợ JPEG, PNG, WebP).' });
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
        const effectiveArea = (areaName && typeof areaName === 'string' && areaName.trim())
          ? areaName.trim()
          : (areas[0] || 'Khu vực làm việc');

        let effectiveAngleId = angleId;
        if (!effectiveAngleId || typeof effectiveAngleId !== 'string' || effectiveAngleId.trim() === '') {
          effectiveAngleId = `angle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        if (!['before', 'after'].includes(stage)) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Giai đoạn chụp ảnh không hợp lệ (phải là before hoặc after).' });
        }

        if (stage === 'before' && booking.status !== 'arrived') {
          await fs.unlink(file.path);
          return res.status(409).json({
            success: false,
            message: 'Ảnh Trước chỉ được thêm sau khi nhân viên đã xác nhận đến nơi (arrived).'
          });
        }
        if (stage === 'after' && booking.status !== 'in_progress') {
          await fs.unlink(file.path);
          return res.status(409).json({
            success: false,
            message: 'Ảnh Sau chỉ được thêm khi công việc đang được thực hiện (in_progress).'
          });
        }

        const parsedCapturedAt = capturedAt ? new Date(capturedAt) : new Date();
        const now = Date.now();
        if (Number.isNaN(parsedCapturedAt.getTime()) || parsedCapturedAt.getTime() > now + 5 * 60 * 1000) {
          await fs.unlink(file.path);
          return res.status(400).json({ success: false, message: 'Thời điểm chụp ảnh không hợp lệ.' });
        }

        const lat = (latitude !== undefined && latitude !== '' && !isNaN(latitude) && Number(latitude) >= -90 && Number(latitude) <= 90) ? Number(latitude) : 0;
        const lng = (longitude !== undefined && longitude !== '' && !isNaN(longitude) && Number(longitude) >= -180 && Number(longitude) <= 180) ? Number(longitude) : 0;

        const photos = await BookingModel.getJobPhotos(taskId);
        if (stage === 'after') {
          const matchingBefore = photos.find(photo => photo.stage === 'before' && (photo.angle_id === effectiveAngleId || photo.area_name === effectiveArea));
          if (matchingBefore) {
            effectiveAngleId = matchingBefore.angle_id;
          } else {
            await fs.unlink(file.path);
            return res.status(409).json({ success: false, message: 'Ảnh Sau phải tương ứng với một góc hoặc khu vực Trước đã lưu.' });
          }
        }

        const imageUrl = `/staff/photos/${file.filename}`;

        // Kiểm tra xem đã có ảnh tại góc này chưa -> Cho phép chụp lại / thay thế ảnh
        const existingPhoto = photos.find(photo =>
          photo.stage === stage && photo.area_name === effectiveArea && photo.angle_id === effectiveAngleId
        );

        if (existingPhoto) {
          const oldFilename = path.basename(existingPhoto.image_url);
          await fs.unlink(path.join(uploadDirectory, oldFilename)).catch(() => {});
          await db.query(
            `UPDATE booking_job_photos 
             SET image_url = ?, captured_at = ?, latitude = ?, longitude = ?, created_at = NOW()
             WHERE id = ?`,
            [imageUrl, parsedCapturedAt, lat, lng, existingPhoto.id]
          );

          return res.status(200).json({
            success: true,
            message: `Đã thay thế và cập nhật ảnh ${stage === 'before' ? 'Trước' : 'Sau'} thành công.`,
            data: {
              id: existingPhoto.id,
              area_name: effectiveArea,
              angle_id: effectiveAngleId,
              stage,
              image_url: imageUrl,
              captured_at: parsedCapturedAt,
              latitude: lat,
              longitude: lng,
              is_replacement: true
            }
          });
        }

        const result = await BookingModel.addJobPhoto({
          booking_id: taskId,
          area_name: effectiveArea,
          angle_id: effectiveAngleId,
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
          message: `Đã lưu ảnh ${stage === 'before' ? 'Trước' : 'Sau'} thành công.`,
          data: {
            id: result.insertId,
            area_name: effectiveArea,
            angle_id: effectiveAngleId,
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

      // Nghiệp vụ mới: Nhân viên nhận ca bắt buộc phải thanh toán chiết khấu trước khi nhận đơn
      if (!isSameStatus && status === 'confirmed') {
        const { creditWallet } = await WalletModel.getOrCreateStaffWallets(req.user.id);
        const creditBalance = parseFloat(creditWallet.balance) || 0;
        if (creditBalance < 0) {
          return res.status(403).json({
            success: false,
            code: 'INSUFFICIENT_CREDIT_BALANCE',
            message: `Ví tín dụng đang âm (${creditBalance.toLocaleString('vi-VN')} đ). Không thể nhận việc khi ví đang âm.`,
            data: { credit_balance: creditBalance }
          });
        }

        const paymentResult = await CommissionPaymentModel.initiatePayment({
          bookingId: taskId,
          staffId: req.user.id,
          paymentMethod: req.body.payment_method || 'wallet',
          idempotencyKey: req.body.idempotency_key || null
        });

        if (paymentResult.requires_bank_transfer) {
          return res.status(200).json({
            success: true,
            requires_bank_transfer: true,
            code: 'PAYMENT_REQUIRED',
            message: paymentResult.message,
            data: paymentResult.data
          });
        }

        const updated = await BookingModel.getById(taskId);
        return res.json({
          success: true,
          requires_bank_transfer: false,
          message: paymentResult.message || `Đã thanh toán chiết khấu và nhận công việc #${updated.booking_code}.`,
          data: updated,
          commission: paymentResult.data
        });
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
          message: 'Cần chụp và lưu ít nhất 1 ảnh Trước khi làm việc (Before).'
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

      if (status === 'cancelled') {
        try {
          await CommissionPaymentModel.handleCancellationRefund({
            bookingId: taskId,
            cancelReason: sanitizedCancelReason,
            fault: 'staff',
            adminId: req.user.id
          });
        } catch (commErr) {
          console.error('Lỗi ghi nhận hoàn chiết khấu khi nhân viên hủy ca:', commErr.message);
        }
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
          // Khôi phục lại trạng thái cũ của công việc nếu quyết toán thất bại
          await BookingModel.updateStaffTaskStatus(
            taskId, req.user.id, booking.status, booking.staff_notes || '', '', 'completed'
          );
          return res.status(settleErr.statusCode || 400).json({
            success: false,
            message: `Quyết toán thù lao thất bại: ${settleErr.message || 'Lỗi hệ thống ví'}. Trạng thái công việc chưa được cập nhật.`
          });
        }

        if (!settlementResult || !settlementResult.success) {
          await BookingModel.updateStaffTaskStatus(
            taskId, req.user.id, booking.status, booking.staff_notes || '', '', 'completed'
          );
          return res.status(400).json({
            success: false,
            message: 'Quyết toán thù lao không thành công. Trạng thái công việc chưa được cập nhật.'
          });
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
