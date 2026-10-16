/* ============================================================
   CLEANOVA - main.js
   Xử lý logic tương tác: Đa ngôn ngữ, Calculator, UI/UX & Phiên đăng nhập
   ============================================================ */

/* ---------------------------------------------------------------
   1. HỆ THỐNG ĐA NGÔN NGỮ (Bilingual VI/EN)
   Lưu trữ toàn bộ văn bản ở 2 ngôn ngữ
   --------------------------------------------------------------- */
const translations = {
  vi: {
    /* --- Header / Navigation --- */
    nav_home: 'Trang chủ',
    nav_services: 'Dịch vụ',
    nav_process: 'Quy trình',
    nav_pricing: 'Bảng giá',
    nav_reviews: 'Đánh giá',
    nav_faq: 'FAQ',
    nav_why: 'Vì sao chọn?',
    nav_guide: 'Hướng dẫn',
    nav_timeline: 'Quy trình',
    nav_partner: 'Trở thành đối tác',
    btn_login: 'Đăng nhập',
    btn_logout: 'Đăng xuất',
    btn_book_now: 'Đặt lịch ngay',

    /* --- Hero Section --- */
    hero_badge: '🟢 Dịch vụ Vệ sinh & Chăm sóc gia đình tại nhà',
    hero_title: 'Chăm sóc ngôi nhà, an tâm chăm sóc gia đình',
    hero_subtitle: 'Từ không gian sống sạch sẽ đến sự chăm sóc tận tâm dành cho những người thân yêu. CleanNova giúp bạn tìm dịch vụ phù hợp ngay tại nhà.',
    hero_cta_explore: 'Khám phá dịch vụ',
    hero_cta_book: 'Đặt lịch ngay',
    trust_rating_value: '4.9/5★',
    trust_rating_label: 'Đánh giá',
    trust_customers_value: '10.000+',
    trust_customers_label: 'Khách hàng tin dùng',
    trust_guarantee_value: '100%',
    trust_guarantee_label: 'Đảm bảo hài lòng',
    hero_float_1_title: 'Hoàn thành!',
    hero_float_1_text: 'Đã dọn xong 3 phòng',
    hero_float_2_title: '⭐ 5.0',
    hero_float_2_text: 'Chăm sóc chu đáo, tận tâm!',

    /* --- Services Section --- */
    services_badge: '✨ Dịch vụ của CleanNova',
    services_title: 'Dịch vụ Vệ sinh & Chăm sóc tại nhà',
    services_subtitle: 'Giải pháp toàn diện từ chăm sóc không gian sống sạch sẽ đến hỗ trợ tận tình cho trẻ nhỏ, người lớn tuổi và người bệnh.',
    tab_all_services: 'Tất cả dịch vụ',
    tab_cleaning_services: 'Dịch vụ vệ sinh',
    tab_care_services: 'Dịch vụ chăm sóc tại nhà',
    service_1_title: 'Dọn dẹp nhà cửa theo giờ',
    service_1_desc: 'Lau chùi, dọn phòng khách, phòng ngủ, nhà bếp, toilet. Linh hoạt theo nhu cầu của bạn.',
    service_1_price: 'Từ 150.000 VNĐ / giờ',
    service_2_title: 'Tổng vệ sinh Deep Cleaning',
    service_2_desc: 'Vệ sinh toàn bộ diện tích nhà, làm sạch sâu mọi ngóc ngách. Phù hợp định kỳ hàng tháng.',
    service_2_price: 'Từ 500.000 VNĐ / lần',
    service_3_title: 'Vệ sinh văn phòng & Workspace',
    service_3_desc: 'Dịch vụ định kỳ cho doanh nghiệp, đảm bảo môi trường làm việc sạch đẹp, chuyên nghiệp.',
    service_3_price: 'Từ 300.000 VNĐ / lần',
    service_4_title: 'Giặt Sofa, Nệm & Rèm cửa',
    service_4_desc: 'Hút bụi chuyên sâu, khử khuẩn bằng hơi nước nóng. Trả lại vẻ mới cho nội thất.',
    service_4_price: 'Từ 400.000 VNĐ / món',
    service_5_title: 'Vệ sinh sau xây dựng',
    service_5_desc: 'Dọn dẹp thô, xử lý vết sơn, bụi mịn sau thi công. Sẵn sàng cho ngày dọn về.',
    service_5_price: 'Từ 8.000 VNĐ / m²',
    service_6_title: 'Chăm sóc trẻ em tại nhà',
    service_6_desc: 'Chăm sóc trẻ, hỗ trợ sinh hoạt, ăn uống và vui chơi lành mạnh theo độ tuổi.',
    service_6_price: 'Từ 80.000 VNĐ / giờ',
    service_7_title: 'Chăm sóc người cao tuổi tại nhà',
    service_7_desc: 'Hỗ trợ sinh hoạt, ăn uống, nhắc thuốc và đồng hành cùng người cao tuổi.',
    service_7_price: 'Từ 90.000 VNĐ / giờ',
    service_8_title: 'Chăm sóc người bệnh tại nhà',
    service_8_desc: 'Hỗ trợ sinh hoạt và chăm sóc thể chất thông thường theo kế hoạch đã thống nhất.',
    service_8_price: 'Từ 120.000 VNĐ / giờ',
    btn_detail: 'Xem chi tiết',
    btn_book_service: 'Đặt dịch vụ',

    /* --- Why CleanNova Section (5 Tiêu chí thực tế) --- */
    why_badge: '✨ Vì sao chọn chúng tôi',
    why_title: 'Vì sao chọn CleanNova?',
    why_subtitle: 'Cam kết đem lại trải nghiệm dịch vụ tiện lợi, minh bạch và an tâm cho từng tổ ấm gia đình.',
    why_point_1_title: '1. Dễ dàng đặt dịch vụ tại nhà',
    why_point_1_desc: 'Khách hàng có thể xem dịch vụ, chọn thời gian phù hợp và gửi yêu cầu ngay trên website nhanh chóng chỉ trong vài thao tác.',
    why_point_2_title: '2. Thông tin giá minh bạch trước khi đặt',
    why_point_2_desc: 'Hiển thị các khoản phí và tổng chi phí dự kiến trước khi khách hàng xác nhận, dựa trên quy tắc tính giá thực tế, tuyệt đối không có chi phí ẩn.',
    why_point_3_title: '3. Theo dõi lịch hẹn và trạng thái dịch vụ',
    why_point_3_desc: 'Khách hàng xem trạng thái đơn hàng theo thời gian thực và thông tin nhân viên được phân công khi dữ liệu này sẵn sàng trên hệ thống.',
    why_point_4_title: '4. Hỗ trợ khách hàng trong quá trình sử dụng',
    why_point_4_desc: 'Khách hàng có thể gửi yêu cầu hỗ trợ và theo dõi trạng thái xử lý thông qua các tính năng và kênh liên hệ chính thức của website.',
    why_point_5_title: '5. Có thông tin nhân viên và phạm vi công việc rõ ràng',
    why_point_5_desc: 'Khách hàng được thông báo trước nhân viên phụ trách và phạm vi công việc cụ thể cho từng buổi làm việc.',
    btn_explore_services: 'Khám phá dịch vụ',

    /* --- Booking Workflow Section (4 Bước) --- */
    workflow_badge: '⚡ Quy trình đặt dịch vụ',
    workflow_title: '4 bước đặt lịch dịch vụ tại CleanNova',
    workflow_subtitle: 'Từ đặt lịch đến khi hoàn thành, mọi công đoạn diễn ra minh bạch, an tâm và thuận tiện.',
    workflow_step_1_title: 'Chọn dịch vụ phù hợp',
    workflow_step_1_desc: 'Duyệt danh mục dịch vụ vệ sinh hoặc chăm sóc tại nhà để chọn gói giải pháp phù hợp với nhu cầu gia đình.',
    workflow_step_2_title: 'Chọn ngày, giờ và thời lượng',
    workflow_step_2_desc: 'Linh hoạt chọn khung giờ thuận tiện và thời lượng thực hiện dịch vụ (tối thiểu 2 giờ cho dịch vụ chăm sóc).',
    workflow_step_3_title: 'Xem báo giá và xác nhận đặt lịch',
    workflow_step_3_desc: 'Hệ thống tự động tính toán chi phí minh bạch; bạn kiểm tra thông tin chi tiết và gửi đơn đặt lịch an tâm.',
    workflow_step_4_title: 'Theo dõi booking và thanh toán',
    workflow_step_4_desc: 'Nắm bắt tiến độ đơn hàng theo thời gian thực và thanh toán thuận tiện qua nhiều phương thức an toàn.',

    /* --- Pricing Section --- */
    pricing_badge: '💰 Bảng giá minh bạch',
    pricing_title: 'Bảng giá dịch vụ CleanNova',
    pricing_subtitle: 'Bảng giá niêm yết công khai, đồng bộ trực tiếp từ hệ thống, không phụ phí phát sinh ngoài thỏa thuận.',

    /* --- Commitments Section --- */
    commitments_badge: '🛡️ Cam kết & Quy định',
    commitments_title: 'Cam kết & Phạm vi dịch vụ',
    commitments_subtitle: 'Rõ ràng trong từng quy định để bảo vệ quyền lợi và sự an tâm tuyệt đối của quý khách hàng.',

    /* --- Calculator Section --- */
    calc_badge: '💰 Báo giá nhanh',
    calc_title: 'Công cụ tính giá ước tính',
    calc_subtitle: 'Chọn loại dịch vụ và nhận báo giá ngay lập tức. Nhanh chóng, minh bạch.',
    calc_form_title: 'Tùy chỉnh dịch vụ',
    calc_label_service: 'Loại dịch vụ',
    calc_option_hourly: 'Dọn dẹp theo giờ (150.000 VNĐ/h)',
    calc_option_deep: 'Tổng vệ sinh Deep Cleaning (500.000 VNĐ)',
    calc_option_sofa: 'Giặt Sofa / Nệm (400.000 VNĐ)',
    calc_option_child_care: 'Chăm sóc trẻ em tại nhà (80.000 VNĐ/h)',
    calc_option_elderly_care: 'Chăm sóc người cao tuổi (90.000 VNĐ/h)',
    calc_option_patient_care: 'Chăm sóc người bệnh tại nhà (120.000 VNĐ/h)',
    calc_label_area: 'Quy mô / Thời lượng',
    calc_option_small: 'Tiêu chuẩn: Nhỏ (< 50m² / 2 giờ)',
    calc_option_medium: 'Phổ biến: Vừa (50-100m² / 4 giờ)',
    calc_option_large: 'Lớn: Toàn diện (> 100m² / 8 giờ)',
    calc_label_frequency: 'Tần suất',
    calc_option_once: 'Một lần',
    calc_option_weekly: 'Hàng tuần (Giảm 15%)',
    calc_option_monthly: 'Hàng tháng (Giảm 10%)',
    calc_result_label: 'GIÁ ƯỚC TÍNH',
    calc_result_unit: '/lần dịch vụ',
    calc_discount_text: 'Tiết kiệm',
    calc_btn_continue: 'Tiếp tục đặt lịch →',

    /* --- Partner Section --- */
    partner_badge: 'Đồng hành phát triển',
    partner_title: 'Cùng CleanNova mang đến không gian sạch hơn',
    partner_desc: 'Tham gia đội ngũ đối tác cung cấp dịch vụ chuyên nghiệp, chủ động thời gian và phát triển thu nhập ổn định theo chính sách minh bạch của CleanNova.',

    /* --- Testimonials Section --- */
    reviews_badge: '💬 Đánh giá khách hàng',
    reviews_title: 'Khách hàng nói gì về chúng tôi',
    reviews_subtitle: 'Hàng ngàn khách hàng đã tin tưởng và hài lòng với dịch vụ của Cleanova.',
    review_1_text: '"Dịch vụ tuyệt vời! Nhân viên đến đúng giờ, làm việc rất cẩn thận. Nhà tôi sạch bóng sau 3 tiếng. Chắc chắn sẽ đặt lại!"',
    review_1_name: 'Nguyễn Thị Mai Anh',
    review_1_service: 'Tổng vệ sinh Deep Cleaning',
    review_2_text: '"Dịch vụ chăm sóc người cao tuổi rất chu đáo. Cô chăm sóc nhiệt tình, trò chuyện vui vẻ giúp bố tôi tinh thần phấn chấn hẳn."',
    review_2_name: 'Trần Văn Hùng',
    review_2_service: 'Chăm sóc người cao tuổi tại nhà',
    review_3_text: '"Gia đình bận rộn nên đặt bảo mẫu theo giờ bên CleanNova hỗ trợ đón và kèm con học bài. Rất an tâm và hài lòng!"',
    review_3_name: 'Lê Phương Thảo',
    review_3_service: 'Chăm sóc trẻ em tại nhà',

    /* --- Promo Banner --- */
    promo_title: 'Nhận ngay ưu đãi 20% cho lần đặt lịch đầu tiên!',
    promo_subtitle: 'Áp dụng cho tất cả dịch vụ. Ưu đãi có giới hạn — Đặt ngay hôm nay!',
    promo_btn: 'Đặt ngay — Nhập mã CLEANOVA20',

    /* --- FAQ Section (6 câu hỏi chuẩn theo yêu cầu) --- */
    faq_badge: '❓ Câu hỏi thường gặp',
    faq_title: 'Giải đáp thắc mắc của bạn',
    faq_subtitle: 'Tìm câu trả lời cho những câu hỏi phổ biến về dịch vụ của Cleanova.',
    faq_1_q: 'Giá dịch vụ được tính như thế nào?',
    faq_1_a: 'Giá dịch vụ tại CleanNova được tính toán tự động và thống nhất từ backend theo loại hình dịch vụ: theo giờ (dọn dẹp cơ bản, chăm sóc trẻ em, người cao tuổi, người bệnh) hoặc theo khối lượng/diện tích (giặt sofa, vệ sinh sâu, sau xây dựng). Hệ thống áp dụng chính sách ưu đãi tần suất (giảm 15% khi đặt hàng tuần, giảm 10% khi đặt hàng tháng) và mã khuyến mãi hợp lệ mà không có chi phí ẩn.',
    faq_2_q: 'Có thể đặt dịch vụ tối thiểu bao nhiêu giờ?',
    faq_2_a: 'Đối với dịch vụ dọn dẹp vệ sinh nhà cửa theo giờ, thời lượng đặt tối thiểu là 1 giờ. Đối với các dịch vụ chăm sóc tại nhà (chăm sóc trẻ em, người cao tuổi và người bệnh), thời lượng đặt tối thiểu quy định là 2 giờ mỗi ca làm việc để đảm bảo nhân sự có đủ thời gian hoàn thành chu đáo các công việc hỗ trợ sinh hoạt.',
    faq_3_q: 'Có thể đổi hoặc hủy lịch không?',
    faq_3_a: 'Có. Quý khách có thể trực tiếp đổi lịch hoặc yêu cầu hủy lịch trên hệ thống trong mục "Đơn của tôi" khi đơn hàng đang ở trạng thái Chờ xử lý hoặc Đã xác nhận trước thời điểm thực hiện dịch vụ. Đơn hàng đang trong trạng thái "Đang thực hiện" hoặc đã hoàn tất sẽ không thể hủy tự do theo quy định trạng thái booking.',
    faq_4_q: 'Làm thế nào để theo dõi lịch đặt?',
    faq_4_a: 'Sau khi đặt lịch thành công, bạn chỉ cần đăng nhập tài khoản và chọn "Đơn của tôi" trên menu điều hướng. Tại đây, bạn có thể xem chi tiết mã đơn, thời gian thực hiện, trạng thái xử lý theo thời gian thực (Chờ xử lý, Đã xác nhận, Đang thực hiện, Hoàn thành) và thông tin nhân viên phụ trách khi được hệ thống điều phối.',
    faq_5_q: 'Tiền dịch vụ được thanh toán như thế nào?',
    faq_5_a: 'CleanNova hỗ trợ nhiều hình thức thanh toán an toàn và tiện lợi: thanh toán tiền mặt trực tiếp cho nhân viên sau khi hoàn thành dịch vụ, chuyển khoản ngân hàng hoặc thanh toán trực tuyến qua các ví điện tử được tích hợp sẵn. Mọi đơn thanh toán đều có biên lai xác nhận điện tử minh bạch trong tài khoản của bạn.',
    faq_6_q: 'Nhân viên chăm sóc có thể thực hiện những công việc gì?',
    faq_6_a: 'Nhân viên chăm sóc tại nhà hỗ trợ các công việc sinh hoạt đời sống hàng ngày: hỗ trợ ăn uống, chuẩn bị thức ăn nhẹ, vệ sinh cá nhân, hỗ trợ di chuyển an toàn, nhắc uống thuốc đúng giờ theo đơn bác sĩ và trò chuyện tâm lý. CleanNova KHÔNG cung cấp các can thiệp y tế chuyên sâu (như tiêm truyền, kê đơn, điều trị chuyên khoa) vì đây là dịch vụ hỗ trợ sinh hoạt đời sống.',

    /* --- Footer --- */
    footer_slogan: 'Không gian sạch hơn, cuộc sống tốt hơn. Dịch vụ vệ sinh & chăm sóc gia đình tiện lợi, tin cậy.',
    footer_phone: '1900-8888 (8:00 - 20:00)',
    footer_email: 'contact@cleanova.vn',
    footer_address: '123 Đường Cầu Giấy, Hà Nội',
    footer_col2_title: 'Dịch vụ',
    footer_link_hourly: 'Dọn dẹp theo giờ',
    footer_link_deep: 'Tổng vệ sinh Deep Cleaning',
    footer_link_office: 'Vệ sinh văn phòng',
    footer_link_sofa: 'Giặt sofa & nệm hơi nóng',
    footer_link_construction: 'Vệ sinh sau xây dựng',
    footer_col3_title: 'Về Cleanova',
    footer_link_about: 'Giới thiệu CleanNova',
    footer_link_career: 'Tuyển dụng',
    footer_link_partner: 'Trở thành đối tác',
    footer_link_blog: 'Blog',
    footer_link_contact: 'Liên hệ',
    footer_link_login: 'Tài khoản & Đăng nhập',
    footer_newsletter_title: 'Nhận thông báo ưu đãi',
    footer_newsletter_desc: 'Đăng ký email để nhận thông tin khuyến mãi và tin tức hữu ích.',
    footer_newsletter_placeholder: 'Nhập email của bạn...',
    footer_newsletter_btn: 'Đăng ký',
    footer_copyright: '© 2026 Cleanova Inc. Bảo lưu mọi quyền.',
    footer_privacy: 'Chính sách bảo mật',
    footer_terms: 'Điều khoản dịch vụ',

    /* --- Toast Messages --- */
    toast_booking_title: 'Đặt lịch thành công!',
    toast_booking_text: 'Chúng tôi sẽ liên hệ bạn trong ít phút để xác nhận.',
    toast_newsletter_title: 'Đăng ký thành công!',
    toast_newsletter_text: 'Cảm ơn bạn đã đăng ký nhận thông báo từ Cleanova.',
    toast_promo_title: 'Mã giảm giá đã được sao chép!',
    toast_promo_text: 'Sử dụng mã CLEANOVA20 khi đặt lịch.',
    toast_logout_title: 'Đã đăng xuất thành công!',
    toast_logout_text: 'Đang chuyển bạn về trang đăng nhập...'
  },

  en: {
    /* --- Header / Navigation --- */
    nav_home: 'Home',
    nav_services: 'Services',
    nav_process: 'Process',
    nav_pricing: 'Pricing',
    nav_reviews: 'Reviews',
    nav_faq: 'FAQ',
    nav_why: 'Why Cleanova',
    nav_guide: 'How It Works',
    nav_timeline: 'Process',
    nav_partner: 'Become a Partner',
    btn_login: 'Sign In',
    btn_logout: 'Log Out',
    btn_book_now: 'Book Now',

    /* --- Hero Section --- */
    hero_badge: '🟢 Home Cleaning & Family Care Services',
    hero_title: 'Caring for your home, peace of mind for your family',
    hero_subtitle: 'From pristine living spaces to dedicated care for your loved ones. CleanNova helps you find the right service right at home.',
    hero_cta_explore: 'Explore Services',
    hero_cta_book: 'Book Now',
    trust_rating_value: '4.9/5★',
    trust_rating_label: 'Rating',
    trust_customers_value: '10,000+',
    trust_customers_label: 'Trusted Customers',
    trust_guarantee_value: '100%',
    trust_guarantee_label: 'Satisfaction Guaranteed',
    hero_float_1_title: 'Completed!',
    hero_float_1_text: '3 rooms cleaned',
    hero_float_2_title: '⭐ 5.0',
    hero_float_2_text: 'Attentive and caring!',

    /* --- Services Section --- */
    services_badge: '✨ CleanNova Services',
    services_title: 'Cleaning & In-Home Care Services',
    services_subtitle: 'Comprehensive solutions from keeping your home pristine to caring attentively for children, seniors, and patients.',
    tab_all_services: 'All Services',
    tab_cleaning_services: 'Cleaning Services',
    tab_care_services: 'In-Home Care Services',
    service_1_title: 'Hourly House Cleaning',
    service_1_desc: 'Wiping, cleaning living rooms, bedrooms, kitchens, and bathrooms. Flexible to your needs.',
    service_1_price: 'From 150,000 VND / hour',
    service_2_title: 'Deep Cleaning',
    service_2_desc: 'Complete home cleaning, deep cleaning every corner. Perfect for monthly maintenance.',
    service_2_price: 'From 500,000 VND / session',
    service_3_title: 'Office & Workspace Cleaning',
    service_3_desc: 'Regular service for businesses, ensuring a clean and professional work environment.',
    service_3_price: 'From 300,000 VND / session',
    service_4_title: 'Sofa, Mattress & Curtain Cleaning',
    service_4_desc: 'Deep vacuuming, steam sterilization. Restore your furniture to new condition.',
    service_4_price: 'From 400,000 VND / item',
    service_5_title: 'Post-Construction Cleaning',
    service_5_desc: 'Rough cleanup, paint stain removal, and fine dust treatment after construction.',
    service_5_price: 'From 8,000 VND / sq m',
    service_6_title: 'In-Home Child Care',
    service_6_desc: 'Child minding, daily routine support, meals, and age-appropriate engaging activities.',
    service_6_price: 'From 80,000 VND / hour',
    service_7_title: 'In-Home Elderly Care',
    service_7_desc: 'Daily living assistance, meal prep, medication reminders, and warm companionship.',
    service_7_price: 'From 90,000 VND / hour',
    service_8_title: 'In-Home Patient Care',
    service_8_desc: 'Assistance with daily living and standard physical support under agreed plans.',
    service_8_price: 'From 120,000 VND / hour',
    btn_detail: 'View Details',
    btn_book_service: 'Book Service',

    /* --- Why CleanNova Section --- */
    why_badge: '✨ Why Choose Us',
    why_title: 'Why Choose CleanNova?',
    why_subtitle: 'Real, transparent, and dependable benefits for every home.',
    why_point_1_title: '1. Convenient In-Home Booking',
    why_point_1_desc: 'Browse services, select convenient times, and submit requests on our website in just a few clicks.',
    why_point_2_title: '2. Transparent Pricing Upfront',
    why_point_2_desc: 'View detailed itemized fees and total estimates before confirming, based on backend pricing with zero hidden fees.',
    why_point_3_title: '3. Real-Time Booking Tracking',
    why_point_3_desc: 'Track booking progress in real-time and review assigned staff details when scheduled.',
    why_point_4_title: '4. Dedicated Customer Support',
    why_point_4_desc: 'Reach support easily and follow request resolution status directly through official website channels.',
    why_point_5_title: '5. Clear Scope of Work & Staff Info',
    why_point_5_desc: 'Clear scope of work and staff assignment notified before every working session.',
    btn_explore_services: 'Explore Services',

    /* --- Booking Workflow Section --- */
    workflow_badge: '⚡ Booking Process',
    workflow_title: '4 Steps to Book with CleanNova',
    workflow_subtitle: 'From scheduling to completion, everything is transparent, reliable, and convenient.',
    workflow_step_1_title: 'Choose the Right Service',
    workflow_step_1_desc: 'Browse cleaning or in-home care services to pick the best fit for your household.',
    workflow_step_2_title: 'Select Date, Time & Duration',
    workflow_step_2_desc: 'Choose your preferred time slot and duration (minimum 2 hours for in-home care).',
    workflow_step_3_title: 'Review Quote & Confirm',
    workflow_step_3_desc: 'The system automatically calculates transparent costs; review and confirm your booking.',
    workflow_step_4_title: 'Track Booking & Pay',
    workflow_step_4_desc: 'Follow order progress in real-time and pay securely via convenient methods.',

    /* --- Pricing Section --- */
    pricing_badge: '💰 Transparent Pricing',
    pricing_title: 'CleanNova Service Pricing',
    pricing_subtitle: 'Public rates synchronized directly from system backend without hidden fees.',

    /* --- Commitments Section --- */
    commitments_badge: '🛡️ Commitments & Terms',
    commitments_title: 'Commitments & Service Scope',
    commitments_subtitle: 'Clear terms and policies to guarantee your peace of mind.',

    /* --- Calculator Section --- */
    calc_badge: '💰 Quick Quote',
    calc_title: 'Estimated Price Calculator',
    calc_subtitle: 'Choose your service type and get an instant quote. Fast and transparent.',
    calc_form_title: 'Customize Service',
    calc_label_service: 'Service Type',
    calc_option_hourly: 'Hourly House Cleaning (150,000 VND/h)',
    calc_option_deep: 'Deep Cleaning (500,000 VND)',
    calc_option_sofa: 'Sofa / Mattress Cleaning (400,000 VND)',
    calc_option_child_care: 'In-Home Child Care (80,000 VND/h)',
    calc_option_elderly_care: 'In-Home Elderly Care (90,000 VND/h)',
    calc_option_patient_care: 'In-Home Patient Care (120,000 VND/h)',
    calc_label_area: 'Scale / Duration',
    calc_option_small: 'Standard: Small (< 50m² / 2 hours)',
    calc_option_medium: 'Popular: Medium (50-100m² / 4 hours)',
    calc_option_large: 'Large: Comprehensive (> 100m² / 8 hours)',
    calc_label_frequency: 'Frequency',
    calc_option_once: 'One-time',
    calc_option_weekly: 'Weekly (15% off)',
    calc_option_monthly: 'Monthly (10% off)',
    calc_result_label: 'ESTIMATED PRICE',
    calc_result_unit: '/per service',
    calc_discount_text: 'You save',
    calc_btn_continue: 'Continue Booking →',

    /* --- Partner Section --- */
    partner_badge: 'Grow With Us',
    partner_title: 'Create Cleaner Spaces Together with CleanNova',
    partner_desc: 'Join our professional service partner network, enjoy flexible hours, and grow dependable income under transparent policies.',

    /* --- Testimonials Section --- */
    reviews_badge: '💬 Customer Reviews',
    reviews_title: 'What Our Customers Say',
    reviews_subtitle: 'Thousands of customers have trusted and are satisfied with Cleanova services.',
    review_1_text: '"Excellent service! Staff arrived on time and worked very carefully. My house was spotless after 3 hours. Will definitely book again!"',
    review_1_name: 'Mai Anh Nguyen',
    review_1_service: 'Deep Cleaning',
    review_2_text: '"Elderly care service was wonderful. The caregiver was warm, attentive, and made my father very happy."',
    review_2_name: 'Hung Tran',
    review_2_service: 'In-Home Elderly Care',
    review_3_text: '"With our busy schedule, having an hourly child caregiver pick up our child and assist with reading is a huge relief."',
    review_3_name: 'Thao Le',
    review_3_service: 'In-Home Child Care',

    /* --- Promo Banner --- */
    promo_title: 'Get 20% off your first booking!',
    promo_subtitle: 'Valid for all services. Limited offer — Book today!',
    promo_btn: 'Book Now — Use code CLEANOVA20',

    /* --- FAQ Section --- */
    faq_badge: '❓ Frequently Asked Questions',
    faq_title: 'Got Questions? We Have Answers',
    faq_subtitle: 'Find answers to common questions about Cleanova services.',
    faq_1_q: 'How is service pricing calculated?',
    faq_1_a: 'Service rates at CleanNova are unified and calculated via backend logic based on hourly duration or scale/area. Regular schedule discounts (15% for weekly, 10% for monthly) and valid promo codes are automatically applied with zero hidden fees.',
    faq_2_q: 'What is the minimum booking duration?',
    faq_2_a: 'For hourly house cleaning, the minimum booking duration is 1 hour. For in-home care services (child care, elderly care, patient care), the minimum duration is 2 hours per shift to ensure quality care.',
    faq_3_q: 'Can I cancel or reschedule my booking?',
    faq_3_a: 'Yes. You can reschedule or request cancellation directly online under "My Bookings" while the order is in Pending or Confirmed status prior to the appointment. Ongoing or completed orders cannot be freely cancelled.',
    faq_4_q: 'How do I track my booking status?',
    faq_4_a: 'Once booked, sign in and go to "My Bookings" in the navigation bar to track live order states (Pending, Confirmed, In Progress, Completed) and view assigned staff details.',
    faq_5_q: 'What payment methods are supported?',
    faq_5_a: 'CleanNova supports convenient cash payment to staff upon completion, direct bank transfer, or online payment via supported e-wallets. Electronic receipts are stored in your account history.',
    faq_6_q: 'What tasks can in-home caregivers perform?',
    faq_6_a: 'Caregivers assist with standard daily living needs: personal hygiene, meal assistance, safe mobility support, reminding medication on schedule, and companionship. CleanNova does NOT provide invasive medical treatments or clinical care.',

    /* --- Footer --- */
    footer_slogan: 'A Cleaner Space, A Better Life. Convenient & trusted cleaning and family care services.',
    footer_phone: '1900-8888 (8:00 - 20:00)',
    footer_email: 'contact@cleanova.vn',
    footer_address: '123 Cau Giay Street, Hanoi',
    footer_col2_title: 'Services',
    footer_link_hourly: 'Hourly Cleaning',
    footer_link_deep: 'Deep Cleaning',
    footer_link_office: 'Office Cleaning',
    footer_link_sofa: 'Sofa & Mattress',
    footer_link_construction: 'Post-Construction',
    footer_col3_title: 'About Cleanova',
    footer_link_about: 'About CleanNova',
    footer_link_career: 'Careers',
    footer_link_partner: 'Become a Partner',
    footer_link_blog: 'Blog',
    footer_link_contact: 'Contact',
    footer_link_login: 'Account & Sign In',
    footer_newsletter_title: 'Get Deals & Updates',
    footer_newsletter_desc: 'Subscribe for promotions and useful news.',
    footer_newsletter_placeholder: 'Enter your email...',
    footer_newsletter_btn: 'Subscribe',
    footer_copyright: '© 2026 Cleanova Inc. All rights reserved.',
    footer_privacy: 'Privacy Policy',
    footer_terms: 'Terms of Service',

    /* --- Toast Messages --- */
    toast_booking_title: 'Booking Received!',
    toast_booking_text: 'We will contact you shortly to confirm.',
    toast_newsletter_title: 'Subscribed Successfully!',
    toast_newsletter_text: 'Thank you for subscribing to Cleanova updates.',
    toast_promo_title: 'Promo Code Copied!',
    toast_promo_text: 'Use code CLEANOVA20 when booking.',
    toast_logout_title: 'Logged Out Successfully!',
    toast_logout_text: 'Redirecting to login page...'
  }
};

