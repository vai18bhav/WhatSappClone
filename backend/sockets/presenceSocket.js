// backend/sockets/presenceSocket.js
// Online presence and last seen handling
'use strict';

const { pool } = require('../config/db');

function registerPresenceEvents(io, socket, onlineUsers) {
  const userId = socket.userId;

  // Query online status for an array of user IDs
  socket.on('get_online_status', async (userIds, callback) => {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        if (typeof callback === 'function') callback({});
        return;
      }

      const statusMap = {};
      userIds.forEach(id => {
        statusMap[id] = {
          is_online: onlineUsers.has(id),
          last_seen: null
        };
      });

      // Also get last_seen from DB for offline ones
      const offlineIds = userIds.filter(id => !onlineUsers.has(id));
      if (offlineIds.length > 0) {
        const placeholders = offlineIds.map(() => '?').join(',');
        const [rows] = await pool.execute(
          `SELECT id, last_seen, privacy_last_seen FROM users WHERE id IN (${placeholders})`,
          offlineIds
        );
        rows.forEach(r => {
          if (statusMap[r.id]) {
            statusMap[r.id].last_seen = r.privacy_last_seen === 'nobody' ? null : r.last_seen;
          }
        });
      }

      if (typeof callback === 'function') callback(statusMap);
    } catch (err) {
      console.error('[PresenceSocket] Error fetching status:', err.message);
      if (typeof callback === 'function') callback({});
    }
  });
}

module.exports = { registerPresenceEvents };
