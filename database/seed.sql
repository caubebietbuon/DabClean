-- ============================================================
-- CLEANOVA DATABASE SEED DATA (Dữ liệu mẫu khởi tạo)
-- ============================================================

USE cleanova_db;

-- ------------------------------------------------------------
-- 1. DỮ LIỆU TÀI KHOẢN MẪU (users)
-- Mật khẩu đã được mã hóa bằng bcrypt (saltRounds = 10):
-- - admin@cleanova.vn / Admin@Cleanova2026! (Admin)
-- - staff@cleanova.vn / Staff@Cleanova2026! (Nhân viên)
-- - staff2@cleanova.vn / Staff@Cleanova2026! (Nhân viên)
-- - demo@nova.app / NovaDemo2026! (Khách hàng)
-- - locked@cleanova.vn / NovaDemo2026! (Khách hàng bị vô hiệu hóa)
-- ------------------------------------------------------------
INSERT INTO users (id, name, email, password, phone, address, role, status) VALUES
(1, 'Quản Trị Viên Cleanova', 'admin@cleanova.vn', '$2a$10$ZZn8Td.6jh83f7FySaJ/1OnHyXgbyE2yC9rmaOaiHv6sq4Hiraoja', '0912345678', 'Tòa nhà Cleanova, Cầu Giấy, Hà Nội', 'admin', 'active'),
(2, 'Nguyễn Tiến Đức', 'demo@nova.app', '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS', '0987654321', 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội', 'customer', 'active'),
(3, 'Trần Văn Bảo', 'staff@cleanova.vn', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', '0933445566', 'Số 12 Chùa Láng, Đống Đa, Hà Nội', 'staff', 'active'),
(4, 'Lê Thị Mai', 'staff2@cleanova.vn', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', '0944556677', 'Khu đô thị Ngoại Giao Đoàn, Bắc Từ Liêm, Hà Nội', 'staff', 'active'),
(5, 'Trần Thu Hà', 'ha.tran@example.com', '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS', '0901122334', 'Vinhomes Smart City, Nam Từ Liêm, Hà Nội', 'customer', 'active'),
(6, 'Tài Khoản Bị Khóa', 'locked@cleanova.vn', '$2a$10$getSjtuIQ9QP075adQ/jIe9o3SnWH/F3DzYo7m3ujMxu98fIq1DVS', '0999888777', 'Hà Nội', 'customer', 'inactive');

-- ------------------------------------------------------------
-- 2. DỮ LIỆU DỊCH VỤ VỆ SINH CHỦ ĐẠO (services)
-- Khớp hoàn toàn với các gói dịch vụ trên Landing Page
-- ------------------------------------------------------------
INSERT INTO services (id, name, slug, description, short_description, base_price, price_unit, duration_estimate, category, min_duration_hours, staff_wage_rate, icon, is_active) VALUES
(1, 
 'Dọn dẹp nhà cửa theo giờ', 
 'don-dep-theo-gio', 
 'Dịch vụ dọn dẹp linh hoạt theo nhu cầu thực tế: lau dọn phòng khách, hút bụi thảm, cọ rửa nhà vệ sinh, lau sàn và sắp xếp đồ dùng gọn gàng. Nhân viên mang đầy đủ dụng cụ vệ sinh chuyên dụng.', 
 'Lau chùi, dọn phòng khách, phòng ngủ, nhà bếp, toilet. Linh hoạt theo nhu cầu.', 
 150000.00, 
 'giờ', 
 '2 - 4 giờ', 
 'cleaning',
 1,
 105000.00,
 '⏱️', 
 1),

(2, 
 'Tổng vệ sinh Deep Cleaning', 
 'tong-ve-sinh-deep-cleaning', 
 'Gói vệ sinh toàn diện và chuyên sâu mọi ngóc ngách: vệ sinh trần, tường, khe cửa, lau kính hai mặt, tẩy cặn canxi nhà tắm, khử dầu mỡ bếp ăn công nghiệp. Phù hợp cho nhà ở định kỳ tháng/quý.', 
 'Vệ sinh toàn bộ diện tích nhà, làm sạch sâu mọi ngóc ngách. Chuẩn định kỳ.', 
 500000.00, 
 'lần', 
 '4 - 6 giờ', 
 'cleaning',
 1,
 350000.00,
 '✨', 
 1),

(3, 
 'Vệ sinh văn phòng & Workspace', 
 've-sinh-van-phong', 
 'Giải pháp vệ sinh định kỳ cho doanh nghiệp, công ty khởi nghiệp và không gian làm việc chung: lau bàn làm việc, hút bụi sàn thảm, đổ rác, vệ sinh pantry và phòng họp. Đảm bảo môi trường làm việc chuẩn 5 sao.', 
 'Định kỳ cho doanh nghiệp, đảm bảo môi trường làm việc sạch đẹp, chuyên nghiệp.', 
 300000.00, 
 'lần', 
 '2 - 3 giờ', 
 'cleaning',
 1,
 210000.00,
 '🏢', 
 1),

(4, 
 'Giặt Sofa, Nệm & Rèm cửa', 
 'giat-sofa-nem-rem', 
 'Quy trình giặt hút bụi chuyên sâu kết hợp phun hơi nước nóng 140°C để diệt khuẩn, tiêu diệt 99.9% rệp mạt bụi và vi nấm ký sinh trên bề mặt vải nỉ, da hoặc cao su tự nhiên.', 
 'Hút bụi chuyên sâu, khử khuẩn bằng hơi nước nóng. Trả lại vẻ mới cho nội thất.', 
 400000.00, 
 'món', 
 '1 - 2 giờ', 
 'cleaning',
 1,
 280000.00,
 '🛋️', 
 1),

(5, 
 'Vệ sinh sau xây dựng', 
 've-sinh-sau-xay-dung', 
 'Thu gom rác thô sau thi công, tẩy sạch sơn bám trên sàn đá/gỗ, hút sạch bụi mịn công nghiệp bằng máy công suất lớn và khử mùi xi măng, sơn tường trước khi gia chủ dọn vào ở.', 
 'Dọn dẹp thô, xử lý vết sơn, bụi mịn sau thi công. Sẵn sàng cho ngày dọn về.', 
 8000.00, 
 'm²', 
 '1 - 2 ngày', 
 'cleaning',
 1,
 5600.00,
 '🏗️', 
 1),

(6, 
 'Chăm sóc trẻ em tại nhà', 
 'cham-soc-tre-em', 
 'Dịch vụ bảo mẫu chăm sóc trẻ chuyên nghiệp tại nhà: đón bé, chuẩn bị bữa ăn nhẹ dinh dưỡng, hỗ trợ bé vệ sinh cá nhân, kèm bé học bài, đọc sách và tổ chức trò chơi phát triển tư duy lành mạnh theo độ tuổi. Nhân viên lý lịch minh bạch, chu đáo và kiên nhẫn.', 
 'Chăm sóc trẻ, hỗ trợ sinh hoạt, ăn uống và vui chơi lành mạnh theo độ tuổi.', 
 80000.00, 
 'giờ', 
 'Tối thiểu 2 giờ', 
 'care',
 2,
 60000.00,
 '👶', 
 1),

(7, 
 'Chăm sóc người cao tuổi tại nhà', 
 'cham-soc-nguoi-cao-tuoi', 
 'Dịch vụ điều dưỡng viên đồng hành cùng người cao tuổi: hỗ trợ người lớn tuổi sinh hoạt, chuẩn bị bữa ăn hợp khẩu vị, nhắc nhở uống thuốc đúng giờ theo chỉ định của bác sĩ, hỗ trợ đi dạo, trò chuyện tâm tình và giúp người cao tuổi vận động nhẹ nhàng an toàn.', 
 'Hỗ trợ sinh hoạt, ăn uống, nhắc thuốc và đồng hành cùng người cao tuổi.', 
 90000.00, 
 'giờ', 
 'Tối thiểu 2 giờ', 
 'care',
 2,
 70000.00,
 '👵', 
 1),

(8, 
 'Chăm sóc người bệnh tại nhà', 
 'cham-soc-nguoi-benh', 
 'Hỗ trợ sinh hoạt và chăm sóc thể chất thông thường cho người ốm, người sau phẫu thuật hoặc đang hồi phục sức khỏe: hỗ trợ vệ sinh cá nhân, thay ga giường, theo dõi chỉ số sinh tồn cơ bản (huyết áp, nhiệt độ) và hỗ trợ dinh dưỡng theo chế độ ăn uống đã thống nhất. LƯU Ý: Dịch vụ hỗ trợ đời sống, nhân viên Cleanova không thực hiện các thủ thuật can thiệp y tế chuyên sâu.', 
 'Hỗ trợ sinh hoạt và chăm sóc thông thường theo kế hoạch đã thống nhất.', 
 120000.00, 
 'giờ', 
 'Tối thiểu 2 giờ', 
 'care',
 2,
 90000.00,
 '🩺', 
 1);

-- ------------------------------------------------------------
-- 3. DỮ LIỆU ĐƠN ĐẶT LỊCH MẪU (bookings)
-- ------------------------------------------------------------
INSERT INTO bookings (id, booking_code, user_id, service_id, booking_date, booking_time, area_size, frequency, address, phone, notes, total_price, discount_code, payment_method, payment_status, status, staff_id, assigned_at, staff_notes) VALUES
(1, 'CNV-2026-0001', 2, 1, '2026-10-18', '08:30:00', 'medium', 'weekly', 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội', '0987654321', 'Nhà có mèo cưng, vui lòng dùng dung dịch sinh học an toàn', 191250.00, NULL, 'cash', 'unpaid', 'confirmed', 3, '2026-10-14 10:00:00', 'Đã liên hệ khách, chuẩn bị bộ lau đa năng và dung dịch hữu cơ.'),
(2, 'CNV-2026-0002', 2, 4, '2026-10-22', '14:00:00', 'small', 'once', 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội', '0987654321', 'Giặt 1 bộ sofa góc L nỉ nhung', 320000.00, 'CLEANOVA20', 'bank_transfer', 'paid', 'completed', 3, '2026-10-14 11:00:00', 'Đã giặt xong, khách nghiệm thu hài lòng 100%.'),
(3, 'CNV-2026-0003', 5, 2, '2026-10-25', '09:00:00', 'large', 'once', 'Tòa S2.05 Vinhomes Smart City, Hà Nội', '0901122334', 'Cần tổng vệ sinh trước khi đón bố mẹ lên chơi', 2000000.00, NULL, 'momo', 'paid', 'in_progress', 4, '2026-10-14 14:00:00', 'Đang xử lý tẩy cặn canxi và lau kính tầng 2.'),
(4, 'CNV-2026-0004', 2, 3, '2026-10-28', '08:00:00', 'medium', 'monthly', 'Số 25 Phố Duy Tân, Cầu Giấy, Hà Nội', '0987654321', 'Vệ sinh văn phòng định kỳ đầu tháng', 650000.00, NULL, 'cash', 'unpaid', 'pending', NULL, NULL, NULL);

-- ------------------------------------------------------------
-- 4. DỮ LIỆU ĐÁNH GIÁ (reviews)
-- ------------------------------------------------------------
INSERT INTO reviews (id, booking_id, user_id, service_id, rating, comment) VALUES
(1, 2, 2, 4, 5, 'Chuyên viên làm việc rất cẩn thận và đúng giờ. Bộ sofa màu ghi sáng nhà mình bị ố cafe mà sau khi giặt xong sạch bong như mới!');

-- ------------------------------------------------------------
-- 5. DỮ LIỆU HỒ SƠ ĐỐI TÁC ỨNG TUYỂN (partner_applications)
-- ------------------------------------------------------------
INSERT INTO partner_applications (id, name, email, phone, password, address, work_area, experience, available_hours, bio, status, reviewed_by, reviewed_at, user_id) VALUES
(1, 'Đặng Quốc Anh', 'quocanh.partner@gmail.com', '0977112233', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', 'Số 45 ngõ 165 Cầu Giấy, Hà Nội', 'Cầu Giấy, Nam Từ Liêm', '1-3 năm', 'Toàn thời gian (Full-time)', 'Đã có 2 năm làm dịch vụ dọn dẹp buồng phòng khách sạn, cẩn thận, trung thực, có xe máy đi lại.', 'pending', NULL, NULL, NULL),
(2, 'Nguyễn Thị Hồng', 'hong.partner@gmail.com', '0988776655', '$2a$10$7JYnCkFf7fq2BHHBQdQB/..B1pMhw147aKzaQG6mzoXFtGHRVXsYC', 'Số 89 Nguyễn Trãi, Thanh Xuân, Hà Nội', 'Thanh Xuân, Đống Đa', 'Trên 3 năm', 'Linh hoạt theo ca', 'Kinh nghiệm tổng vệ sinh căn hộ cao cấp và giặt ghế sofa, nhiệt tình, tỉ mỉ.', 'approved', 1, '2026-10-12 09:00:00', 3);

