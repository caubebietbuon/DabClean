// ============================================================
// CLEANOVA BACKEND - Admin Controller (Quản trị viên & Phân quyền)
// ============================================================
const bcrypt = require('bcryptjs');
const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const UserModel = require('../models/userModel');
const PartnerModel = require('../models/partnerModel');

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

      // Ghi nhật ký thao tác
      await UserModel.logAudit(req.user.id, 'UPDATE_BOOKING_STATUS', id, 'booking', `Cập nhật trạng thái đơn #${booking.booking_code} thành ${status}`);

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái đơn ${booking.booking_code} thành "${status}".`
      });
    } catch (err) {
      next(err);
    }
  },

  // 4. Phân công nhân viên thực hiện đơn đặt lịch (PUT /api/admin/bookings/:id/assign)
  async assignBookingStaff(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id, 10);
      const { staff_id } = req.body;

      const booking = await BookingModel.getById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt lịch này.' });
      }

      let staffName = 'Chưa phân công';
      if (staff_id) {
        const staff = await UserModel.findById(parseInt(staff_id, 10));
        if (!staff || staff.role !== 'staff') {
          return res.status(400).json({ success: false, message: 'Nhân viên được chọn không hợp lệ hoặc không có vai trò Staff.' });
        }
        if (staff.status === 'inactive') {
          return res.status(400).json({ success: false, message: 'Nhân viên này đang bị vô hiệu hóa, không thể phân công việc mới.' });
        }
        staffName = staff.name;
        await BookingModel.assignStaff(bookingId, staff.id);
      } else {
        await BookingModel.assignStaff(bookingId, null);
      }

      await UserModel.logAudit(req.user.id, 'ASSIGN_STAFF', bookingId, 'booking', `Phân công đơn #${booking.booking_code} cho nhân viên: ${staffName}`);

      res.json({
        success: true,
        message: staff_id ? `Đã phân công đơn ${booking.booking_code} cho nhân viên ${staffName}.` : `Đã hủy phân công cho đơn ${booking.booking_code}.`
      });
    } catch (err) {
      next(err);
    }
  },

  // 5. Thêm gói dịch vụ mới (POST /api/admin/services)
  async createService(req, res, next) {
    try {
      const { name, slug, description, short_description, base_price, price_unit, duration_estimate, icon } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Tên dịch vụ không được để trống.' });
      }
      if (!base_price || isNaN(base_price)) {
        return res.status(400).json({ success: false, message: 'Giá dịch vụ phải là số hợp lệ.' });
      }

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
      await UserModel.logAudit(req.user.id, 'CREATE_SERVICE', serviceId, 'service', `Thêm mới dịch vụ: ${newService.name}`);

      res.status(201).json({
        success: true,
        message: 'Thêm dịch vụ mới thành công!',
        data: newService
      });
    } catch (err) {
      next(err);
    }
  },

  // 6. Cập nhật gói dịch vụ (PUT /api/admin/services/:id)
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
      await UserModel.logAudit(req.user.id, 'UPDATE_SERVICE', id, 'service', `Cập nhật dịch vụ: ${updated.name}`);

      res.json({
        success: true,
        message: 'Cập nhật dịch vụ thành công!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 7. Xóa dịch vụ (DELETE /api/admin/services/:id)
  async deleteService(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const service = await ServiceModel.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ cần xóa.' });
      }

      await ServiceModel.delete(id);
      await UserModel.logAudit(req.user.id, 'DELETE_SERVICE', id, 'service', `Xóa dịch vụ: ${service.name}`);

      res.json({
        success: true,
        message: `Đã xóa dịch vụ "${service.name}".`
      });
    } catch (err) {
      next(err);
    }
  },

  // ------------------------------------------------------------
  // QUẢN LÝ TÀI KHOẢN (ACCOUNT MANAGEMENT & RBAC)
  // ------------------------------------------------------------

  // 8. Lấy danh sách toàn bộ người dùng (GET /api/admin/users)
  // Hỗ trợ: Tìm kiếm (search), Lọc vai trò (role), Lọc trạng thái (status), Phân trang (page, limit)
  async getAllUsers(req, res, next) {
    try {
      let users = await UserModel.getAll();

      const { search, role, status, page = 1, limit = 10 } = req.query;

      // Tìm kiếm theo tên hoặc email
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        users = users.filter(u => 
          (u.name && u.name.toLowerCase().includes(q)) || 
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q))
        );
      }

      // Lọc theo vai trò (customer, staff, admin)
      if (role && role !== 'all') {
        const normalizedRole = (role === 'user' || role === 'customer') ? ['user', 'customer'] : [role];
        users = users.filter(u => normalizedRole.includes(u.role));
      }

      // Lọc theo trạng thái (active, inactive)
      if (status && status !== 'all') {
        users = users.filter(u => (u.status || 'active') === status);
      }

      const totalItems = users.length;
      const currentPage = Math.max(1, parseInt(page, 10) || 1);
      const itemsPerPage = Math.max(1, parseInt(limit, 10) || 10);
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedUsers = users.slice(startIndex, startIndex + itemsPerPage);

      res.json({
        success: true,
        pagination: {
          total: totalItems,
          page: currentPage,
          limit: itemsPerPage,
          totalPages
        },
        count: paginatedUsers.length,
        data: paginatedUsers
      });
    } catch (err) {
      next(err);
    }
  },

  // 9. Xem chi tiết tài khoản (GET /api/admin/users/:id)
  async getUserDetail(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng này.' });
      }

      // Lấy danh sách đơn của người dùng
      let bookings = [];
      try {
        bookings = await BookingModel.getByUserId(id);
      } catch (e) {
        bookings = [];
      }

      res.json({
        success: true,
        data: {
          user,
          total_bookings: bookings.length,
          recent_bookings: bookings.slice(0, 5)
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 10. Chỉnh sửa thông tin tài khoản (PATCH /api/admin/users/:id)
  async updateUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản để chỉnh sửa.' });
      }

      const { name, phone, address, role, status, lock_reason } = req.body;

      // Quy tắc an toàn: Nếu hạ quyền tài khoản Admin hiện tại xuống vai trò khác,
      // phải kiểm tra xem có còn ít nhất 1 Admin khác đang hoạt động không!
      if (targetUser.role === 'admin' && role && role !== 'admin') {
        const activeAdmins = await UserModel.countActiveAdmins();
        if (activeAdmins <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Không thể hạ quyền: Đây là Quản trị viên (Admin) cuối cùng đang hoạt động trong hệ thống!'
          });
        }
      }

      const validRoles = ['customer', 'user', 'staff', 'admin'];
      const updatedRole = role && validRoles.includes(role) ? role : targetUser.role;

      const validStatuses = ['active', 'inactive'];
      const updatedStatus = status && validStatuses.includes(status) ? status : (targetUser.status || 'active');

      if (updatedStatus === 'inactive' && (!lock_reason || !lock_reason.trim()) && !targetUser.lock_reason) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do khi khóa tài khoản khách hàng hoặc nhân viên!'
        });
      }

      const finalLockReason = updatedStatus === 'inactive' 
        ? (lock_reason !== undefined ? lock_reason.trim() : targetUser.lock_reason) 
        : null;

      await UserModel.updateAdminUser(id, {
        name: name !== undefined ? name : targetUser.name,
        phone: phone !== undefined ? phone : targetUser.phone,
        address: address !== undefined ? address : targetUser.address,
        role: updatedRole,
        status: updatedStatus,
        lock_reason: finalLockReason
      });

      await UserModel.logAudit(req.user.id, 'UPDATE_USER_INFO', id, 'user', `Cập nhật thông tin tài khoản ${targetUser.email} (Role: ${updatedRole}, Status: ${updatedStatus}${finalLockReason ? `, Lý do khóa: ${finalLockReason}` : ''})`);

      const updated = await UserModel.findById(id);
      res.json({
        success: true,
        message: 'Cập nhật thông tin tài khoản thành công!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  },

  // 11. Bật/Tắt trạng thái tài khoản (PATCH /api/admin/users/:id/status)
  // Khóa tài khoản khách hàng / nhân viên BẮT BUỘC có lý do
  async toggleUserStatus(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản này.' });
      }

      const { status, reason } = req.body;
      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: "Trạng thái phải là 'active' hoặc 'inactive'." });
      }

      // Khóa tài khoản bắt buộc phải có lý do
      if (status === 'inactive' && (!reason || !reason.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp lý do khi khóa tài khoản khách hàng hoặc nhân viên!'
        });
      }

      // Quy tắc bảo mật bắt buộc:
      // 1. Không cho phép Admin tự vô hiệu hóa chính mình
      if (id === req.user.id && status === 'inactive') {
        return res.status(400).json({
          success: false,
          message: 'Thao tác bị từ chối: Bạn không thể tự vô hiệu hóa tài khoản quản trị của chính mình!'
        });
      }

      // 2. Không cho phép vô hiệu hóa Admin cuối cùng
      if (targetUser.role === 'admin' && status === 'inactive') {
        const activeAdmins = await UserModel.countActiveAdmins();
        if (activeAdmins <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Thao tác bị từ chối: Không thể vô hiệu hóa Quản trị viên (Admin) duy nhất còn hoạt động trong hệ thống!'
          });
        }
      }

      const finalReason = status === 'inactive' ? reason.trim() : null;
      await UserModel.updateStatus(id, status, finalReason);

      const actionText = status === 'active' ? 'Kích hoạt lại' : 'Khóa';
      const auditDetails = status === 'inactive' 
        ? `Khóa tài khoản ${targetUser.email} (Lý do: ${finalReason})`
        : `Kích hoạt lại tài khoản ${targetUser.email}`;
      await UserModel.logAudit(req.user.id, status === 'active' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', id, 'user', auditDetails);

      res.json({
        success: true,
        message: `${actionText} tài khoản "${targetUser.name || targetUser.email}" thành công!`,
        data: {
          id,
          status,
          lock_reason: finalReason
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 12. Xóa tài khoản có kiểm tra an toàn nghiêm ngặt (DELETE /api/admin/users/:id)
  async deleteUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const targetUser = await UserModel.findById(id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản cần xóa.' });
      }

      // Quy tắc bảo mật 1: Admin không thể xóa chính mình
      if (id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Thao tác bị từ chối: Bạn không thể tự xóa tài khoản của chính mình!'
        });
      }

      // Quy tắc bảo mật 2: Không được xóa Admin cuối cùng
      if (targetUser.role === 'admin') {
        const activeAdmins = await UserModel.countActiveAdmins();
        if (activeAdmins <= 1) {
          return res.status(400).json({
            success: false,
            message: 'Thao tác bị từ chối: Không thể xóa Quản trị viên (Admin) duy nhất của hệ thống!'
          });
        }
      }

      // Quy tắc bảo vệ toàn vẹn dữ liệu 3:
      // Kiểm tra đơn đặt lịch liên kết. Không được xóa dây chuyền gây mất lịch sử giao dịch!
      const hasOrders = await UserModel.hasBookings(id);
      if (hasOrders) {
        return res.status(400).json({
          success: false,
          code: 'HAS_LINKED_BOOKINGS',
          message: 'Tài khoản này đã có lịch sử đơn đặt dịch vụ. Để đảm bảo tính toàn vẹn dữ liệu kế toán và lịch sử giao dịch, hệ thống không cho phép xóa vĩnh viễn mà khuyến nghị bạn chuyển sang "Vô hiệu hóa tài khoản".'
        });
      }

      await UserModel.delete(id);
      await UserModel.logAudit(req.user.id, 'DELETE_USER', id, 'user', `Xóa tài khoản vĩnh viễn: ${targetUser.email} (ID: ${id})`);

      res.json({
        success: true,
        message: `Đã xóa tài khoản "${targetUser.name || targetUser.email}" thành công.`
      });
    } catch (err) {
      next(err);
    }
  },

  // ------------------------------------------------------------
  // QUẢN LÝ NHÂN VIÊN (STAFF MANAGEMENT)
  // ------------------------------------------------------------

  // 13. Lấy danh sách nhân viên Cleanova (GET /api/admin/staff)
  async getAllStaff(req, res, next) {
    try {
      const staffList = await UserModel.getStaffList();
      const allBookings = await BookingModel.getAll();

      // Đính kèm số lượng công việc được giao cho từng nhân viên
      const staffWithTaskCount = staffList.map(st => {
        const assignedTasks = allBookings.filter(b => b.staff_id === st.id);
        const activeTasks = assignedTasks.filter(b => b.status === 'confirmed' || b.status === 'in_progress');
        const completedTasks = assignedTasks.filter(b => b.status === 'completed');

        return {
          ...st,
          total_assigned: assignedTasks.length,
          active_tasks: activeTasks.length,
          completed_tasks: completedTasks.length
        };
      });

      res.json({
        success: true,
        count: staffWithTaskCount.length,
        data: staffWithTaskCount
      });
    } catch (err) {
      next(err);
    }
  },

  // 14. Tạo mới tài khoản nhân viên (POST /api/admin/staff)
  // Yêu cầu mật khẩu an toàn, không dùng mật khẩu mặc định dễ đoán
  async createStaff(req, res, next) {
    try {
      const { name, email, password, phone, address } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Họ tên nhân viên không được để trống.' });
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Địa chỉ email không đúng định dạng.' });
      }

      // Kiểm tra độ an toàn của mật khẩu nhân viên
      if (!password || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu nhân viên phải có ít nhất 8 ký tự để đảm bảo bảo mật hệ thống.'
        });
      }

      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu nhân viên phải bao gồm cả chữ cái và số.'
        });
      }

      // Kiểm tra email đã tồn tại chưa
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email này đã được sử dụng trong hệ thống.' });
      }

      // Băm mật khẩu bằng bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const staffId = await UserModel.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        phone: phone || '',
        address: address || '',
        role: 'staff',
        status: 'active'
      });

      const newStaff = await UserModel.findById(staffId);
      await UserModel.logAudit(req.user.id, 'CREATE_STAFF', staffId, 'user', `Tạo tài khoản nhân viên mới: ${newStaff.name} (${newStaff.email})`);

      res.status(201).json({
        success: true,
        message: 'Tạo tài khoản nhân viên thành công!',
        data: newStaff
      });
    } catch (err) {
      next(err);
    }
  },

  // 15. Lấy danh sách công việc của một nhân viên cụ thể (GET /api/admin/staff/:id/tasks)
  async getStaffTasks(req, res, next) {
    try {
      const staffId = parseInt(req.params.id, 10);
      const staff = await UserModel.findById(staffId);
      if (!staff || staff.role !== 'staff') {
        return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên này.' });
      }

      const tasks = await BookingModel.getByStaffId(staffId);

      res.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone
        },
        count: tasks.length,
        data: tasks
      });
    } catch (err) {
      next(err);
    }
  },

  // 16. Lấy danh sách hồ sơ đối tác / nhân viên (GET /api/admin/partners)
  async getPartners(req, res, next) {
    try {
      const { status } = req.query;
      const partners = await PartnerModel.getAll(status);
      const pendingCount = await PartnerModel.countPending();
      res.json({
        success: true,
        count: partners.length,
        pending_count: pendingCount,
        data: partners
      });
    } catch (err) {
      next(err);
    }
  },

  // 17. Lấy chi tiết hồ sơ đối tác (GET /api/admin/partners/:id)
  async getPartnerDetail(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const partner = await PartnerModel.findById(id);
      if (!partner) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đối tác này.' });
      }
      res.json({
        success: true,
        data: partner
      });
    } catch (err) {
      next(err);
    }
  },

  // 18. Phê duyệt hồ sơ đối tác & Cấp quyền tài khoản Staff (PATCH /api/admin/partners/:id/approve)
  async approvePartner(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const partner = await PartnerModel.findById(id);
      if (!partner) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đối tác.' });
      }

      if (partner.status === 'approved') {
        return res.status(400).json({ success: false, message: 'Hồ sơ này đã được phê duyệt trước đó.' });
      }

      // Tạo hoặc kích hoạt tài khoản nhân viên (Role: staff, Status: active)
      let staffUserId = partner.user_id;
      const existingUser = await UserModel.findByEmail(partner.email);

      if (existingUser) {
        staffUserId = existingUser.id;
        await UserModel.updateRole(staffUserId, 'staff');
        await UserModel.updateStatus(staffUserId, 'active');
      } else {
        staffUserId = await UserModel.create({
          name: partner.name,
          email: partner.email,
          password: partner.password, // Mật khẩu đã được mã hóa bcrypt an toàn khi đăng ký
          phone: partner.phone,
          address: partner.address,
          role: 'staff',
          status: 'active'
        });
      }

      // Cập nhật trạng thái hồ sơ đối tác thành approved
      await PartnerModel.approve(id, {
        user_id: staffUserId,
        reviewed_by: req.user.id
      });

      // Ghi nhật ký quản trị
      await UserModel.logAudit(
        req.user.id,
        'APPROVE_PARTNER',
        id,
        'partner',
        `Phê duyệt hồ sơ đối tác ${partner.name} (${partner.email}), cấp quyền nhân viên Staff #${staffUserId}`
      );

      res.json({
        success: true,
        message: `Đã phê duyệt hồ sơ đối tác thành công và cấp quyền nhân viên cho ${partner.name}.`,
        data: {
          partner_id: id,
          staff_id: staffUserId,
          status: 'approved'
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 19. Từ chối hồ sơ đối tác (PATCH /api/admin/partners/:id/reject)
  async rejectPartner(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { rejection_reason } = req.body;
      const partner = await PartnerModel.findById(id);
      if (!partner) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đối tác.' });
      }

      await PartnerModel.reject(id, {
        rejection_reason: rejection_reason || 'Chưa đáp ứng tiêu chí đợt tuyển dụng này',
        reviewed_by: req.user.id
      });

      // Ghi nhật ký quản trị
      await UserModel.logAudit(
        req.user.id,
        'REJECT_PARTNER',
        id,
        'partner',
        `Từ chối hồ sơ đối tác ${partner.name} (${partner.email}). Lý do: ${rejection_reason || 'Không nêu'}`
      );

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái từ chối hồ sơ của ${partner.name}.`,
        data: {
          partner_id: id,
          status: 'rejected',
          rejection_reason
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = adminController;