/* ---------------------------------------------------------------
   2. BIẾN TRẠNG THÁI TOÀN CỤC
   --------------------------------------------------------------- */
let currentLang = localStorage.getItem('cleanova_lang') || 'vi';

/* ---------------------------------------------------------------
   3. HÀM CHUYỂN ĐỔI NGÔN NGỮ
   Cập nhật toàn bộ văn bản trên trang mà không load lại
   --------------------------------------------------------------- */
function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('cleanova_lang', lang);
  document.documentElement.lang = lang;

  const t = translations[lang] || translations.vi;

  // Cập nhật tất cả phần tử có thuộc tính data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // Cập nhật placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });

  // Cập nhật aria-label
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (t[key]) {
      el.setAttribute('aria-label', t[key]);
    }
  });

  // Cập nhật các option trong select
  document.querySelectorAll('[data-i18n-option]').forEach(el => {
    const key = el.getAttribute('data-i18n-option');
    if (t[key]) {
      el.textContent = t[key];
    }
  });

  // Cập nhật nút toggle ngôn ngữ (active state)
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  // Cập nhật calculator khi đổi ngôn ngữ
  calculatePrice();
}

/* ---------------------------------------------------------------
   4. CHỨC NĂNG TÍNH GIÁ TỰ ĐỘNG (Calculator Logic)
   Bảng giá cơ sở (VNĐ) và tỷ giá quy đổi
   --------------------------------------------------------------- */
