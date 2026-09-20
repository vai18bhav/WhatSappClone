// frontend/js/search.js
// Global search for chats & users, plus in-conversation message search
'use strict';

const searchService = {
  debounceTimer: null,

  debounce(func, delay = 300) {
    return (...args) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => func(...args), delay);
    };
  },

  async searchUsers(query) {
    if (!query || query.trim().length === 0) return [];
    try {
      const res = await api.get(`/users?q=${encodeURIComponent(query.trim())}`);
      return res.data || [];
    } catch (err) {
      console.error('Error searching users:', err);
      return [];
    }
  },

  async searchInChat(chatId, query) {
    if (!query || query.trim().length === 0) return [];
    try {
      const res = await api.get(`/messages/chats/${chatId}/messages/search?q=${encodeURIComponent(query.trim())}`);
      return res.data || [];
    } catch (err) {
      console.error('Error searching messages:', err);
      return [];
    }
  }
};
