/**
 * ============================================================
 * KIỂM THỬ KHÔI PHỤC CHỨC NĂNG CHỤP ẢNH TRƯỚC / SAU & QUY TRÌNH NHÂN VIÊN
 * ============================================================
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, body = null, isMultipart = false, boundary = '') {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: 5000,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {})
      }
    };

    if (isMultipart) {
      reqOptions.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    } else if (!reqOptions.headers['Content-Type']) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        try {
          const json = JSON.parse(buffer.toString('utf8'));
          resolve({ status: res.statusCode, headers: res.headers, data: json, raw: buffer });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: buffer });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function buildMultipartFormData(fields, fileField, boundary) {
  const crlf = '\r\n';
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${value}${crlf}`));
  }

  if (fileField) {
    const { name, filename, contentType, buffer } = fileField;
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${name}"; filename="${filename}"${crlf}Content-Type: ${contentType}${crlf}${crlf}`));
    parts.push(buffer);
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  return Buffer.concat(parts);
}

// 1x1 valid JPEG Buffer
const sampleJpegBuffer = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
  0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
  0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

async function run() {
  console.log('===============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: PHOTO CHECKLIST & QUY TRÌNH 4 BƯỚC NHÂN VIÊN');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition, extra = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${extra}`);
    }
  }

  // 1. Đăng nhập Staff 1 (Bảo, ID 3), Customer và Admin
  const staff1Login = await request({ path: '/api/auth/login', method: 'POST' }, { email: 'staff@cleanova.vn', password: 'Staff@Cleanova2026!' });
  const staff1Token = staff1Login.data?.data?.token;
  const staff1Id = staff1Login.data?.data?.user?.id;

  const adminLogin = await request({ path: '/api/auth/login', method: 'POST' }, { email: 'admin@cleanova.vn', password: 'Admin@Cleanova2026!' });
  const adminToken = adminLogin.data?.data?.token;

  const customerLogin = await request({ path: '/api/auth/login', method: 'POST' }, { email: 'demo@nova.app', password: 'NovaDemo2026!' });
  const customerToken = customerLogin.data?.data?.token;

  assert('Đăng nhập Staff, Customer và Admin thành công', Boolean(staff1Token && adminToken && customerToken));

  // 2. Tạo một đơn hàng mới bằng Customer để test luồng hoàn chỉnh
  const bookingDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const createBookingRes = await request({
    path: '/api/bookings',
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` }
  }, {
    service_id: 1, // Dọn dẹp tiêu chuẩn
    booking_date: bookingDate,
    booking_time: '09:00:00',
    address: '123 Đường Test Ảnh Trước Sau, Cầu Giấy, Hà Nội',
    phone: '0988776655',
    area_size: 'medium',
    payment_method: 'cash',
    total_price: 300000
  });

  const bookingId = createBookingRes.data?.data?.id;
  assert('Tạo đơn hàng kiểm thử thành công', createBookingRes.status === 201 && Boolean(bookingId), `Status: ${createBookingRes.status}, Msg: ${createBookingRes.data?.message}`);

  // Admin phân công đơn này cho Staff 1 (Bảo)
  const assignRes = await request({
    path: `/api/admin/bookings/${bookingId}/assign`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { staff_id: staff1Id });

  assert('Admin phân công đơn cho Staff 1 thành công', assignRes.status === 200);

  // Đảm bảo status là confirmed
  await request({
    path: `/api/admin/bookings/${bookingId}/status`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` }
  }, { status: 'confirmed' });

  // 3. Kiểm tra API checklist: GET /api/staff/tasks/:id/checklist
  const checklistRes = await request({
    path: `/api/staff/tasks/${bookingId}/checklist`,
    headers: { Authorization: `Bearer ${staff1Token}` }
  });

  assert('Checklist trả về danh sách khu vực hợp lệ (không rỗng)', 
    checklistRes.status === 200 && Array.isArray(checklistRes.data?.data?.areas) && checklistRes.data.data.areas.length > 0,
    `Areas: ${JSON.stringify(checklistRes.data?.data?.areas)}`
  );

  const testArea = checklistRes.data?.data?.areas ? checklistRes.data.data.areas[0] : 'Khu vực làm việc';
  const testAngleId = 'angle-living-room-01';

  // 4. BƯỚC 1: ĐÃ ĐẾN NƠI (status -> arrived)
  const arriveRes = await request({
    path: `/api/staff/tasks/${bookingId}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, { status: 'arrived', staff_notes: 'Nhân viên đã đến cổng nhà khách' });

  assert('Bước 1: Cập nhật trạng thái "arrived" (Đã đến nơi) thành công', arriveRes.status === 200);

  // 5. BƯỚC 2: ẢNH TRƯỚC KHI LÀM VIỆC (stage = before)
  // 5a. Kiểm tra phân quyền: Customer token KHÔNG THỂ upload ảnh công việc của Staff -> 403 Forbidden
  const boundaryFake = '----WebKitFormBoundaryFake123';
  const fakeStaffBody = buildMultipartFormData({
    areaName: testArea,
    angleId: testAngleId,
    stage: 'before',
    capturedAt: new Date().toISOString()
  }, {
    name: 'photo',
    filename: 'before1.jpg',
    contentType: 'image/jpeg',
    buffer: sampleJpegBuffer
  }, boundaryFake);

  const unauthorizedUploadRes = await request({
    path: `/api/staff/tasks/${bookingId}/photos`,
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` }
  }, fakeStaffBody, true, boundaryFake);

  assert('Bảo mật: Người không phải nhân viên phụ trách không được upload ảnh (403 Forbidden)', unauthorizedUploadRes.status === 403);

  // 5b. Upload ảnh Trước hợp lệ bằng Staff 1
  const boundary1 = '----WebKitFormBoundaryStaff1';
  const beforePhotoBody = buildMultipartFormData({
    areaName: testArea,
    angleId: testAngleId,
    stage: 'before',
    capturedAt: new Date().toISOString(),
    latitude: '21.0285',
    longitude: '105.8542'
  }, {
    name: 'photo',
    filename: 'before_photo_1.jpg',
    contentType: 'image/jpeg',
    buffer: sampleJpegBuffer
  }, boundary1);

  const uploadBeforeRes = await request({
    path: `/api/staff/tasks/${bookingId}/photos`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, beforePhotoBody, true, boundary1);

  assert('Bước 2: Upload ảnh Trước khi làm việc thành công', uploadBeforeRes.status === 201 && uploadBeforeRes.data?.success === true);
  const beforeImageUrl = uploadBeforeRes.data?.data?.image_url;
  const beforeFilename = path.basename(beforeImageUrl || '');

  // 5c. Kiểm tra tải lại / xem ảnh qua API ảnh: GET /api/staff/photos/:filename
  const viewPhotoRes = await request({
    path: `/api/staff/photos/${beforeFilename}`,
    headers: { Authorization: `Bearer ${staff1Token}` }
  });

  assert('API truy xuất ảnh GET /api/staff/photos/:filename trả về nội dung ảnh chính xác', viewPhotoRes.status === 200 && viewPhotoRes.raw.length > 0);

  // 5d. Kiểm tra tính năng Chụp lại / Thay thế ảnh Trước: upload cùng angleId, stage 'before'
  const boundaryReplace = '----WebKitFormBoundaryReplace';
  const replaceBeforeBody = buildMultipartFormData({
    areaName: testArea,
    angleId: testAngleId,
    stage: 'before',
    capturedAt: new Date().toISOString(),
    latitude: '21.0285',
    longitude: '105.8542'
  }, {
    name: 'photo',
    filename: 'before_replaced.jpg',
    contentType: 'image/jpeg',
    buffer: sampleJpegBuffer
  }, boundaryReplace);

  const replaceBeforeRes = await request({
    path: `/api/staff/tasks/${bookingId}/photos`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, replaceBeforeBody, true, boundaryReplace);

  assert('Cho phép Chụp lại / Thay thế ảnh Trước không bị lỗi trùng khóa (200 OK & is_replacement: true)', 
    replaceBeforeRes.status === 200 && replaceBeforeRes.data?.data?.is_replacement === true);

  // 5e. Bắt đầu làm việc (status -> in_progress)
  const startWorkRes = await request({
    path: `/api/staff/tasks/${bookingId}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, { status: 'in_progress', staff_notes: 'Bắt đầu làm việc sau khi chụp ảnh trước' });

  assert('Bước 2: Nhấn "Bắt đầu làm việc" cập nhật trạng thái "in_progress" thành công', startWorkRes.status === 200);

  // 6. BƯỚC 3: HOÀN THÀNH CÔNG VIỆC - ẢNH SAU KHI LÀM VIỆC (stage = after)
  const boundaryAfter = '----WebKitFormBoundaryAfter';
  const afterPhotoBody = buildMultipartFormData({
    areaName: testArea,
    angleId: testAngleId,
    stage: 'after',
    capturedAt: new Date().toISOString(),
    latitude: '21.0285',
    longitude: '105.8542'
  }, {
    name: 'photo',
    filename: 'after_photo_1.jpg',
    contentType: 'image/jpeg',
    buffer: sampleJpegBuffer
  }, boundaryAfter);

  const uploadAfterRes = await request({
    path: `/api/staff/tasks/${bookingId}/photos`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, afterPhotoBody, true, boundaryAfter);

  assert('Bước 3: Upload ảnh Sau khi làm việc thành công', uploadAfterRes.status === 201 && uploadAfterRes.data?.success === true);

  // 6b. Kiểm tra tính độc lập: ảnh Trước và ảnh Sau không bị ghi đè, cả 2 cùng tồn tại trong checklist
  const verifyChecklistRes = await request({
    path: `/api/staff/tasks/${bookingId}/checklist`,
    headers: { Authorization: `Bearer ${staff1Token}` }
  });

  const photosInDb = verifyChecklistRes.data?.data?.photos || [];
  const beforeCount = photosInDb.filter(p => p.stage === 'before').length;
  const afterCount = photosInDb.filter(p => p.stage === 'after').length;

  assert('Ảnh Trước và ảnh Sau lưu độc lập, không bị ghi đè lẫn nhau (Before count >= 1, After count >= 1)', 
    beforeCount >= 1 && afterCount >= 1,
    `Before: ${beforeCount}, After: ${afterCount}`);

  // 7. BƯỚC 4: THU TIỀN VÀ HOÀN TẤT
  // Thử hoàn thành khi chưa thu tiền mặt -> Backend phải từ chối (409)
  const prematureCompleteRes = await request({
    path: `/api/staff/tasks/${bookingId}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, { status: 'completed' });

  assert('Bảo vệ doanh thu: Không cho phép hoàn thành đơn tiền mặt khi chưa xác nhận thu tiền (409 Conflict)', prematureCompleteRes.status === 409);

  // Xác nhận thu tiền mặt
  const confirmCashRes = await request({
    path: `/api/staff/tasks/${bookingId}/cash-payment`,
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` }
  });

  assert('Bước 4: Xác nhận thu tiền mặt thành công', confirmCashRes.status === 200 && confirmCashRes.data?.success === true);

  // Hoàn tất đơn hàng
  const completeRes = await request({
    path: `/api/staff/tasks/${bookingId}/status`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staff1Token}` }
  }, { status: 'completed', staff_notes: 'Hoàn tất toàn bộ công việc và bàn giao sạch sẽ' });

  assert('Hoàn tất đơn hàng "completed" thành công sau khi có ảnh Sau và xác nhận thanh toán', completeRes.status === 200);

  // 8. TẢI LẠI TRANG / TÍNH BỀN VỮNG TRONG CƠ SỞ DỮ LIỆU
  const taskDetailRes = await request({
    path: `/api/staff/tasks/${bookingId}`,
    headers: { Authorization: `Bearer ${staff1Token}` }
  });

  const taskData = taskDetailRes.data?.data;
  assert('Dữ liệu ảnh bền vững: Tải lại đơn hàng vẫn hiển thị before_photo_count và after_photo_count', 
    taskData && Number(taskData.before_photo_count) >= 1 && Number(taskData.after_photo_count) >= 1,
    `Data: Before=${taskData?.before_photo_count}, After=${taskData?.after_photo_count}`);

  assert('Chi tiết đơn đính kèm mảng photos đầy đủ', Array.isArray(taskData?.photos) && taskData.photos.length >= 2);

  // 9. Kiểm tra giao diện staff.html không còn nhãn "Bắt đầu ca chăm sóc"
  const staffHtmlContent = fs.readFileSync('frontend/staff.html', 'utf8');
  assert('Giao diện staff.html KHÔNG CÒN nhãn "Bắt đầu ca chăm sóc"', !staffHtmlContent.includes('Bắt đầu ca chăm sóc'));
  assert('Giao diện staff.html có nhãn chuẩn "Bắt đầu làm việc"', staffHtmlContent.includes('Bắt đầu làm việc'));
  assert('Giao diện staff.html có nhãn "Ảnh trước và sau khi hoàn thành"', staffHtmlContent.includes('Ảnh trước và sau khi hoàn thành'));
  assert('Giao diện hỗ trợ capture="environment" cho Camera điện thoại', staffHtmlContent.includes('capture="environment"'));

  console.log('\n===============================================================');
  console.log(`🎯 KẾT QUẢ: ${passed}/${total} KIỂM THỬ ĐẠT YÊU CẦU (${Math.round(passed/total * 100)}%)`);
  console.log('===============================================================\n');

  if (passed === total) {
    console.log('🎉 TẤT CẢ CÁC TIÊU CHÍ NGHIỆM THU ĐÃ VƯỢT QUA 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