const priceTable = {
  /* Giá cơ sở VNĐ theo loại dịch vụ & diện tích / thời lượng */
  hourly: {
    small: 300000,   // 2 giờ (150.000 VNĐ/h)
    medium: 600000,  // 4 giờ
    large: 1200000   // 8 giờ
  },
  deep: {
    small: 800000,   // < 50m²
    medium: 1500000, // 50-100m²
    large: 2500000   // > 100m²
  },
  sofa: {
    small: 400000,   // 1 món
    medium: 700000,  // 2-3 món
    large: 1200000   // 4+ món
  },
  child_care: {
    small: 160000,   // 80.000 VNĐ/h * 2 giờ (tối thiểu 2h)
    medium: 320000,  // 80.000 VNĐ/h * 4 giờ
    large: 640000    // 80.000 VNĐ/h * 8 giờ
  },
  elderly_care: {
    small: 180000,   // 90.000 VNĐ/h * 2 giờ (tối thiểu 2h)
    medium: 360000,  // 90.000 VNĐ/h * 4 giờ
    large: 720000    // 90.000 VNĐ/h * 8 giờ
  },
  patient_care: {
    small: 240000,   // 120.000 VNĐ/h * 2 giờ (tối thiểu 2h)
    medium: 480000,  // 120.000 VNĐ/h * 4 giờ
    large: 960000    // 120.000 VNĐ/h * 8 giờ
  }
};

