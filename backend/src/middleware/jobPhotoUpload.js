const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const uploadDirectory = path.join(__dirname, '../../uploads/job-photos');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    callback(null, `${crypto.randomBytes(24).toString('hex')}.jpg`);
  }
});

const uploadJobPhoto = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Ảnh tải lên phải là tệp ảnh hợp lệ (JPEG, PNG hoặc WebP).');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  }
}).single('photo');

module.exports = { uploadJobPhoto, uploadDirectory };
