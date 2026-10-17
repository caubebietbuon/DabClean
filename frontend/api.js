// ============================================================
// CLEANOVA FRONTEND - API Client Adapter (Vanilla JS Fetch Wrapper)
// Hỗ trợ đầy đủ RESTful API cho Customer, Staff và Admin
// ============================================================
(function () {
  'use strict';

  const API_BASE_URL = window.location.origin.includes(':5000') 
    ? `${window.location.origin}/api` 
    : 'http://localhost:5000/api';

  async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const token = localStorage.getItem('cleanova_token') || sessionStorage.getItem('cleanova_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type');
      let data = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        // Nếu phát hiện phiên đăng nhập đã hết hạn (401 Unauthorized)
        if (response.status === 401) {
          localStorage.removeItem('cleanova_token');
          localStorage.removeItem('cleanova_user');
          sessionStorage.clear();
          const currentFile = window.location.pathname.split('/').pop() || 'trangchu.html';
          const protectedPages = ['booking.html', 'my-bookings.html', 'profile.html', 'admin.html', 'staff.html'];
          if (protectedPages.includes(currentFile)) {
            const returnUrl = encodeURIComponent(currentFile + window.location.search + window.location.hash);
            const msg = encodeURIComponent('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục sử dụng dịch vụ.');
            window.location.href = `login.html?redirect=${returnUrl}&message=${msg}`;
            return;
          }
        }

        // Nếu phát hiện tài khoản bị vô hiệu hóa
        if (response.status === 403 && data && data.code === 'ACCOUNT_DEACTIVATED') {
          localStorage.removeItem('cleanova_token');
          localStorage.removeItem('cleanova_user');
          sessionStorage.clear();
          alert('Tài khoản của bạn đã bị vô hiệu hóa bởi Quản trị viên. Hệ thống sẽ chuyển về trang đăng nhập.');
          window.location.href = 'login.html?deactivated=true';
          return;
        }

        const errorMessage = (data && data.message) ? data.message : `Yêu cầu thất bại (${response.status})`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[CleanovaAPI] Lỗi gọi ${endpoint}:`, err.message);
      throw err;
    }
  }

  window.CleanovaAPI = {
    BASE_URL: API_BASE_URL,

    // Module Xác thực & Quản lý phiên
    auth: {
      async register(userData) {
        const res = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData)
        });
        if (res.data && res.data.token) {
          localStorage.setItem('cleanova_token', res.data.token);
          localStorage.setItem('cleanova_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('cleanova_logged_in', 'true');
          sessionStorage.setItem('cleanova_user_email', res.data.user.email);
        }
        return res;
      },

      async login(email, password) {
        const res = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        if (res.data && res.data.token) {
          localStorage.setItem('cleanova_token', res.data.token);
          localStorage.setItem('cleanova_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('cleanova_logged_in', 'true');
          sessionStorage.setItem('cleanova_user_email', res.data.user.email);
        }
        return res;
      },

      async getMe() {
        return await request('/auth/me');
      },

      async updateProfile(profileData) {
        const res = await request('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify(profileData)
        });
        if (res.data && res.data.user) {
          localStorage.setItem('cleanova_user', JSON.stringify(res.data.user));
        }
        return res;
      },

      async changePassword(passwordData) {
        return await request('/auth/change-password', {
          method: 'PUT',
          body: JSON.stringify(passwordData)
        });
      },

      logout() {
        localStorage.removeItem('cleanova_token');
        localStorage.removeItem('cleanova_user');
        sessionStorage.clear();
        window.location.href = 'trangchu.html';
      },

      // Kiểm tra đăng nhập và tự động chuyển hướng kèm returnUrl nếu là khách vãng lai
      requireAuth(targetUrl = 'booking.html', customMessage = 'Vui lòng đăng nhập để tiếp tục sử dụng dịch vụ CleanNova') {
        if (this.isLoggedIn()) {
          return true;
        }
        const redirectParam = encodeURIComponent(targetUrl);
        const messageParam = encodeURIComponent(customMessage);
        window.location.href = `login.html?redirect=${redirectParam}&message=${messageParam}`;
        return false;
      },

      getUser() {
        try {
          return JSON.parse(localStorage.getItem('cleanova_user') || 'null');
        } catch {
          return null;
        }
      },

      getToken() {
        return localStorage.getItem('cleanova_token') || sessionStorage.getItem('cleanova_token');
      },

      isLoggedIn() {
        return Boolean(this.getToken());
      },

      isAdmin() {
        const user = this.getUser();
        return Boolean(user && user.role === 'admin');
      },

      isStaff() {
        const user = this.getUser();
        return Boolean(user && user.role === 'staff');
      },

      isCustomer() {
        const user = this.getUser();
        return Boolean(!user || user.role === 'customer' || user.role === 'user');
      },

      getRedirectUrlByRole() {
        const user = this.getUser();
        if (!user) return 'trangchu.html';
        if (user.role === 'admin') return 'admin.html';
        if (user.role === 'staff') return 'staff.html';
        return 'trangchu.html';
      }
    },

    // Module Dịch vụ vệ sinh
    services: {
      async getAll(search = '') {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return await request(`/services${query}`);
      },

      async getDetail(idOrSlug) {
        return await request(`/services/${idOrSlug}`);
      }
    },

    // Module Đặt lịch khách hàng
    bookings: {
      async create(bookingData) {
        return await request('/bookings', {
          method: 'POST',
          body: JSON.stringify(bookingData)
        });
      },

      async getQuote(quoteData) {
        return await request('/bookings/quote', {
          method: 'POST',
          body: JSON.stringify(quoteData)
        });
      },

      async getMyBookings() {
        return await request('/bookings/my-bookings');
      },

      async getMyNotifications() {
        return await request('/bookings/notifications');
      },

      async markNotificationRead(notificationId) {
        return await request(`/bookings/notifications/${notificationId}/read`, {
          method: 'PATCH'
        });
      },

      async getDetail(id) {
        return await request(`/bookings/${id}`);
      },

      async cancel(id, reason) {
        return await request(`/bookings/${id}/cancel`, {
          method: 'PUT',
          body: JSON.stringify({ reason })
        });
      },

      async reschedule(id, rescheduleData) {
        return await request(`/bookings/${id}/reschedule`, {
          method: 'PUT',
          body: JSON.stringify(rescheduleData)
        });
      },

      async addReview(id, reviewData) {
        return await request(`/bookings/${id}/review`, {
          method: 'POST',
          body: JSON.stringify(reviewData)
        });
      },

      async addTip(id, amount) {
        return await request(`/bookings/${id}/tip`, {
          method: 'POST',
          body: JSON.stringify({ amount })
        });
      },

      async getReview(id) {
        return await request(`/bookings/${id}/review`);
      },

      async getAllReviews(limit = 10) {
        return await request(`/bookings/reviews/all?limit=${limit}`);
      },

      async getQuote(quoteData) {
        return await request('/bookings/quote', {
          method: 'POST',
          body: JSON.stringify(quoteData)
        });
      }
    },

    // Module Ví CleanNova (Ví điện tử & Lịch sử giao dịch sổ cái)
    wallet: {
      async getMyWallet() {
        return await request('/wallet/my');
      },

      async getTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await request(`/wallet/transactions${query ? '?' + query : ''}`);
      },

      async topup(amount, idempotency_key = null, description = '') {
        return await request('/wallet/topup', {
          method: 'POST',
          body: JSON.stringify({ amount, idempotency_key, description })
        });
      },

      async payBooking(booking_id, idempotency_key = null) {
        return await request('/wallet/pay-booking', {
          method: 'POST',
          body: JSON.stringify({ booking_id, idempotency_key })
        });
      },

      async getAdminWallets() {
        return await request('/wallet/admin/wallets');
      },

      async getAdminTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await request(`/wallet/admin/transactions${query ? '?' + query : ''}`);
      },

      async adminRefund(booking_id, reason = '') {
        return await request('/wallet/admin/refund', {
          method: 'POST',
          body: JSON.stringify({ booking_id, reason })
        });
      },

      async withdraw(withdrawData) {
        return await request('/wallet/withdraw', {
          method: 'POST',
          body: JSON.stringify(withdrawData)
        });
      },

      async getStaffSummary() {
        return await request('/wallet/staff/summary');
      },

      // Hai ví nhân viên (Mô hình Grab Driver: Ví tín dụng & Ví thu nhập)
      async getStaffWallets() {
        return await request('/wallet/staff/wallets');
      },

      async checkStaffEligibility() {
        return await request('/wallet/staff/eligibility');
      },

      async topupStaffCredit(topupData) {
        return await request('/wallet/staff/topup-credit', {
          method: 'POST',
          body: JSON.stringify(topupData)
        });
      },

      async transferToCredit(transferData) {
        return await request('/wallet/staff/transfer', {
          method: 'POST',
          body: JSON.stringify(transferData)
        });
      },

      async getAdminStaffWallets() {
        return await request('/wallet/admin/staff-wallets');
      }
    },

    // Module Mã giảm giá Voucher & Khuyến mãi động
    vouchers: {
      async getActive() {
        return await request('/vouchers/active');
      },

      async check(code, service_id = null, subtotal = 0, frequency = 'once') {
        return await request('/vouchers/check', {
          method: 'POST',
          body: JSON.stringify({ code, service_id, subtotal, frequency })
        });
      },

      async getAllAdmin() {
        return await request('/vouchers/admin/all');
      },

      async createAdmin(voucherData) {
        return await request('/vouchers/admin/create', {
          method: 'POST',
          body: JSON.stringify(voucherData)
        });
      }
    },

    // Module Sổ địa chỉ khách hàng (Address Book)
    addresses: {
      getStorageKey() {
        const user = window.CleanovaAPI.auth.getUser();
        return user ? `cleanova_addresses_${user.id}` : 'cleanova_addresses_guest';
      },

      getAll() {
        const user = window.CleanovaAPI.auth.getUser();
        const defaultList = [
          {
            id: 'addr_1',
            label: 'Nhà riêng',
            address: (user && user.address) ? user.address : 'Số 25 Phố Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
            phone: (user && user.phone) ? user.phone : '0987654321',
            is_default: true
          },
          {
            id: 'addr_2',
            label: 'Văn phòng làm việc',
            address: 'Tòa nhà FPT Tower, Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội',
            phone: (user && user.phone) ? user.phone : '0987654321',
            is_default: false
          }
        ];
        try {
          const saved = localStorage.getItem(this.getStorageKey());
          return saved ? JSON.parse(saved) : defaultList;
        } catch {
          return defaultList;
        }
      },

      save(list) {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(list));
      },

      add(item) {
        const list = this.getAll();
        const newItem = {
          id: `addr_${Date.now()}`,
          label: item.label || 'Địa chỉ mới',
          address: item.address,
          phone: item.phone,
          is_default: list.length === 0 || item.is_default || false
        };
        if (newItem.is_default) {
          list.forEach(a => a.is_default = false);
        }
        list.push(newItem);
        this.save(list);
        return newItem;
      },

      setDefault(id) {
        const list = this.getAll();
        list.forEach(a => {
          a.is_default = (a.id === id);
        });
        this.save(list);
      },

      remove(id) {
        let list = this.getAll();
        list = list.filter(a => a.id !== id);
        if (list.length > 0 && !list.some(a => a.is_default)) {
          list[0].is_default = true;
        }
        this.save(list);
      }
    },

    // Module Dịch vụ yêu thích (Favorites)
    favorites: {
      getStorageKey() {
        const user = window.CleanovaAPI.auth.getUser();
        return user ? `cleanova_favs_${user.id}` : 'cleanova_favs_guest';
      },

      getAll() {
        try {
          return JSON.parse(localStorage.getItem(this.getStorageKey()) || '[1, 2]');
        } catch {
          return [1, 2];
        }
      },

      toggle(serviceId) {
        const id = parseInt(serviceId, 10);
        let favs = this.getAll();
        if (favs.includes(id)) {
          favs = favs.filter(item => item !== id);
        } else {
          favs.push(id);
        }
        localStorage.setItem(this.getStorageKey(), JSON.stringify(favs));
        return favs.includes(id);
      },

      isFav(serviceId) {
        const id = parseInt(serviceId, 10);
        return this.getAll().includes(id);
      }
    },

    // Module Quản trị viên (Admin)
    admin: {
      async getStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return await request(`/admin/stats${query ? '?' + query : ''}`);
      },

      async getCommissionConfig() {
        return await request('/admin/config/commission');
      },

      async updateCommissionConfig(configData) {
        return await request('/admin/config/commission', {
          method: 'PUT',
          body: JSON.stringify(configData)
        });
      },

      // Quản lý đơn & Phân công
      async getAllBookings() {
        return await request('/admin/bookings');
      },

      async updateBookingStatus(id, status, reason = '') {
        return await request(`/admin/bookings/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status, reason })
        });
      },

      async assignStaff(bookingId, staffId) {
        return await request(`/admin/bookings/${bookingId}/assign`, {
          method: 'PUT',
          body: JSON.stringify({ staff_id: staffId })
        });
      },

      async payoutStaffWage(bookingId) {
        return await request(`/admin/bookings/${bookingId}/payout`, {
          method: 'PATCH'
        });
      },

      async confirmQuote(bookingId, quoteData) {
        return await request(`/admin/bookings/${bookingId}/confirm-quote`, {
          method: 'PUT',
          body: JSON.stringify(quoteData)
        });
      },

      async getPostConstructionConfig() {
        return await request('/admin/post-construction/config');
      },

      async updatePostConstructionConfig(data) {
        return await request('/admin/post-construction/config', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      },

      // Quản lý dịch vụ
      async createService(serviceData) {
        return await request('/admin/services', {
          method: 'POST',
          body: JSON.stringify(serviceData)
        });
      },

      async updateService(id, serviceData) {
        return await request(`/admin/services/${id}`, {
          method: 'PUT',
          body: JSON.stringify(serviceData)
        });
      },

      async deleteService(id) {
        return await request(`/admin/services/${id}`, {
          method: 'DELETE'
        });
      },

      // Quản lý tài khoản (RBAC)
      async getUsers(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.search) searchParams.append('search', params.search);
        if (params.role) searchParams.append('role', params.role);
        if (params.status) searchParams.append('status', params.status);
        if (params.page) searchParams.append('page', params.page);
        if (params.limit) searchParams.append('limit', params.limit);

        const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return await request(`/admin/users${qs}`);
      },

      async getUserDetail(id) {
        return await request(`/admin/users/${id}`);
      },

      async updateUser(id, userData) {
        return await request(`/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(userData)
        });
      },

      async toggleUserStatus(id, status, reason = '') {
        return await request(`/admin/users/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, reason })
        });
      },

      async deleteUser(id) {
        return await request(`/admin/users/${id}`, {
          method: 'DELETE'
        });
      },

      // Quản lý nhân viên
      async getStaff() {
        return await request('/admin/staff');
      },

      async createStaff(staffData) {
        return await request('/admin/staff', {
          method: 'POST',
          body: JSON.stringify(staffData)
        });
      },

      async getStaffTasks(staffId) {
        return await request(`/admin/staff/${staffId}/tasks`);
      },

      // Quản lý hồ sơ đối tác & tuyển dụng
      async getPartners(params = {}) {
        const searchParams = new URLSearchParams();
        if (params.status) searchParams.append('status', params.status);
        if (params.search) searchParams.append('search', params.search);
        const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return await request(`/admin/partners${qs}`);
      },

      async getPartnerDetail(id) {
        return await request(`/admin/partners/${id}`);
      },

      async approvePartner(id) {
        return await request(`/admin/partners/${id}/approve`, {
          method: 'PATCH'
        });
      },

      async rejectPartner(id, reason = '') {
        return await request(`/admin/partners/${id}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ rejection_reason: reason })
        });
      },

      // Quản lý báo giá & cấu hình Vệ sinh sau xây dựng
      async confirmQuote(id, quoteData) {
        return await request(`/admin/bookings/${id}/confirm-quote`, {
          method: 'PUT',
          body: JSON.stringify(quoteData)
        });
      },

      async getPostConstructionConfig() {
        return await request('/admin/post-construction/config');
      },

      async updatePostConstructionConfig(key, config_data) {
        return await request('/admin/post-construction/config', {
          method: 'PUT',
          body: JSON.stringify({ key, config_data })
        });
      }
    },

    // Module Nhân viên Cleanova (Staff Portal)
    staff: {
      async getMyTasks(status = '') {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return await request(`/staff/tasks${query}`);
      },

      async getTaskDetail(id) {
        return await request(`/staff/tasks/${id}`);
      },

      async updateTaskStatus(id, status, staff_notes = '', cancel_reason = '') {
        return await request(`/staff/tasks/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, staff_notes, cancel_reason })
        });
      },

      async confirmCashPayment(id) {
        return await request(`/staff/tasks/${id}/cash-payment`, {
          method: 'POST'
        });
      },

      async getTaskChecklist(id) {
        return await request(`/staff/tasks/${id}/checklist`);
      },

      async uploadTaskPhoto(id, photoData) {
        const formData = new FormData();
        formData.append('photo', photoData.file, 'job-photo.jpg');
        formData.append('areaName', photoData.areaName);
        formData.append('angleId', photoData.angleId);
        formData.append('stage', photoData.stage);
        formData.append('capturedAt', photoData.capturedAt);
        formData.append('latitude', String(photoData.latitude));
        formData.append('longitude', String(photoData.longitude));
        return await request(`/staff/tasks/${id}/photos`, {
          method: 'POST',
          body: formData
        });
      },

      async getTaskPhoto(imagePath) {
        const token = window.CleanovaAPI.auth.getToken();
        const response = await fetch(`${API_BASE_URL}${imagePath}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!response.ok) {
          throw new Error(`Không thể tải ảnh công việc (${response.status}).`);
        }
        return await response.blob();
      },

      async getProfile() {
        return await request('/staff/profile');
      },

      async updateProfile(profileData) {
        return await request('/staff/profile', {
          method: 'PATCH',
          body: JSON.stringify(profileData)
        });
      },

      async changePassword(passwordData) {
        return await request('/staff/change-password', {
          method: 'PUT',
          body: JSON.stringify(passwordData)
        });
      }
    },

    // Module Đối tác Cleanova (Partner & Employee Onboarding)
    partner: {
      async register(applicationData) {
        return await request('/partner/register', {
          method: 'POST',
          body: JSON.stringify(applicationData)
        });
      }
    },

    // Module AI Vision: Quét đa ảnh phòng & Báo giá tự động
    ai: {
      async estimate(formData) {
        // Danh sách các endpoints thông minh (ưu tiên Backend 5000, sau đó AI module 5100)
        const endpoints = [
          `${API_BASE_URL}/ai/estimate`,
          'http://127.0.0.1:5000/api/ai/estimate',
          'http://localhost:5100/api/ai/estimate',
          'http://127.0.0.1:5100/api/ai/estimate'
        ];

        // Loại bỏ endpoint trùng lặp
        const uniqueEndpoints = [...new Set(endpoints)];

        let lastError = null;
        for (const url of uniqueEndpoints) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

            // Đảm bảo TUYỆT ĐỐI KHÔNG set Content-Type thủ công khi gửi FormData
            const res = await fetch(url, {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const contentType = res.headers.get('content-type') || '';
            let data = null;
            if (contentType.includes('application/json')) {
              data = await res.json().catch(() => null);
            }

            if (res.ok && data && data.success) {
              return adaptScanResponse(data);
            }

            if (data && data.message) {
              throw new Error(data.message);
            }

            if (!res.ok) {
              throw new Error(`Máy chủ trả về mã lỗi HTTP ${res.status}`);
            }
          } catch (err) {
            lastError = err;
            // Nếu lỗi do abort timeout
            if (err.name === 'AbortError') {
              lastError = new Error('Yêu cầu phân tích AI bị quá thời gian chờ (Timeout). Vui lòng thử lại với ảnh dung lượng nhỏ hơn.');
            }
          }
        }

        // Nếu tất cả server đều không phản hồi (Lỗi "Failed to fetch" kinh điển)
        const isNetworkErr = lastError && (
          lastError.name === 'TypeError' || 
          lastError.message.includes('fetch') || 
          lastError.message.includes('NetworkError') ||
          lastError.message.includes('Failed to fetch')
        );

        if (isNetworkErr) {
          throw new Error('Không thể kết nối đến máy chủ AI. Vui lòng khởi động AI module (npm start trong ai-module, cổng 5100) hoặc backend (cổng 5000).');
        }

        throw lastError || new Error('Không thể hoàn tất phân tích hình ảnh từ máy chủ AI.');
      },

      // Quét ảnh (chỉ trả độ bẩn, không báo giá).
      // Endpoint cũ `/ai/analyze` đã bị gỡ ở AI module v2.0 — nay dùng `/ai/scan`.
      async analyze(formData) {
        const endpoints = [
          `${API_BASE_URL}/ai/scan`,
          'http://127.0.0.1:5000/api/ai/scan',
          'http://localhost:5100/api/ai/scan',
          'http://127.0.0.1:5100/api/ai/scan'
        ];

        const uniqueEndpoints = [...new Set(endpoints)];
        let lastError = null;

        for (const url of uniqueEndpoints) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            const res = await fetch(url, {
              method: 'POST',
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json().catch(() => null);
            if (res.ok && data && data.success) {
              return adaptScanResponse(data);
            }
            if (data && data.message) {
              throw new Error(data.message);
            }
          } catch (err) {
            lastError = err;
          }
        }

        if (lastError && (lastError.name === 'TypeError' || lastError.message.includes('fetch'))) {
          throw new Error('Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra lại server backend (cổng 5000 hoặc 5100).');
        }

        throw lastError || new Error('Không thể kết nối đến máy chủ AI Cleanova.');
      },

      async getServices() {
        try {
          return await request('/ai/services');
        } catch {
          const res = await fetch('http://localhost:5100/api/ai/services').catch(() => null);
          if (res && res.ok) return await res.json();
          return null;
        }
      }
    }
  };

  /**
   * Chuyển kết quả từ AI module v2.0 (MobileNet) sang cấu trúc mà giao diện
   * booking.html đang mong đợi.
   *
   * AI module v2.0 trả về:
   *   { success, data: { scan: { diem, phanLoai, doTinCay, ... },
   *                      quote: { dirtLevel, service, totalPrice, ... } } }
   * (hoặc chỉ { scan } nếu gọi /scan)
   *
   * Giao diện booking.html cần:
   *   { overallScore, rating1to5, dirtLevel, quote, analysis, spaces, recommendations }
   *
   * ⚠️ KHÁC BIỆT CƠ BẢN GIỮA HAI CÔNG NGHỆ:
   * - Bản CŨ (heuristic) trả 5 chỉ số riêng lẻ: stains, clutter, dust, debris, brightness.
   * - Bản MỚI (MobileNet) là mô hình PHÂN LOẠI 3 lớp, KHÔNG có 5 chỉ số đó.
   *   Nó chỉ trả 3 xác suất: sach / hoiBan / ratBan.
   * Nên ta dùng chính 3 xác suất làm "chỉ số" hiển thị, thay vì bịa số liệu.
   * Đây là thông tin TRUNG THỰC — không bịa ra chỉ số không tồn tại.
   */
  function adaptScanResponse(json) {
    const d = json.data || {};
    const scan = d.scan || d;          // /scan trả thẳng, /estimate bọc trong .scan
    const quote = d.quote || null;

    const score = Math.round(scan.diem != null ? scan.diem : 0);
    const conf = scan.doTinCay || {};

    // Quy đổi điểm 0..100 -> thang 5 sao cho giao diện
    const rating1to5 = Math.max(1, Math.min(5, Math.round(score / 20)));

    // 3 xác suất -> phần trăm hiển thị (0..100)
    const pct = (v) => Math.round((v || 0) * 1000) / 10;
    const signals = {
      sach: pct(conf.sach),
      hoiBan: pct(conf.hoiBan),
      ratBan: pct(conf.ratBan)
    };

    // Mỗi ảnh (khi gửi nhiều) -> một thẻ "không gian"
    const perImage = scan.ketQuaTungAnh || [];
    const spaces = perImage.map((r, i) => {
      const s = Math.round(r.diem);
      return {
        index: i + 1,
        filename: r.filename || `Ảnh #${i + 1}`,
        roomType: r.filename ? r.filename.replace(/\.[^.]+$/, '') : `Ảnh #${i + 1}`,
        score: s,
        severity: s >= 65 ? 'high' : (s >= 35 ? 'medium' : 'low'),
        issues: `Phân loại: ${r.phanLoaiHienThi || r.phanLoai} (${s}/100)`,
        signals: {
          sach: pct(r.doTinCay && r.doTinCay.sach),
          hoiBan: pct(r.doTinCay && r.doTinCay.hoiBan),
          ratBan: pct(r.doTinCay && r.doTinCay.ratBan)
        }
      };
    });

    const level = (quote && quote.dirtLevel) || {
      level: scan.phanLoai === 'rat-ban' ? 'very_heavy'
        : scan.phanLoai === 'hoi-ban' ? 'moderate' : 'clean',
      label: scan.phanLoaiHienThi || scan.phanLoai,
      score
    };

    const service = (quote && quote.service) || null;
    const recommendations = [
      `Mô hình AI (MobileNet) phân loại: ${scan.phanLoaiHienThi || scan.phanLoai}`,
      `Độ tin cậy: Sạch ${signals.sach}% · Hơi bẩn ${signals.hoiBan}% · Rất bẩn ${signals.ratBan}%`,
      service ? `Gói dịch vụ gợi ý: ${service.name}` : null,
      quote ? `Chi phí dự kiến: ${quote.totalPriceLabel}` : null
    ].filter(Boolean);

    return {
      success: true,
      data: {
        overallScore: score,
        dirtScore: score,
        rating1to5,
        ratingLabel: `${rating1to5}/5 (${level.label || ''})`,
        dirtLevel: level,
        totalImages: scan.soAnh || 1,
        spaces,
        // booking.html đọc data.analysis.signals
        analysis: {
          overallScore: score,
          signals,
          analyzer: 'mobilenet-transfer-learning'
        },
        // booking.html đọc data.quote.finalPrice, .dirtFactor, .estimatedHours,
        // .recommendedService
        quote: quote ? {
          finalPrice: quote.totalPrice,
          formatVnd: quote.totalPriceLabel,
          dirtFactor: (quote.dirtLevel && quote.dirtLevel.priceMultiplier) || 1,
          estimatedHours: '~3 - 4 giờ',
          recommendedService: service ? {
            id: service.code === 'premium' ? 2 : 1,
            name: service.name,
            description: service.description
          } : null,
          breakdown: quote.breakdown,
          priceRange: quote.priceRange
        } : null,
        recommendations,
        summary: `AI phân loại độ bẩn: ${level.label} (${score}/100).`
      }
    };
  }

  // ============================================================
  // GLOBAL BOOKING FLOW INTERCEPTOR CHO KHÁCH VÃNG LAI
  // Tự động kiểm tra trạng thái đăng nhập khi khách bấm đặt dịch vụ
  // ============================================================
  document.addEventListener('click', function (e) {
    const target = e.target.closest('a, button');
    if (!target) return;

    // Không can thiệp nếu đang ở trang login hoặc register
    const currentPath = window.location.pathname.split('/').pop();
    if (currentPath === 'login.html' || currentPath === 'register.html') return;

    const href = target.getAttribute('href') || '';
    const isBookingLink = href.includes('booking.html');
    const isBookingAction = target.dataset.action === 'book';
    
    // Kiểm tra text nút
    const text = (target.textContent || '').trim().toLowerCase();
    const isBookingText = text.includes('đặt dịch vụ ngay') || 
                          text.includes('sử dụng dịch vụ') || 
                          text.includes('đặt lịch ngay') || 
                          text.includes('đặt ngay') || 
                          text.includes('tiến hành đặt dịch vụ') ||
                          text.includes('tiếp tục đặt lịch');

    const isExcluded = target.classList.contains('btn-service-detail') || 
                       href.startsWith('#why') || 
                       href.startsWith('#customer') || 
                       href.startsWith('#cleaning') || 
                       href.startsWith('#calculator');

    if ((isBookingLink || isBookingAction || isBookingText) && !isExcluded) {
      if (!window.CleanovaAPI.auth.isLoggedIn()) {
        e.preventDefault();
        e.stopPropagation();

        let destination = href;
        if (!destination || destination === '#' || destination.startsWith('javascript:')) {
          destination = 'booking.html';
        }

        // Nếu người dùng bấm từ widget tính giá trên trang chủ, mang theo dịch vụ đã chọn
        const calcService = document.getElementById('calc-service');
        if (calcService && (target.dataset.i18n === 'calc_btn_continue' || text.includes('tiếp tục đặt lịch'))) {
          const sVal = calcService.value;
          const serviceIdMap = { regular_cleaning: 1, deep_cleaning: 2, move_in_out: 3, office_cleaning: 4, sofa_carpet: 5 };
          const sid = serviceIdMap[sVal] || 1;
          destination = `booking.html?service_id=${sid}`;
        }

        window.CleanovaAPI.auth.requireAuth(destination, 'Vui lòng đăng nhập để tiếp tục sử dụng dịch vụ CleanNova');
      }
    }
  }, true);
})();