// Map mã dịch vụ trong calculator sang ID dịch vụ của hệ thống
const calcServiceIdMap = {
  hourly: 1,
  deep: 2,
  sofa: 4,
  child_care: 6,
  elderly_care: 7,
  patient_care: 8
};

// Hệ số giảm giá theo tần suất
const frequencyDiscount = {
  once: 0,      // Không giảm
  weekly: 0.15, // Giảm 15%
  monthly: 0.10 // Giảm 10%
};

// Tỷ giá VNĐ sang USD (ước tính)
const VND_TO_USD = 24500;

function calculatePrice() {
  const serviceSelect = document.getElementById('calc-service');
  const areaSelect = document.getElementById('calc-area');
  const frequencySelect = document.getElementById('calc-frequency');

  if (!serviceSelect || !areaSelect || !frequencySelect) return;

  const service = serviceSelect.value;
  const area = areaSelect.value;
  const frequency = frequencySelect.value;

  // Lấy giá cơ sở từ bảng giá
  const basePrice = priceTable[service]?.[area] || 300000;

  // Tính giảm giá
  const discount = frequencyDiscount[frequency] || 0;
  const discountAmount = basePrice * discount;
  const finalPrice = basePrice - discountAmount;

  // Cập nhật hiển thị giá
  const priceEl = document.getElementById('calc-price');
  const discountEl = document.getElementById('calc-discount-display');
  const discountRow = document.getElementById('calc-discount-row');

  if (priceEl) {
    if (currentLang === 'vi') {
      priceEl.textContent = formatVND(finalPrice);
    } else {
      priceEl.textContent = formatUSD(finalPrice / VND_TO_USD);
    }
  }

  // Cập nhật link đặt lịch chuyển tiếp đúng service_id
  const continueBtn = document.querySelector('.calculator-result a[data-action="book"]');
  if (continueBtn) {
    const targetId = calcServiceIdMap[service] || 1;
    continueBtn.setAttribute('href', `booking.html?service_id=${targetId}`);
  }

  // Hiển thị/ẩn thông tin giảm giá
  if (discountRow) {
    if (discount > 0) {
      discountRow.style.display = 'inline-flex';
      const savedAmount = currentLang === 'vi'
        ? formatVND(discountAmount)
        : formatUSD(discountAmount / VND_TO_USD);
      if (discountEl) {
        discountEl.textContent = `${translations[currentLang].calc_discount_text} ${savedAmount}`;
      }
    } else {
      discountRow.style.display = 'none';
    }
  }
}

