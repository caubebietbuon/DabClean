// ============================================================
// CLEANOVA BACKEND - Partner Controller (Đăng ký trở thành đối tác Cleanova)
// ============================================================
const bcrypt = require('bcryptjs');
const UserModel = require('../models/userModel');
const PartnerModel = require('../models/partnerModel');

const partnerController = {
  // Đăng ký hồ sơ đối tác mới (POST /api/partner/register)
  async register(req, res, next) {
    try {
      const {
        name,
        email,
        phone,
        password,
        confirm_password,
        address,
        work_area,
        experience,
        available_hours,
        bio,
        agree_terms
      } = req.body;

      // 1. Kiểm tra trường bắt buộc
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập họ và tên của bạn.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      }

      const cleanPhone = (phone || '').replace(/[\s.-]/g, '');
      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
      if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại Việt Nam hợp lệ (10 chữ số).' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có tối thiểu 6 ký tự.' });
      }

      if (confirm_password && password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
      }

      if (!address || !address.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ liên hệ hiện tại.' });
      }

      if (!work_area || !work_area.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn khu vực làm việc mong muốn.' });
      }

      if (agree_terms !== true && agree_terms !== 'true' && agree_terms !== 'on' && agree_terms !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng đọc và tích chọn đồng ý với điều khoản đăng ký đối tác & chính sách dữ liệu cá nhân.'
        });
      }

      // 2. Kiểm tra email đã có trong bảng users
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email này đã tồn tại trong hệ thống Cleanova. Vui lòng đăng nhập hoặc sử dụng email khác.'
        });
      }

      // 3. Kiểm tra email đã gửi hồ sơ đối tác trước đó chưa
      const existingPartnerEmail = await PartnerModel.findByEmail(email);
      if (existingPartnerEmail) {
        const statusText = existingPartnerEmail.status === 'pending'
          ? 'đang chờ xét duyệt'
          : (existingPartnerEmail.status === 'approved' ? 'đã được phê duyệt' : 'đã được xử lý');
        return res.status(409).json({
          success: false,
          message: `Email này đã gửi hồ sơ đối tác (${statusText}). Vui lòng liên hệ ban quản trị nếu cần hỗ trợ.`
        });
      }

      // 4. Kiểm tra số điện thoại trùng lặp
      const existingPartnerPhone = await PartnerModel.findByPhone(cleanPhone);
      if (existingPartnerPhone) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được sử dụng để nộp hồ sơ đối tác.'
        });
      }

      // 5. Mã hóa mật khẩu bảo mật bằng bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 6. Lưu hồ sơ ứng tuyển với trạng thái mặc định 'pending'
      // Tuyệt đối không cấp quyền Admin hoặc Staff hoạt động tự động
      const applicationId = await PartnerModel.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone,
        password: hashedPassword,
        address: address.trim(),
        work_area: work_area.trim(),
        experience: experience || '',
        available_hours: available_hours || '',
        bio: bio || '',
        status: 'pending'
      });

      res.status(201).json({
        success: true,
        message: 'Hồ sơ của bạn đã được gửi. CleanNova sẽ xử lý theo quy trình xét duyệt hiện tại.',
        data: {
          id: applicationId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: cleanPhone,
          work_area: work_area.trim(),
          status: 'pending'
        }
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = partnerController;
