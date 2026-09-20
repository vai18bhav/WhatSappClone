// frontend/js/socket.js
// Socket.IO client singleton wrapper
'use strict';

const socketClient = {
  socket: null,

  connect() {
    const token = api.getToken();
    if (!token) return null;

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const serverUrl = window.CHATFLOW_SERVER_URL || undefined;
    this.socket = io(serverUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to ChatFlow Socket.IO server');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connection error:', err.message);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from socket server:', reason);
    });

    return this.socket;
  },

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  },

  joinChat(chatId) {
    if (this.socket) this.socket.emit('join_chat', chatId);
  },

  leaveChat(chatId) {
    if (this.socket) this.socket.emit('leave_chat', chatId);
  },

  sendMessage(data, callback) {
    if (this.socket) this.socket.emit('send_message', data, callback);
  },

  sendTypingStart(chatId) {
    if (this.socket) this.socket.emit('typing_start', { chatId });
  },

  sendTypingStop(chatId) {
    if (this.socket) this.socket.emit('typing_stop', { chatId });
  },

  sendReadReceipt(chatId, messageIds) {
    if (this.socket) this.socket.emit('message_read', { chatId, messageIds });
  }
};