// Định dạng tiền VNĐ: 1.500.000 VNĐ
function formatVND(amount) {
  return Math.round(amount).toLocaleString('vi-VN') + ' VNĐ';
}

// Định dạng tiền USD: $61.22
function formatUSD(amount) {
  return '$' + amount.toFixed(2);
}

/* ---------------------------------------------------------------
   5. XỬ LÝ PHIÊN ĐĂNG NHẬP & ĐĂNG XUẤT (Auth & Session Flow)
   Hiển thị thông tin người dùng và xử lý nút đăng xuất
   --------------------------------------------------------------- */
function initAuthStatus() {
  const api = window.CleanovaAPI;
  const user = (api && api.auth) ? api.auth.getUser() : null;
  const isLoggedIn = (api && api.auth)
    ? api.auth.isLoggedIn()
    : Boolean(localStorage.getItem('cleanova_token'));

  const displayName = user ? (user.name || user.email) : 'Khách hàng';
  const isAdmin = (api && api.auth) ? api.auth.isAdmin() : (user && user.role === 'admin');
  const isStaff = (api && api.auth) ? (user && user.role === 'staff') : (user && user.role === 'staff');

  const userProfileHeader = document.getElementById('user-profile-header');
  const userEmailHeader = document.getElementById('user-email-header');
  const btnLogoutHeader = document.getElementById('btn-logout');
  const btnLoginHeader = document.getElementById('btn-login-header');
  const btnRegisterHeader = document.getElementById('btn-register-header');
  const notificationWrapper = document.getElementById('notification-wrapper');
  const navLinkMyBookings = document.getElementById('nav-link-my-bookings');
  const navLinkAdmin = document.getElementById('nav-link-admin');
  const mobileLinkAdmin = document.getElementById('mobile-link-admin');
  const navLinkStaff = document.getElementById('nav-link-staff');
  const mobileLinkStaff = document.getElementById('mobile-link-staff');

  const userProfileMobile = document.getElementById('user-profile-mobile');
  const userEmailMobile = document.getElementById('user-email-mobile');
  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  const btnLoginMobile = document.getElementById('btn-login-mobile');
  const btnRegisterMobile = document.getElementById('btn-register-mobile');
  const mobileLinkMyBookings = document.getElementById('mobile-link-my-bookings');
  const mobileLinkProfile = document.getElementById('mobile-link-profile');

  if (isLoggedIn) {
    // 1. ĐÃ ĐĂNG NHẬP: Hiển thị thông tin tài khoản, đơn hàng, chuông thông báo & nút đăng xuất
    if (userEmailHeader) userEmailHeader.textContent = displayName;
    if (userProfileHeader) userProfileHeader.style.display = 'inline-flex';
    if (btnLogoutHeader) btnLogoutHeader.style.display = 'inline-flex';
    if (btnLoginHeader) btnLoginHeader.style.display = 'none';
    if (btnRegisterHeader) btnRegisterHeader.style.display = 'none';
    if (notificationWrapper) notificationWrapper.style.display = 'inline-block';
    if (navLinkMyBookings) navLinkMyBookings.style.display = 'inline-block';

    // Mobile Drawer
    if (userEmailMobile) userEmailMobile.textContent = displayName;
    if (userProfileMobile) userProfileMobile.style.display = 'flex';
    if (btnLogoutMobile) btnLogoutMobile.style.display = 'block';
    if (btnLoginMobile) btnLoginMobile.style.display = 'none';
    if (btnRegisterMobile) btnRegisterMobile.style.display = 'none';
    if (mobileLinkMyBookings) mobileLinkMyBookings.style.display = 'block';
    if (mobileLinkProfile) mobileLinkProfile.style.display = 'block';

    // Phân quyền: Hiển thị tab Quản trị viên nếu là admin
    if (isAdmin) {
      if (navLinkAdmin) navLinkAdmin.style.display = 'inline-block';
      if (mobileLinkAdmin) mobileLinkAdmin.style.display = 'block';
    }

    // Phân quyền: Hiển thị tab Nhân viên nếu là staff
    if (isStaff) {
      if (navLinkStaff) navLinkStaff.style.display = 'inline-block';
      if (mobileLinkStaff) mobileLinkStaff.style.display = 'block';
    }
  } else {
    // 2. KHÁCH VÃNG LAI: Ẩn thông tin cá nhân, đơn hàng, chuông thông báo; Hiện nút Đăng nhập & Đăng ký
    if (userProfileHeader) userProfileHeader.style.display = 'none';
    if (btnLogoutHeader) btnLogoutHeader.style.display = 'none';
    if (btnLoginHeader) btnLoginHeader.style.display = 'inline-flex';
    if (btnRegisterHeader) btnRegisterHeader.style.display = 'inline-flex';
    if (notificationWrapper) notificationWrapper.style.display = 'none';
    if (navLinkMyBookings) navLinkMyBookings.style.display = 'none';

    // Mobile Drawer
    if (userProfileMobile) userProfileMobile.style.display = 'none';
    if (btnLogoutMobile) btnLogoutMobile.style.display = 'none';
    if (btnLoginMobile) btnLoginMobile.style.display = 'block';
    if (btnRegisterMobile) btnRegisterMobile.style.display = 'block';
    if (mobileLinkMyBookings) mobileLinkMyBookings.style.display = 'none';
    if (mobileLinkProfile) mobileLinkProfile.style.display = 'none';

    if (navLinkAdmin) navLinkAdmin.style.display = 'none';
    if (mobileLinkAdmin) mobileLinkAdmin.style.display = 'none';
    if (navLinkStaff) navLinkStaff.style.display = 'none';
    if (mobileLinkStaff) mobileLinkStaff.style.display = 'none';
  }

  // Xử lý sự kiện Đăng xuất: Xóa phiên và chuyển về trang chủ công khai (trangchu.html)
  function handleLogout(e) {
    e.preventDefault();
    if (api && api.auth) {
      api.auth.logout();
    } else {
      localStorage.removeItem('cleanova_token');
      localStorage.removeItem('cleanova_user');
      sessionStorage.clear();
      window.location.href = 'trangchu.html';
    }
  }

  if (btnLogoutHeader) {
    btnLogoutHeader.addEventListener('click', handleLogout);
  }
  if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', handleLogout);
  }
}

/* ---------------------------------------------------------------
   6. STICKY HEADER - Thu nhỏ khi cuộn trang
   --------------------------------------------------------------- */
function initStickyHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* ---------------------------------------------------------------
   7. MOBILE MENU TOGGLE
   Mở/đóng menu hamburger cho mobile
   --------------------------------------------------------------- */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  const overlay = document.getElementById('mobile-overlay');

  if (!toggle || !mobileNav || !overlay) return;

  function openMenu() {
    toggle.classList.add('active');
    mobileNav.classList.add('active');
    overlay.classList.add('active');
    document.body.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    toggle.classList.remove('active');
    mobileNav.classList.remove('active');
    overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    if (mobileNav.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener('click', closeMenu);

  mobileNav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}

/* ---------------------------------------------------------------
   8. FAQ ACCORDION
   Mở/đóng câu hỏi thường gặp
   --------------------------------------------------------------- */
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const btn = other.querySelector('.faq-question');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('active', !isActive);
      question.setAttribute('aria-expanded', String(!isActive));
    });
  });
}

