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
        window.location.href = 'login.html?logout=true';
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

      async getMyBookings() {
        return await request('/bookings/my-bookings');
      },

      async getDetail(id) {
        return await request(`/bookings/${id}`);
      },

      async cancel(id) {
        return await request(`/bookings/${id}/cancel`, {
          method: 'PUT'
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

      async getReview(id) {
        return await request(`/bookings/${id}/review`);
      },

      async getAllReviews(limit = 10) {
        return await request(`/bookings/reviews/all?limit=${limit}`);
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
      async getStats() {
        return await request('/admin/stats');
      },

      // Quản lý đơn & Phân công
      async getAllBookings() {
        return await request('/admin/bookings');
      },

      async updateBookingStatus(id, status) {
        return await request(`/admin/bookings/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
      },

      async assignStaff(bookingId, staffId) {
        return await request(`/admin/bookings/${bookingId}/assign`, {
          method: 'PUT',
          body: JSON.stringify({ staff_id: staffId })
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

      async toggleUserStatus(id, status) {
        return await request(`/admin/users/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
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

      async updateTaskStatus(id, status, staff_notes = '') {
        return await request(`/staff/tasks/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status, staff_notes })
        });
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
    }
  };
})();
