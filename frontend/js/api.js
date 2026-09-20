// frontend/js/api.js
// REST API client wrapper with JWT header injection & error handling
'use strict';

const API_BASE = '/api';

const api = {
  getToken() {
    return localStorage.getItem('chatflow_token');
  },

  setToken(token) {
    localStorage.setItem('chatflow_token', token);
  },

  clearAuth() {
    localStorage.removeItem('chatflow_token');
    localStorage.removeItem('chatflow_user');
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (response.status === 401 && !endpoint.startsWith('/auth/login') && !endpoint.startsWith('/auth/register')) {
        this.clearAuth();
        window.location.href = '/login.html';
        throw new Error('Session expired. Please log in again.');
      }

      const contentType = response.headers.get('content-type') || '';
      let json;
      if (contentType.includes('application/json')) {
        json = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server response error (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(json.message || `Request failed with status ${response.status}`);
      }

      return json;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err.message);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  delete(endpoint, body) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
    });
  }
};
