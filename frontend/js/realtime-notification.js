// ============================================================
// DABCLEAN FRONTEND - Real-time Notification Engine (Socket.IO)
// Web Audio Synthesizer, Glassmorphism Toast & Notification Drawer
// ============================================================
(function () {
  'use strict';

  // Khởi tạo AudioContext cho âm thanh thông báo không cần file mp3 ngoài
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Khởi động AudioContext khi người dùng tương tác lần đầu
  document.addEventListener('click', () => getAudioContext(), { once: true });
  document.addEventListener('keydown', () => getAudioContext(), { once: true });

  // 1. SOUND SYNTHESIZER ENGINE (Web Audio API)
  const SoundEngine = {
    isEnabled() {
      return localStorage.getItem('dabclean_sound_enabled') !== 'false';
    },
    toggle() {
      const newState = !this.isEnabled();
      localStorage.setItem('dabclean_sound_enabled', String(newState));
      return newState;
    },
    play(soundType = 'chime') {
      if (!this.isEnabled()) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        if (soundType === 'new_order') {
          // Chuông báo đơn hàng mới cho Thợ (Tri-tone fanfare: C5 -> E5 -> G5)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.12);
            gain.gain.setValueAtTime(0, now + idx * 0.12);
            gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.12);
            osc.stop(now + idx * 0.12 + 0.35);
          });
        } else if (soundType === 'coin') {
          // Âm thanh nạp tiền/nhận thù lao ví (Bright metallic ping: B5 -> E6)
          const notes = [987.77, 1318.51];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0, now + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.4);
          });
        } else if (soundType === 'alert') {
          // Âm thanh cảnh báo / hủy đơn (A4 -> F4)
          const notes = [440.00, 349.23];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * 0.15);
            gain.gain.setValueAtTime(0, now + idx * 0.15);
            gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.15 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.15);
            osc.stop(now + idx * 0.15 + 0.3);
          });
        } else {
          // Chuông tiêu chuẩn (Standard Chime: D5 -> A5)
          const notes = [587.33, 880.00];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);
            gain.gain.setValueAtTime(0, now + idx * 0.1);
            gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.4);
          });
        }
      } catch (e) {
        console.warn('[SoundEngine] Không thể phát âm thanh:', e);
      }
    }
  };

  // 2. TOAST NOTIFICATION MANAGER
  const ToastManager = {
    container: null,
    init() {
      if (!this.container) {
        let el = document.getElementById('dabclean-toast-container');
        if (!el) {
          el = document.createElement('div');
          el.id = 'dabclean-toast-container';
          document.body.appendChild(el);
        }
        this.container = el;
      }
    },
    show({ id, type = 'info', title, message, time, sound = 'chime', onClick }) {
      this.init();
      SoundEngine.play(sound);

      const toast = document.createElement('div');
      toast.className = 'dabclean-toast';
      toast.setAttribute('data-type', type);

      const icons = {
        new_booking: '🔔',
        booking_created: '✅',
        staff_accepted: '👨‍🔧',
        staff_started: '🧹',
        staff_completed: '🎉',
        booking_completed: '🎉',
        booking_cancelled: '⚠️',
        wallet_topup: '💰',
        wage_payout: '💵',
        withdrawal_request: '💸',
        withdrawal_created: '⏳',
        alert: '⚠️',
        info: 'ℹ️'
      };
      const icon = icons[type] || '🔔';

      toast.innerHTML = `
        <div class="dabclean-toast-icon">${icon}</div>
        <div class="dabclean-toast-body">
          <div class="dabclean-toast-title">
            <span>${escapeHtml(title)}</span>
            <button type="button" class="dabclean-toast-close" aria-label="Đóng">&times;</button>
          </div>
          <p class="dabclean-toast-message">${escapeHtml(message)}</p>
          <span class="dabclean-toast-time">${time || 'Vừa xong'}</span>
        </div>
        <div class="dabclean-toast-progress"></div>
      `;

      // Click vào toast
      toast.addEventListener('click', (e) => {
        if (e.target.closest('.dabclean-toast-close')) {
          this.dismiss(toast);
          return;
        }
        if (typeof onClick === 'function') {
          onClick();
        } else if (type === 'new_booking' && window.location.pathname.includes('staff')) {
          // Chuyển sang tab chợ việc nếu đang ở trang thợ
          const marketTab = document.querySelector('[data-tab="market"]');
          if (marketTab) marketTab.click();
        } else if (type.startsWith('staff_') || type.startsWith('booking_')) {
          // Nếu khách nhận thông báo về đơn hàng
          if (!window.location.pathname.includes('my-bookings')) {
            window.location.href = 'my-bookings.html';
          }
        }
        this.dismiss(toast);
      });

      this.container.appendChild(toast);

      // Animation trượt vào
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });

      // Tự động đóng sau 6 giây
      const duration = 6000;
      const progressBar = toast.querySelector('.dabclean-toast-progress');
      if (progressBar) {
        progressBar.style.transition = `transform ${duration}ms linear`;
        requestAnimationFrame(() => {
          progressBar.style.transform = 'scaleX(0)';
        });
      }

      const timer = setTimeout(() => {
        this.dismiss(toast);
      }, duration);

      toast._dismissTimer = timer;
    },
    dismiss(toast) {
      if (!toast || toast._isDismissed) return;
      toast._isDismissed = true;
      if (toast._dismissTimer) clearTimeout(toast._dismissTimer);
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 400);
    }
  };

  // 3. NOTIFICATION DRAWER / BELL CENTER
  const NotificationCenter = {
    notifications: [],
    unreadCount: 0,
    storageKey: 'dabclean_realtime_notifs',

    init() {
      this.loadFromStorage();
      this.injectBellUI();
    },

    loadFromStorage() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.notifications = JSON.parse(raw);
          this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        }
      } catch (e) {
        this.notifications = [];
        this.unreadCount = 0;
      }
    },

    saveToStorage() {
      try {
        // Chỉ lưu tối đa 40 thông báo gần nhất
        const toSave = this.notifications.slice(0, 40);
        localStorage.setItem(this.storageKey, JSON.stringify(toSave));
      } catch (e) {}
    },

    add(notif) {
      const item = {
        id: notif.id || `notif_${Date.now()}`,
        type: notif.type || 'info',
        title: notif.title || 'Thông báo',
        message: notif.message || '',
        data: notif.data || null,
        created_at: notif.created_at || new Date().toISOString(),
        isRead: false
      };
      this.notifications.unshift(item);
      this.unreadCount++;
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    },

    markAllAsRead() {
      this.notifications.forEach(n => n.isRead = true);
      this.unreadCount = 0;
      this.saveToStorage();
      this.updateBadge();
      this.renderList();
    },

    updateBadge() {
      const badges = document.querySelectorAll('.dabclean-bell-badge');
      badges.forEach(badge => {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        badge.classList.remove('bump');
        void badge.offsetWidth; // trigger reflow
        if (this.unreadCount > 0) {
          badge.classList.add('bump');
        }
      });
    },

    injectBellUI() {
      // 1. Kiểm tra xem trên header đã có nút chuông chưa
      let bellBtn = document.getElementById('dabclean-realtime-bell-btn');
      
      // Nếu chưa có, tìm vị trí navbar thích hợp để nhúng hoặc tạo nút nổi góc màn hình
      if (!bellBtn) {
        const navActions = document.querySelector('.nav-actions, .header-actions, .topbar-right, .user-menu');
        if (navActions) {
          bellBtn = document.createElement('button');
          bellBtn.id = 'dabclean-realtime-bell-btn';
          bellBtn.type = 'button';
          bellBtn.title = 'Thông báo hệ thống DabClean';
          bellBtn.innerHTML = `🔔<span class="dabclean-bell-badge" style="display:none;">0</span>`;
          navActions.insertBefore(bellBtn, navActions.firstChild);
        } else {
          // Tạo floating widget ở góc phải dưới
          const floatWrapper = document.createElement('div');
          floatWrapper.style.position = 'fixed';
          floatWrapper.style.bottom = '24px';
          floatWrapper.style.right = '24px';
          floatWrapper.style.zIndex = '999990';

          bellBtn = document.createElement('button');
          bellBtn.id = 'dabclean-realtime-bell-btn';
          bellBtn.type = 'button';
          bellBtn.title = 'Thông báo thời gian thực';
          bellBtn.innerHTML = `🔔<span class="dabclean-bell-badge" style="display:none;">0</span>`;
          floatWrapper.appendChild(bellBtn);
          document.body.appendChild(floatWrapper);
        }
      }

      // 2. Tạo dropdown container
      let dropdown = document.getElementById('dabclean-notif-dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'dabclean-notif-dropdown';
        dropdown.innerHTML = `
          <div class="dabclean-notif-header">
            <h4>Thông báo trực tiếp</h4>
            <div class="dabclean-notif-actions">
              <button type="button" class="dabclean-sound-toggle-btn" title="Bật/Tắt âm thanh thông báo">
                ${SoundEngine.isEnabled() ? '🔊' : '🔇'}
              </button>
              <button type="button" class="dabclean-notif-clear-btn">Đã đọc tất cả</button>
            </div>
          </div>
          <div class="dabclean-notif-list" id="dabclean-dropdown-list"></div>
        `;
        document.body.appendChild(dropdown);

        // Nút toggle âm thanh
        const soundBtn = dropdown.querySelector('.dabclean-sound-toggle-btn');
        soundBtn.addEventListener('click', () => {
          const enabled = SoundEngine.toggle();
          soundBtn.textContent = enabled ? '🔊' : '🔇';
          soundBtn.title = enabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt';
          if (enabled) SoundEngine.play('chime');
        });

        // Nút đánh dấu đã đọc
        const clearBtn = dropdown.querySelector('.dabclean-notif-clear-btn');
        clearBtn.addEventListener('click', () => {
          this.markAllAsRead();
        });
      }

      // 3. Sự kiện click mở / đóng dropdown
      if (bellBtn) {
        bellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = dropdown.classList.toggle('open');
          if (isOpen) {
            this.renderList();
          }
        });
      }

      // Đóng dropdown khi click ra ngoài
      document.addEventListener('click', (e) => {
        if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target) && e.target !== bellBtn && !bellBtn?.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });

      this.updateBadge();
    },

    renderList() {
      const listEl = document.getElementById('dabclean-dropdown-list');
      if (!listEl) return;

      if (this.notifications.length === 0) {
        listEl.innerHTML = `
          <div class="dabclean-notif-empty">
            <div style="font-size:32px;margin-bottom:8px;">🔔</div>
            <p style="margin:0;">Bạn chưa có thông báo nào mới.</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = this.notifications.map(n => {
        const icons = {
          new_booking: '🔔',
          booking_created: '✅',
          staff_accepted: '👨‍🔧',
          staff_started: '🧹',
          staff_completed: '🎉',
          booking_completed: '🎉',
          booking_cancelled: '⚠️',
          wallet_topup: '💰',
          wage_payout: '💵',
          withdrawal_request: '💸',
          alert: '⚠️',
          info: 'ℹ️'
        };
        const icon = icons[n.type] || '🔔';
        const dateObj = new Date(n.created_at);
        const timeStr = isNaN(dateObj.getTime()) ? 'Vừa xong' : dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

        return `
          <div class="dabclean-notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
            <div class="dabclean-notif-item-icon">${icon}</div>
            <div class="dabclean-notif-item-content">
              <div class="dabclean-notif-item-title">${escapeHtml(n.title)}</div>
              <div class="dabclean-notif-item-msg">${escapeHtml(n.message)}</div>
              <div class="dabclean-notif-item-time">${timeStr}</div>
            </div>
          </div>
        `;
      }).join('');

      // Sự kiện bấm vào item trong dropdown
      listEl.querySelectorAll('.dabclean-notif-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-id');
          const target = this.notifications.find(n => n.id === id);
          if (target) {
            target.isRead = true;
            this.saveToStorage();
            this.updateBadge();
            item.classList.remove('unread');
          }
        });
      });
    }
  };

  // Helper escape HTML chống XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 4. SOCKET.IO CLIENT CONNECTION & DISPATCHER
  let socket = null;
  const eventListeners = new Map();

  function getToken() {
    return localStorage.getItem('dabclean_token') 
        || sessionStorage.getItem('dabclean_token') 
        || localStorage.getItem('cleanova_token') 
        || sessionStorage.getItem('cleanova_token');
  }

  function getSocketServerUrl() {
    if (typeof window === 'undefined') return 'http://localhost:5000';
    if (window.location.protocol === 'file:') return 'http://localhost:5000';
    if (window.location.port === '5000') return window.location.origin;

    const host = window.location.hostname || 'localhost';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal && (window.location.port === '' || window.location.port === '80' || window.location.port === '443')) {
      return window.location.origin;
    }

    const protocol = window.location.protocol.startsWith('http') ? window.location.protocol : 'http:';
    return `${protocol}//${host}:5000`;
  }

  function loadSocketIoScript(callback) {
    if (typeof io !== 'undefined') {
      callback();
      return;
    }
    // Nạp script Socket.IO từ server Express hoặc fallback CDN
    const serverUrl = getSocketServerUrl();
    const script = document.createElement('script');
    script.src = `${serverUrl}/socket.io/socket.io.js`;
    script.onload = () => callback();
    script.onerror = () => {
      // Fallback sang CDN uy tín nếu script nội bộ không tải được
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
      fallbackScript.onload = () => callback();
      fallbackScript.onerror = () => console.warn('[Realtime] Không thể tải thư viện Socket.IO Client.');
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  }

  function initSocketClient() {
    const token = getToken();
    const serverUrl = getSocketServerUrl();

    socket = io(serverUrl, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    socket.on('connect', () => {
      console.log('[Realtime] 🟢 Đã kết nối WebSocket thành công tới DabClean Server!');
      // Gửi lại token xác thực khi kết nối lại
      const curToken = getToken();
      if (curToken) {
        socket.emit('authenticate', curToken);
      }
    });

    socket.on('authenticated', (res) => {
      if (res && res.success) {
        console.log(`[Realtime] 🔑 Xác thực tài khoản thành công: Role [${res.user.role}]`);
      }
    });

    socket.on('notification', (payload) => {
      console.log('[Realtime] 📩 Nhận thông báo mới:', payload);
      NotificationCenter.add(payload);
      ToastManager.show({
        id: payload.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        sound: payload.sound || 'chime',
        onClick: () => {
          if (payload.data && payload.data.bookingId) {
            // Chuyển hướng hoặc xử lý tùy theo trang hiện tại
          }
        }
      });

      // Kích hoạt các handler đã đăng ký qua DabCleanRealtime.on('notification')
      dispatch('notification', payload);

      // Tự động reload danh sách công việc trên trang Thợ khi có đơn mới
      if (payload.type === 'new_booking' || payload.type === 'booking_claimed') {
        if (typeof window.loadMarketTasks === 'function') {
          window.loadMarketTasks();
        } else if (typeof window.fetchAssignedJobs === 'function') {
          window.fetchAssignedJobs();
        }
      }

      // Tự động reload đơn hàng trên trang Khách hàng
      if (window.location.pathname.includes('my-bookings.html') && typeof window.loadBookings === 'function') {
        window.loadBookings();
      }
    });

    socket.on('booking_status_updated', (data) => {
      console.log('[Realtime] 🔄 Trạng thái đơn đặt dịch vụ thay đổi:', data);
      dispatch('booking_status_updated', data);
      // Reload danh sách đơn nếu trang hiện tại có hỗ trợ
      if (window.location.pathname.includes('my-bookings.html') && typeof window.loadBookings === 'function') {
        window.loadBookings();
      }
      if (window.location.pathname.includes('admin.html') && typeof window.loadDashboardStats === 'function') {
        window.loadDashboardStats();
      }
    });

    socket.on('booking_event', (eventData) => {
      dispatch('booking_event', eventData);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Realtime] 🔴 Mất kết nối WebSocket:', reason);
    });
  }

  function dispatch(eventName, data) {
    if (eventListeners.has(eventName)) {
      eventListeners.get(eventName).forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      NotificationCenter.init();
      loadSocketIoScript(initSocketClient);
    });
  } else {
    NotificationCenter.init();
    loadSocketIoScript(initSocketClient);
  }

  // Xuất API toàn cục để các trang có thể tương tác
  window.DabCleanRealtime = {
    on(event, callback) {
      if (!eventListeners.has(event)) {
        eventListeners.set(event, []);
      }
      eventListeners.get(event).push(callback);
    },
    off(event, callback) {
      if (eventListeners.has(event)) {
        const cbs = eventListeners.get(event).filter(cb => cb !== callback);
        eventListeners.set(event, cbs);
      }
    },
    joinBooking(bookingId) {
      if (socket && bookingId) {
        socket.emit('join_booking', bookingId);
      }
    },
    leaveBooking(bookingId) {
      if (socket && bookingId) {
        socket.emit('leave_booking', bookingId);
      }
    },
    notify(title, message, options = {}) {
      ToastManager.show({
        title,
        message,
        type: options.type || 'info',
        sound: options.sound || 'chime',
        onClick: options.onClick
      });
    },
    playSound(soundType) {
      SoundEngine.play(soundType);
    },
    getSocket() {
      return socket;
    }
  };

})();
