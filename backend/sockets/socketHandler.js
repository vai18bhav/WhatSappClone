// backend/sockets/socketHandler.js
// Main Socket.IO coordinator
'use strict';

const { verifyToken } = require('../services/authService');
const { pool } = require('../config/db');
const { registerMessageEvents } = require('./messageSocket');
const { registerPresenceEvents } = require('./presenceSocket');
const { registerCallEvents } = require('./callSocket');

// Map of userId -> socketId
const onlineUsers = new Map();

function socketHandler(io) {
  // Authentication middleware for Socket.IO connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];
      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = verifyToken(token);
      const [rows] = await pool.execute(
        'SELECT id, display_name, avatar FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.id]
      );

      if (rows.length === 0) {
        return next(new Error('User not found or deactivated'));
      }

      socket.userId = rows[0].id;
      socket.userData = rows[0];
      next();
    } catch (err) {
      next(new Error('Authentication failed: ' + err.message));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);

    try {
      // Mark online in database
      await pool.execute('UPDATE users SET is_online = TRUE WHERE id = ?', [userId]);

      // Broadcast user_online to all connections
      socket.broadcast.emit('user_status_change', {
        userId,
        is_online: true,
        last_seen: null,
      });

      // Register sub-event handlers
      registerMessageEvents(io, socket, onlineUsers);
      registerPresenceEvents(io, socket, onlineUsers);
      registerCallEvents(io, socket, onlineUsers);

      // Handle disconnect
      socket.on('disconnect', async () => {
        onlineUsers.delete(userId);
        const now = new Date();
        try {
          await pool.execute(
            'UPDATE users SET is_online = FALSE, last_seen = ? WHERE id = ?',
            [now, userId]
          );

          socket.broadcast.emit('user_status_change', {
            userId,
            is_online: false,
            last_seen: now.toISOString(),
          });
        } catch (dbErr) {
          console.error('[SocketHandler] Disconnect DB error:', dbErr.message);
        }
      });
    } catch (err) {
      console.error('[SocketHandler] Connection setup error:', err.message);
    }
  });
}

module.exports = { socketHandler, onlineUsers };
