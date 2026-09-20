// frontend/js/auth.js
// Authentication management and session guards
'use strict';

const auth = {
  getUser() {
    const userStr = localStorage.getItem('chatflow_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  setUser(user) {
    localStorage.setItem('chatflow_user', JSON.stringify(user));
  },

  isAuthenticated() {
    return !!api.getToken();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  },

  redirectIfAuthenticated() {
    if (this.isAuthenticated()) {
      window.location.href = '/chat.html';
    }
  },

  async login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (res.success && res.data) {
      api.setToken(res.data.token);
      this.setUser(res.data.user);
      return res.data.user;
    }
    throw new Error(res.message || 'Login failed');
  },

  async register(formData) {
    const res = await api.upload('/auth/register', formData);
    if (res.success && res.data) {
      api.setToken(res.data.token);
      this.setUser(res.data.user);
      return res.data.user;
    }
    throw new Error(res.message || 'Registration failed');
  },

  async logout() {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
      // Ignore logout network error
    } finally {
      api.clearAuth();
      window.location.href = '/login.html';
    }
  }
};