/* ---------------------------------------------------------------
   8.1. NOTIFICATION DROPDOWN TOGGLE
   Xử lý mở/đóng và đánh dấu đã đọc thông báo
   --------------------------------------------------------------- */
function initNotifications() {
  const btn = document.getElementById('btn-notifications');
  const dropdown = document.getElementById('notification-dropdown');
  const badge = document.getElementById('notification-badge');
  const btnMarkRead = document.getElementById('btn-mark-read');

  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = dropdown.style.display !== 'none';
    dropdown.style.display = isShown ? 'none' : 'block';
  });

  if (btnMarkRead) {
    btnMarkRead.addEventListener('click', (e) => {
      e.stopPropagation();
      if (badge) badge.style.display = 'none';
      btnMarkRead.textContent = '✓ Đã đọc tất cả';
      btnMarkRead.style.color = 'var(--color-text-muted)';
      btnMarkRead.style.cursor = 'default';
      showToast('success', 'Thông báo Cleanova', 'Tất cả thông báo đã được đánh dấu là đã đọc.');
    });
  }

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

/* ---------------------------------------------------------------
   9. TOAST NOTIFICATION
   Hiển thị thông báo nổi thân thiện
   --------------------------------------------------------------- */
function showToast(type, titleKey, textKey) {
  const t = translations[currentLang] || translations.vi;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✅' : 'ℹ️';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-content">
      <strong>${t[titleKey] || titleKey}</strong>
      <p>${t[textKey] || textKey}</p>
    </div>
    <button class="toast-close" aria-label="Đóng thông báo">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  setTimeout(() => {
    removeToast(toast);
  }, 4000);
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('removing')) return;
  toast.classList.add('removing');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/* ---------------------------------------------------------------
   10. SCROLL REVEAL ANIMATION
   Hiệu ứng xuất hiện các section khi cuộn vào viewport
   --------------------------------------------------------------- */
/* ---------------------------------------------------------------
   10. SCROLL REVEAL ANIMATION (IntersectionObserver)
   Hiệu ứng cuộn trang hiện đại, mượt mà và an toàn cho trải nghiệm
   --------------------------------------------------------------- */
function initScrollReveal() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Selector hỗ trợ tất cả các dạng reveal class và data attribute
  const selector = '.reveal, .reveal-up, .reveal-left, .reveal-right, .reveal-fade, .reveal-scale, .timeline-phase-item, [data-reveal], [data-animate]';
  const revealElements = document.querySelectorAll(selector);

  // Nếu không có phần tử nào cần reveal, thoát an toàn
  if (!revealElements.length) return;

  // 2. Nếu người dùng bật giảm chuyển động, hiển thị ngay lập tức
  if (prefersReducedMotion) {
    revealElements.forEach(el => {
      el.classList.add('visible', 'is-visible');
    });
    return;
  }

  // 3. Đánh dấu HTML đã sẵn sàng hiệu ứng (Progressive Enhancement)
  document.documentElement.classList.add('js-reveal-ready');

  // 4. Khởi tạo IntersectionObserver hỗ trợ cuộn 2 chiều (Re-triggering on scroll up & down)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const target = entry.target;
      if (entry.isIntersecting) {
        // Phần tử đi vào vùng nhìn: Kích hoạt animation xuất hiện
        target.classList.add('visible', 'is-visible');

        // Hỗ trợ data-reveal-delay hoặc data-delay tùy biến
        const customDelay = target.getAttribute('data-reveal-delay') || target.getAttribute('data-delay');
        if (customDelay) {
          target.style.transitionDelay = `${customDelay}ms`;
        }
      } else {
        // Khi phần tử hoàn toàn rời khỏi vùng nhìn:
        // Đưa về trạng thái chờ để khi khách cuộn lại sẽ tiếp tục xuất hiện mượt mà
        // Loại trừ các phần tử trong hero hoặc có class .reveal-once
        if (!target.closest('.hero') && !target.classList.contains('reveal-once')) {
          target.classList.remove('visible', 'is-visible');
          // Xóa inline transitionDelay nếu có để reset tức thời
          if (target.hasAttribute('data-reveal-delay') || target.hasAttribute('data-delay')) {
            target.style.transitionDelay = '';
          }
        }
      }
    });
  }, {
    threshold: 0.10,
    rootMargin: '0px 0px -30px 0px'
  });

  revealElements.forEach(el => observer.observe(el));

  // 5. Kích hoạt hiệu ứng mượt cho các phần tử Hero section ngay khi tải trang
  const heroElements = [
    { sel: '.hero .hero-badge-container', animClass: 'hero-animate-badge' },
    { sel: '.hero .hero-badge', animClass: 'hero-animate-badge' },
    { sel: '.hero .hero-title', animClass: 'hero-animate-title' },
    { sel: '.hero .hero-subtitle', animClass: 'hero-animate-subtitle' },
    { sel: '.hero .hero-cta', animClass: 'hero-animate-cta' },
    { sel: '.hero .trust-badges', animClass: 'hero-animate-trust' },
    { sel: '.hero .hero-illustration', animClass: 'hero-animate-visual' },
    { sel: '.hero .hero-float-card.card-1', animClass: 'hero-animate-card-1' },
    { sel: '.hero .hero-float-card.card-2', animClass: 'hero-animate-card-2' }
  ];

  heroElements.forEach(item => {
    const el = document.querySelector(item.sel);
    if (el) el.classList.add(item.animClass);
  });

  // 6. Cơ chế an toàn (Safety fallback): Sau 5 giây nếu phần tử đang trong viewport mà chưa hiện thì kích hoạt
  setTimeout(() => {
    revealElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const inViewport = (rect.top < window.innerHeight && rect.bottom > 0);
      if (inViewport && !el.classList.contains('visible') && !el.classList.contains('is-visible')) {
        el.classList.add('visible', 'is-visible');
      }
    });
  }, 5000);
}

/* ---------------------------------------------------------------
   11. SMOOTH SCROLL cho Navigation Links
   --------------------------------------------------------------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/* ---------------------------------------------------------------
   12. EVENT LISTENERS cho các nút CTA
   Hiển thị toast khi bấm nút đặt lịch hoặc đăng ký
   --------------------------------------------------------------- */
function initCTAButtons() {
  document.querySelectorAll('[data-action="book"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const href = btn.getAttribute('href') || 'booking.html';
      const api = window.CleanovaAPI;
      if (api && api.auth && !api.auth.isLoggedIn()) {
        e.preventDefault();
        api.auth.requireAuth(href, 'Vui lòng đăng nhập để tiếp tục sử dụng dịch vụ CleanNova');
        return;
      }
      if (href && (href.startsWith('booking.html') || href.startsWith('services.html'))) {
        return; // Cho phép trình duyệt điều hướng bình thường khi đã đăng nhập
      }
      e.preventDefault();
      window.location.href = href;
    });
  });

  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value.trim()) {
        showToast('success', 'toast_newsletter_title', 'toast_newsletter_text');
        emailInput.value = '';
      }
    });
  }

  document.querySelectorAll('[data-action="promo"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (navigator.clipboard) {
        navigator.clipboard.writeText('CLEANOVA20').then(() => {
          showToast('info', 'toast_promo_title', 'toast_promo_text');
        }).catch(() => {
          showToast('info', 'toast_promo_title', 'toast_promo_text');
        });
      } else {
        showToast('info', 'toast_promo_title', 'toast_promo_text');
      }
    });
  });
}

/* ---------------------------------------------------------------
   13. CALCULATOR EVENT LISTENERS
   Lắng nghe thay đổi từ các select trong widget tính giá
   --------------------------------------------------------------- */
function initCalculator() {
  const calcSelects = document.querySelectorAll('#calc-service, #calc-area, #calc-frequency');
  calcSelects.forEach(select => {
    select.addEventListener('change', calculatePrice);
  });

  calculatePrice();
}

/* ---------------------------------------------------------------
   14. LANGUAGE TOGGLE EVENT
   Xử lý bấm nút chuyển đổi ngôn ngữ
   --------------------------------------------------------------- */
function initLanguageToggle() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      if (lang && lang !== currentLang) {
        switchLanguage(lang);
      }
    });
  });
}

/* ---------------------------------------------------------------
   15. DỮ LIỆU CHI TIẾT DỊCH VỤ CHO MODAL (Service Details Dialog)
   --------------------------------------------------------------- */
