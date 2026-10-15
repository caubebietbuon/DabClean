// ============================================================
// CLEANOVA BACKEND - Express Application Initialization
// ============================================================
const express = require('express');
const cors = require('cors');
const path = require('path');

// Khởi tạo app Express
const app = express();

// Middleware cơ bản
app.use(cors({
  origin: '*', // Trong môi trường dev, cho phép gọi từ bất kỳ origin nào (Live Server 5500, 8080, v.v.)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nạp các Routes API
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const staffRoutes = require('./routes/staffRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Khai báo API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/partner', partnerRoutes);

// Proxy thông minh cho AI Module (Port 5100)
const http = require('http');
app.use('/api/ai', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: process.env.AI_PORT || 5100,
    path: `/api/ai${req.url}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${process.env.AI_PORT || 5100}`
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.status(503).json({
      success: false,
      message: 'Dịch vụ Cleanova AI hiện chưa phản hồi. Vui lòng đảm bảo server AI đang chạy trên cổng 5100.',
      error: err.message
    });
  });

  req.pipe(proxyReq, { end: true });
});

// Endpoint kiểm tra sức khỏe hệ thống (Health Check)
app.get('/api/health', (req, res) => {
  const db = require('./config/db');
  res.json({
    status: 'OK',
    app: 'Cleanova Fullstack API',
    version: '1.0.0',
    mysql_connected: db.isMySQLConnected(),
    timestamp: new Date().toISOString()
  });
});

// Phục vụ các file tĩnh Frontend từ thư mục frontend/
const frontendPath = path.join(__dirname, '../../frontend');

// Friendly clean routing cho trang Đăng ký đối tác & Khám phá Cleanova
app.get(['/partner/register', '/employee/register', '/partner-register'], (req, res) => {
  res.sendFile(path.join(frontendPath, 'partner-register.html'));
});

app.get(['/khampha', '/explore', '/about', '/gioi-thieu'], (req, res) => {
  res.sendFile(path.join(frontendPath, 'khampha.html'));
});

app.use(express.static(frontendPath));

// Xử lý trang lỗi 404 cho API
app.use('/api/*', notFoundHandler);

// Xử lý lỗi toàn cục hệ thống
app.use(errorHandler);

module.exports = app;
