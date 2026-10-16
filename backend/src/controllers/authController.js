// ============================================================
// CLEANOVA BACKEND - Auth Controller
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const PartnerModel = require('../models/partnerModel');

// Tạo JWT Token cho người dùng
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'cleanova_super_secret_jwt_key_2026_modern_cleaning',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const authController = {
  // 1. Đăng ký tài khoản mới (POST /api/auth/register)
  async register(req, res, next) {
    try {
      const { name, email, password, phone, address } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập họ và tên của bạn.' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      }

      // Kiểm tra xem email đã được đăng ký chưa
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.' });
      }

      // Mã hóa mật khẩu bằng bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Lưu người dùng vào Database
      const userId = await UserModel.create({
        name,
        email,
        password: hashedPassword,
        phone: phone || '',
        address: address || '',
        role: 'user'
      });

      const newUser = await UserModel.findById(userId);
      const token = generateToken(newUser);

      res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công! Chào mừng bạn đến với Cleanova.',
        data: {
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            address: newUser.address,
            role: newUser.role
          }
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 2. Đăng nhập (POST /api/auth/login)
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập email đăng nhập.' });
      }
      if (!password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu.' });
      }

      // Tìm người dùng trong cơ sở dữ liệu
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Kiểm tra xem có phải là ứng viên đối tác đang chờ xét duyệt không
        const partnerApp = await PartnerModel.findByEmail(email);
        if (partnerApp) {
          if (partnerApp.status === 'pending') {
            return res.status(403).json({
              success: false,
              code: 'PARTNER_APPLICATION_PENDING',
              message: 'Hồ sơ đăng ký đối tác của bạn đang trong trạng thái chờ xét duyệt. Bạn sẽ có thể đăng nhập sau khi hồ sơ được Cleanova phê duyệt.'
            });
          }
          if (partnerApp.status === 'rejected') {
            return res.status(403).json({
              success: false,
              code: 'PARTNER_APPLICATION_REJECTED',
              message: 'Hồ sơ đối tác chưa được phê duyệt đợt này. Vui lòng liên hệ ban quản trị để biết thêm thông tin.'
            });
          }
        }
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
      }

      // So khớp mật khẩu với hash bcrypt
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
      }

      // Kiểm tra trạng thái hoạt động của tài khoản
      if (user.status === 'inactive' || user.status === 'deactivated') {
        const reasonMsg = user.lock_reason ? ` Lý do: "${user.lock_reason}".` : '';
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DEACTIVATED',
          message: `Tài khoản của bạn đã bị khóa.${reasonMsg} Vui lòng liên hệ ban quản trị Cleanova để được hỗ trợ.`
        });
      }

      const token = generateToken(user);

      res.json({
        success: true,
        message: 'Đăng nhập thành công!',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            role: user.role,
            status: user.status || 'active'
          }
        }
      });
    } catch (err) {
      next(err);
    }
  },

  // 3. Lấy thông tin người dùng hiện tại (GET /api/auth/me)
  async getMe(req, res) {
    res.json({
      success: true,
      data: {
        ...req.user,
        user: req.user
      }
    });
  },

  // 4. Cập nhật thông tin cá nhân (PUT /api/auth/profile)
  async updateProfile(req, res, next) {
    try {
      const { name, phone, address } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Họ và tên không được để trống.' });
      }

      await UserModel.updateProfile(req.user.id, { name, phone, address });
      const updatedUser = await UserModel.findById(req.user.id);

      res.json({
        success: true,
        message: 'Cập nhật thông tin cá nhân thành công!',
        data: { user: updatedUser }
      });
    } catch (err) {
      next(err);
    }
  },

  // 5. Đổi mật khẩu (PUT /api/auth/change-password)
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }

      const user = await UserModel.findByEmail(req.user.email);
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      await UserModel.updatePassword(req.user.id, hashedPassword);

      res.json({
        success: true,
        message: 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.'
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