const serviceDetailsData = {
  1: {
    title: 'Dọn dẹp nhà cửa theo giờ',
    category: 'Vệ sinh',
    categoryClass: 'badge-category-cleaning',
    desc: 'Dịch vụ dọn dẹp vệ sinh nhà ở linh hoạt theo nhu cầu thực tế của quý khách hàng. Nhân viên mang đầy đủ dụng cụ cơ bản giúp lau chùi, quét dọn và sắp xếp phòng khách, phòng ngủ, nhà bếp và khu vực vệ sinh sáng bóng.',
    price: 'Từ 150.000 VNĐ / giờ',
    minDuration: '1 giờ',
    duration: '2 - 4 giờ',
    features: [
      'Quét bụi, hút bụi và lau sạch sàn nhà, bề mặt đồ nội thất',
      'Cọ rửa bồn cầu, bồn rửa mặt, gương kính và vách kính phòng tắm',
      'Lau mặt bếp, bồn rửa bát và lau sạch bên ngoài các thiết bị gia dụng',
      'Thay ga gối, thu gom và phân loại rác thải sinh hoạt gọn gàng'
    ]
  },
  2: {
    title: 'Tổng vệ sinh Deep Cleaning',
    category: 'Vệ sinh',
    categoryClass: 'badge-category-cleaning',
    desc: 'Giải pháp làm sạch toàn diện và chuyên sâu từng ngóc ngách không gian sống. Phù hợp cho nhà ở định kỳ hàng tháng, dọn nhà đón Tết hoặc trước khi có sự kiện gia đình.',
    price: 'Từ 500.000 VNĐ / lần',
    minDuration: '4 giờ',
    duration: '4 - 6 giờ (tùy diện tích)',
    features: [
      'Lau chùi toàn bộ trần, tường, đèn chùm và các vị trí khó tiếp cận',
      'Đánh bóng sàn gạch/gỗ bằng máy chuyên dụng và hóa chất sinh học',
      'Tẩy cặn canxi vách kính tắm và xử lý vết ố men sứ lâu ngày',
      'Vệ sinh sâu khu vực bếp, tẩy dầu mỡ bám dính trên máy hút mùi'
    ]
  },
  3: {
    title: 'Vệ sinh văn phòng & Workspace',
    category: 'Vệ sinh',
    categoryClass: 'badge-category-cleaning',
    desc: 'Dịch vụ dọn dẹp không gian làm việc chuyên nghiệp cho công ty, văn phòng, phòng họp và showroom kinh doanh. Đem đến môi trường làm việc thông thoáng, nâng cao hiệu suất làm việc.',
    price: 'Từ 300.000 VNĐ / lần',
    minDuration: '2 giờ',
    duration: '2 - 3 giờ',
    features: [
      'Lau dọn bàn ghế làm việc, màn hình máy tính và thiết bị văn phòng',
      'Hút bụi thảm trải sàn và vệ sinh khử khuẩn khu vực pantry',
      'Dọn dẹp toilet văn phòng và bổ sung vật tư tiêu hao',
      'Thu gom tài liệu thải loại đúng nơi quy định và đổ rác định kỳ'
    ]
  },
  4: {
    title: 'Giặt Sofa, Nệm & Rèm cửa',
    category: 'Vệ sinh',
    categoryClass: 'badge-category-cleaning',
    desc: 'Ứng dụng công nghệ hút bụi sâu và phun hút hơi nước nóng 140°C giúp tiêu diệt 99% vi khuẩn, mạt bụi và nấm mốc ẩn sâu trong sợi vải, mang lại sự êm ái thơm mát cho nội thất.',
    price: 'Từ 400.000 VNĐ / món',
    minDuration: '1 giờ',
    duration: '1 - 2 giờ',
    features: [
      'Hút sạch bụi mịn sâu trong đệm mút bằng máy hút công nghiệp',
      'Xử lý vết bẩn cục bộ (cà phê, trà, dầu mỡ) bằng dung dịch chuyên biệt',
      'Phun hơi nước nóng 140°C khử trùng và tiêu diệt mạt bụi gây dị ứng',
      'Sấy khô nhanh chóng, đảm bảo có thể sử dụng lại sau 2 - 3 giờ'
    ]
  },
  5: {
    title: 'Vệ sinh sau xây dựng',
    category: 'Vệ sinh',
    categoryClass: 'badge-category-cleaning',
    desc: 'Dịch vụ tổng vệ sinh thô và tinh sau quá trình thi công xây dựng hoặc cải tạo nhà ở. Làm sạch triệt để xi măng thừa, vết sơn rơi vãi và bụi mịn công trình.',
    price: 'Từ 8.000 VNĐ / m²',
    minDuration: '1 ngày',
    duration: '1 - 2 ngày',
    features: [
      'Thu gom xà bần, phế thải xây dựng thô còn tồn đọng',
      'Dùng hóa chất chuyên dụng tẩy vết sơn, xi măng bám trên kính và sàn',
      'Hút bụi mịn công nghiệp trong toàn bộ các phòng và khe kẽ',
      'Nghiệm thu theo từng hạng mục cam kết sẵn sàng bàn giao vào ở'
    ]
  },
  6: {
    title: 'Chăm sóc trẻ em tại nhà',
    category: 'Chăm sóc tại nhà',
    categoryClass: 'badge-category-care',
    desc: 'Dịch vụ bảo mẫu đồng hành hỗ trợ gia đình bận rộn chăm sóc trẻ nhỏ tại nhà. Nhân viên tận tâm, kiên nhẫn, hỗ trợ sinh hoạt, ăn uống và cùng bé tham gia các hoạt động vui chơi bổ ích.',
    price: 'Từ 80.000 VNĐ / giờ',
    minDuration: '2 giờ',
    duration: '2 - 8 giờ / ca',
    features: [
      'Đón bé và hỗ trợ vệ sinh cá nhân, thay quần áo sạch sẽ',
      'Chuẩn bị bữa ăn nhẹ dinh dưỡng hoặc hỗ trợ bé ăn đúng bữa',
      'Cùng bé đọc truyện, xếp hình, vẽ tranh và các trò chơi phát triển kỹ năng',
      'Theo dõi đảm bảo an toàn tuyệt đối cho bé trong không gian ngôi nhà'
    ]
  },
  7: {
    title: 'Chăm sóc người cao tuổi tại nhà',
    category: 'Chăm sóc tại nhà',
    categoryClass: 'badge-category-care',
    desc: 'Dịch vụ chăm sóc và bầu bạn cùng người lớn tuổi, giúp người cao tuổi có cuộc sống thoải mái, ấm áp ngay trong tổ ấm của mình. Nhân viên hòa nhã, chu đáo và biết lắng nghe.',
    price: 'Từ 90.000 VNĐ / giờ',
    minDuration: '2 giờ',
    duration: '2 - 8 giờ / ca',
    features: [
      'Hỗ trợ sinh hoạt thường nhật, vệ sinh cá nhân và vận động nhẹ an toàn',
      'Chuẩn bị bữa ăn ấm nóng dinh dưỡng phù hợp khẩu vị người già',
      'Nhắc nhở uống thuốc đúng giờ theo đúng đơn chỉ định của bác sĩ',
      'Trò chuyện tâm tình, đi dạo và theo dõi sức khỏe tổng quát'
    ]
  },
  8: {
    title: 'Chăm sóc người bệnh tại nhà',
    category: 'Chăm sóc tại nhà',
    categoryClass: 'badge-category-care',
    desc: 'Dịch vụ hỗ trợ sinh hoạt và chăm sóc thể chất thông thường cho người đang hồi phục sức khỏe sau ốm hoặc điều trị tại nhà theo kế hoạch đã thống nhất giữa hai bên.',
    price: 'Từ 120.000 VNĐ / giờ',
    minDuration: '2 giờ',
    duration: '2 - 8 giờ / ca',
    features: [
      'Hỗ trợ vệ sinh thân thể, tắm rửa nhẹ nhàng và thay ga gối sạch sẽ',
      'Hỗ trợ chế biến và cho ăn thức ăn mềm, dinh dưỡng theo hướng dẫn',
      'Đo và ghi chép chỉ số cơ bản (nhiệt độ, huyết áp) theo dõi định kỳ',
      'LƯU Ý: Đây là dịch vụ hỗ trợ sinh hoạt đời sống, không phải điều trị y tế chuyên sâu'
    ]
  }
};

/* ---------------------------------------------------------------
   16. ĐỒNG BỘ DỊCH VỤ & BẢNG GIÁ TỪ BACKEND API
   --------------------------------------------------------------- */
