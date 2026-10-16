const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const PartnerModel = require('../models/partnerModel');
const { getJwtSecret, JWT_EXPIRES_IN } = require('../config/jwt');
const { sanitizeInput } = require('../utils/sanitize');

// Tạo JWT Token cho người dùng
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Bộ nhớ chống brute-force đăng nhập (Tối đa 5 lần sai trong 15 phút)
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function checkRateLimit(key) {
  const now = Date.now();
  const entry = failedLoginAttempts.get(key);
  if (!entry) return { blocked: false };
  if (now > entry.resetTime) {
    failedLoginAttempts.delete(key);
    return { blocked: false };
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    const remainingMins = Math.ceil((entry.resetTime - now) / 60000);
    return { blocked: true, remainingMins };
  }
  return { blocked: false };
}

function recordFailure(key) {
  const now = Date.now();
  const entry = failedLoginAttempts.get(key);
  if (!entry || now > entry.resetTime) {
    failedLoginAttempts.set(key, { count: 1, resetTime: now + LOCKOUT_DURATION_MS });
  } else {
    entry.count += 1;
  }
}

function recordSuccess(key) {
  failedLoginAttempts.delete(key);
}

// Bộ nhớ hạn chế tần suất đăng ký tài khoản (Tối đa 10 tài khoản / IP / giờ)
const registrationAttempts = new Map();
const MAX_REGISTRATIONS_PER_IP = 10;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

function checkRegisterRateLimit(ip) {
  const now = Date.now();
  const entry = registrationAttempts.get(ip);
  if (!entry || now > entry.resetTime) {
    registrationAttempts.set(ip, { count: 1, resetTime: now + REGISTRATION_WINDOW_MS });
    return { blocked: false };
  }
  if (entry.count >= MAX_REGISTRATIONS_PER_IP) {
    const remainingMins = Math.ceil((entry.resetTime - now) / 60000);
    return { blocked: true, remainingMins };
  }
  entry.count += 1;
  return { blocked: false };
}

// Bộ nhớ chống brute-force đổi mật khẩu (Tối đa 5 lần sai trong 15 phút)
const failedPasswordChangeAttempts = new Map();
function checkPasswordChangeRateLimit(userId) {
  const now = Date.now();
  const entry = failedPasswordChangeAttempts.get(userId);
  if (!entry) return { blocked: false };
  if (now > entry.resetTime) {
    failedPasswordChangeAttempts.delete(userId);
    return { blocked: false };
  }
  if (entry.count >= 5) {
    const remainingMins = Math.ceil((entry.resetTime - now) / 60000);
    return { blocked: true, remainingMins };
  }
  return { blocked: false };
}
function recordPasswordChangeFailure(userId) {
  const now = Date.now();
  const entry = failedPasswordChangeAttempts.get(userId);
  if (!entry || now > entry.resetTime) {
    failedPasswordChangeAttempts.set(userId, { count: 1, resetTime: now + (15 * 60 * 1000) });
  } else {
    entry.count += 1;
  }
}
function recordPasswordChangeSuccess(userId) {
  failedPasswordChangeAttempts.delete(userId);
}

const authController = {
  // 1. Đăng ký tài khoản mới (POST /api/auth/register)
  async register(req, res, next) {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const regRateCheck = checkRegisterRateLimit(clientIp);
      if (regRateCheck.blocked) {
        return res.status(429).json({
          success: false,
          code: 'TOO_MANY_REGISTRATIONS',
          message: `IP của bạn đã đăng ký quá nhiều tài khoản. Vui lòng thử lại sau ${regRateCheck.remainingMins} phút.`
        });
      }

      const { name, email, password, phone, address } = req.body;

      // Kiểm tra dữ liệu đầu vào (kiểu dữ liệu và định dạng)
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập họ và tên của bạn.' });
      }
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      }
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Kiểm tra xem email đã được đăng ký người dùng chưa
      const existingUser = await UserModel.findByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ success: false, message: 'Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.' });
      }

      // Bảo vệ Bug 11: Ngăn chặn kẻ xấu chiếm email của ứng viên đối tác đang chờ duyệt
      const pendingPartner = await PartnerModel.findByEmail(normalizedEmail);
      if (pendingPartner && pendingPartner.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'Email này hiện đang trong quá trình xét duyệt hồ sơ đối tác. Không thể tạo thêm tài khoản khách hàng.'
        });
      }

      // Mã hóa mật khẩu bằng bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Lưu người dùng vào Database
      const userId = await UserModel.create({
        name: sanitizeInput(name),
        email: normalizedEmail,
        password: hashedPassword,
        phone: typeof phone === 'string' ? sanitizeInput(phone) : '',
        address: typeof address === 'string' ? sanitizeInput(address) : '',
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

      // Bảo vệ Bug 13: Validate email và password phải là chuỗi
      if (typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email hợp lệ.' });
      }
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const rateLimitKey = `${clientIp}_${normalizedEmail}`;

      // Giới hạn tần suất đăng nhập sai liên tiếp
      const rateCheck = checkRateLimit(rateLimitKey);
      if (rateCheck.blocked) {
        return res.status(429).json({
          success: false,
          code: 'TOO_MANY_ATTEMPTS',
          message: `Bạn đã đăng nhập sai quá ${MAX_FAILED_ATTEMPTS} lần liên tiếp. Vui lòng thử lại sau ${rateCheck.remainingMins} phút để đảm bảo an toàn.`
        });
      }

      // Tìm người dùng trong cơ sở dữ liệu
      const user = await UserModel.findByEmail(normalizedEmail);
      if (!user) {
        // Kiểm tra xem có phải là ứng viên đối tác không
        const partnerApp = await PartnerModel.findByEmail(normalizedEmail);
        if (partnerApp) {
          // BẢO VỆ BUG 13: Bắt buộc phải so khớp mật khẩu trước khi tiết lộ trạng thái hồ sơ đối tác
          const isPartnerMatch = await bcrypt.compare(password, partnerApp.password);
          if (!isPartnerMatch) {
            recordFailure(rateLimitKey);
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
          }

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

        recordFailure(rateLimitKey);
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
      }

      // So khớp mật khẩu với hash bcrypt
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        recordFailure(rateLimitKey);
        return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
      }

      // Đăng nhập đúng -> Xóa lịch sử đăng nhập sai
      recordSuccess(rateLimitKey);

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

      await UserModel.updateProfile(req.user.id, {
        name: sanitizeInput(name),
        phone: typeof phone === 'string' ? sanitizeInput(phone) : phone,
        address: typeof address === 'string' ? sanitizeInput(address) : address
      });
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
      const pwdRateCheck = checkPasswordChangeRateLimit(req.user.id);
      if (pwdRateCheck.blocked) {
        return res.status(429).json({
          success: false,
          code: 'TOO_MANY_ATTEMPTS',
          message: `Bạn đã thử đổi mật khẩu sai quá nhiều lần. Vui lòng thử lại sau ${pwdRateCheck.remainingMins} phút.`
        });
      }

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
        recordPasswordChangeFailure(req.user.id);
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
      }

      recordPasswordChangeSuccess(req.user.id);
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
