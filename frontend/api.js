// ============================================================
// CLEANOVA FRONTEND - API Client Service
// ============================================================
(function () {
  'use strict';

  // Tự động nhận diện URL Backend API:
  // Nếu đang chạy trên cổng 5000 (Express) thì dùng '/api'
  // Nếu đang chạy trên Live Server (5500, 8080, v.v.) thì gọi 'http://localhost:5000/api'
  const API_BASE_URL = (window.location.port === '5000')
    ? '/api'
    : 'http://localhost:5000/api';

  // Helper thực hiện fetch với Bearer Token và xử lý lỗi đồng bộ
  async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('cleanova_token') || sessionStorage.getItem('cleanova_token');

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || `Lỗi HTTP ${response.status}: Yêu cầu thất bại.`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        console.warn(`[API Client] Không thể kết nối tới Backend tại ${API_BASE_URL}. Vui lòng kiểm tra server Node.js.`);
      }
      throw err;
    }
  }

  // Khai báo đối tượng API toàn cục
  window.CleanovaAPI = {
    BASE_URL: API_BASE_URL,

    // Module Xác thực
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
        sessionStorage.removeItem('cleanova_logged_in');
        sessionStorage.removeItem('cleanova_user_email');
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
      }
    },

    // Module Dịch vụ
    services: {
      async getAll(search = '') {
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        return await request(`/services${query}`);
      },

      async getDetail(idOrSlug) {
        return await request(`/services/${idOrSlug}`);
      }
    },

    // Module Đặt lịch
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
      }
    },

    // Module Quản trị viên
    admin: {
      async getStats() {
        return await request('/admin/stats');
      },

      async getAllBookings() {
        return await request('/admin/bookings');
      },

      async updateBookingStatus(id, status) {
        return await request(`/admin/bookings/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
      },

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

      async getAllUsers() {
        return await request('/admin/users');
      }
    }
  };
})();