async function initServicesAndPricing() {
  const pricingCardsContainer = document.getElementById('pricing-cards-container');
  const pricingErrorState = document.getElementById('pricing-error-state');
  const btnRetry = document.getElementById('btn-retry-pricing');

  if (btnRetry) {
    btnRetry.onclick = () => initServicesAndPricing();
  }

  try {
    let services = [];
    if (window.CleanovaAPI && window.CleanovaAPI.services && typeof window.CleanovaAPI.services.getAll === 'function') {
      const res = await window.CleanovaAPI.services.getAll();
      services = res.data || res || [];
    } else {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error('Failed to fetch services: ' + res.status);
      const data = await res.json();
      services = data.data || data || [];
    }

    if (!Array.isArray(services) || services.length === 0) {
      throw new Error('No services received from API');
    }

    // Cập nhật giá động và trạng thái trên các thẻ dịch vụ
    services.forEach(service => {
      // 1. Thẻ dịch vụ ở Section 2
      const serviceCard = document.querySelector(`.service-card[data-service-id="${service.id}"]`);
      if (serviceCard) {
        const priceEl = serviceCard.querySelector('.service-price');
        const bookBtn = serviceCard.querySelector('.btn-service-book');

        if (service.is_active === 0 || service.is_active === false) {
          serviceCard.style.opacity = '0.65';
          if (bookBtn) {
            bookBtn.classList.add('disabled');
            bookBtn.removeAttribute('href');
            bookBtn.textContent = 'Tạm ngưng';
            bookBtn.setAttribute('disabled', 'true');
            bookBtn.onclick = (e) => e.preventDefault();
          }
        } else {
          serviceCard.style.opacity = '1';
          if (priceEl && service.base_price) {
            priceEl.textContent = `Từ ${formatVND(service.base_price)} / ${service.price_unit || service.pricing_unit || 'giờ'}`;
          }
          if (bookBtn) {
            const isCare = service.category === 'care' || Number(service.id) >= 6;
            bookBtn.setAttribute('href', isCare ? `booking-care.html?service=${service.id}` : `booking.html?service_id=${service.id}`);
          }
        }
      }

      // 2. Thẻ bảng giá ở Section 5
      const pricingCard = document.querySelector(`.pricing-plan-card[data-service-id="${service.id}"]`);
      if (pricingCard) {
        const amountEl = pricingCard.querySelector('.pricing-plan-amount');
        const unitEl = pricingCard.querySelector('.pricing-plan-unit');
        const bookLink = pricingCard.querySelector('a.btn-primary');

        if (service.is_active === 0 || service.is_active === false) {
          pricingCard.style.opacity = '0.65';
          if (bookLink) {
            bookLink.classList.add('disabled');
            bookLink.removeAttribute('href');
            bookLink.textContent = 'Tạm ngưng nhận đơn';
            bookLink.setAttribute('disabled', 'true');
            bookLink.onclick = (e) => e.preventDefault();
          }
        } else {
          pricingCard.style.opacity = '1';
          if (amountEl && service.base_price) {
            amountEl.textContent = Number(service.base_price).toLocaleString('vi-VN');
          }
          if (unitEl && (service.price_unit || service.pricing_unit)) {
            unitEl.textContent = `VNĐ / ${service.price_unit || service.pricing_unit}`;
          }
          if (bookLink) {
            const isCare = service.category === 'care' || Number(service.id) >= 6;
            bookLink.setAttribute('href', isCare ? `booking-care.html?service=${service.id}` : `booking.html?service_id=${service.id}`);
          }
        }
      }

      // Đồng bộ vào serviceDetailsData
      if (serviceDetailsData[service.id]) {
        if (service.base_price) {
          serviceDetailsData[service.id].price = `Từ ${formatVND(service.base_price)} / ${service.pricing_unit || 'giờ'}`;
        }
        if (service.description) {
          serviceDetailsData[service.id].desc = service.description;
        }
      }
    });

    if (pricingCardsContainer) pricingCardsContainer.style.display = 'grid';
    if (pricingErrorState) pricingErrorState.style.display = 'none';

  } catch (err) {
    console.error('Lỗi tải danh sách dịch vụ:', err);
    if (pricingCardsContainer) pricingCardsContainer.style.display = 'none';
    if (pricingErrorState) pricingErrorState.style.display = 'block';
  }

  // Khởi tạo tab bộ lọc danh mục Section 2
  initServicesCategoryTabs();

  // Khởi tạo tab bộ lọc bảng giá Section 5
  initPricingCategoryTabs();

  // Khởi tạo Modal chi tiết dịch vụ
  initServiceModal();
}

/* ---------------------------------------------------------------
   17. BỘ LỌC TABS CHO DỊCH VỤ & BẢNG GIÁ
   --------------------------------------------------------------- */
function initServicesCategoryTabs() {
  const tabs = document.querySelectorAll('#services-category-tabs .category-tab-btn');
  const cards = document.querySelectorAll('#services-grid-container .service-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const filter = tab.dataset.filter || 'all';

      cards.forEach(card => {
        const cat = card.dataset.category;
        if (filter === 'all' || cat === filter) {
          card.style.display = 'flex';
          card.classList.add('visible');
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function initPricingCategoryTabs() {
  const tabs = document.querySelectorAll('#pricing-category-tabs .category-tab-btn');
  const cards = document.querySelectorAll('#pricing-cards-container .pricing-plan-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const filter = tab.dataset.pricingFilter || 'all';

      cards.forEach(card => {
        const cat = card.dataset.pricingCategory || '';
        const catList = cat.split(/\s+/);
        if (filter === 'all' || cat === filter || catList.includes(filter)) {
          card.style.display = 'flex';
          card.classList.add('visible');
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ---------------------------------------------------------------
   18. SERVICE DETAILS MODAL (Xem chi tiết dịch vụ)
   --------------------------------------------------------------- */
function initServiceModal() {
  const modal = document.getElementById('service-modal');
  if (!modal) return;

  const btnClose = document.getElementById('service-modal-close');
  const btnCancel = document.getElementById('service-modal-cancel');

  function openModal(serviceId) {
    const data = serviceDetailsData[serviceId];
    if (!data) return;

    const badge = document.getElementById('modal-category-badge');
    const title = document.getElementById('service-modal-title');
    const desc = document.getElementById('service-modal-desc');
    const price = document.getElementById('modal-service-price');
    const minDur = document.getElementById('modal-service-min');
    const dur = document.getElementById('modal-service-duration');
    const featuresList = document.getElementById('modal-service-features');
    const ctaBook = document.getElementById('service-modal-book-cta');

    if (badge) {
      badge.textContent = data.category === 'Vệ sinh' ? '🧹 Vệ sinh' : '🏡 Chăm sóc tại nhà';
      badge.className = `badge-category ${data.categoryClass}`;
    }
    if (title) title.textContent = data.title;
    if (desc) desc.textContent = data.desc;
    if (price) price.textContent = data.price;
    if (minDur) minDur.textContent = data.minDuration;
    if (dur) dur.textContent = data.duration;

    if (featuresList) {
      featuresList.innerHTML = '';
      (data.features || []).forEach(f => {
        const li = document.createElement('li');
        li.textContent = f;
        featuresList.appendChild(li);
      });
    }

    if (ctaBook) {
      ctaBook.setAttribute('href', `booking.html?service_id=${serviceId}`);
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Lắng nghe click các nút "Xem chi tiết"
  document.querySelectorAll('.btn-service-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-service-id');
      openModal(id);
    });
  });

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
}

/* ---------------------------------------------------------------
   20. ĐIỀU HƯỚNG KHI NHẤN TOÀN BỘ VÙNG CARD DỊCH VỤ (PHẦN 2)
   --------------------------------------------------------------- */
function initCardClickNavigation() {
  const cards = document.querySelectorAll('.service-card[data-href]');
  cards.forEach(card => {
    // Click cả card
    card.addEventListener('click', (e) => {
      // Bỏ qua nếu người dùng nhấn vào nút hoặc liên kết con bên trong card
      if (e.target.closest('a, button')) {
        return;
      }
      const href = card.getAttribute('data-href');
      if (href) {
        window.location.href = href;
      }
    });

    // Hỗ trợ bàn phím: Enter hoặc Phím cách
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (!e.target.closest('a, button')) {
          e.preventDefault();
          const href = card.getAttribute('data-href');
          if (href) {
            window.location.href = href;
          }
        }
      }
    });
  });

  // Chặn điều hướng kép khi bấm vào nút / link bên trong card
  document.querySelectorAll('.service-card a, .service-card button').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

/* ---------------------------------------------------------------
   19. KHỞI TẠO KHI TRANG ĐÃ TẢI XONG
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Đồng bộ ngôn ngữ đã lưu hoặc mặc định tiếng Việt
  switchLanguage(currentLang);

  // Khởi tạo trạng thái phiên đăng nhập (Auth Session)
  initAuthStatus();

  // Khởi tạo các module giao diện
  initStickyHeader();
  initMobileMenu();
  initFAQ();
  initNotifications();
  initScrollReveal();
  initSmoothScroll();
  initCTAButtons();
  initCalculator();
  initLanguageToggle();
  initServicesAndPricing();
  initCardClickNavigation();
});

