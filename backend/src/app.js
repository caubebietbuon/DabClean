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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nạp các Routes API
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Khai báo API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);

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
app.use(express.static(frontendPath));

// Xử lý trang lỗi 404 cho API
app.use('/api/*', notFoundHandler);

// Xử lý lỗi toàn cục hệ thống
app.use(errorHandler);

module.exports = app;
