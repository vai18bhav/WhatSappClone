// backend/services/notificationService.js
// Create and manage notifications for users
'use strict';

const { pool }      = require('../config/db');
const { generateId } = require('../utils/helpers');

/**
 * Create a new notification record in the database.
 * @param {string} userId  - Recipient user ID
 * @param {string} type    - 'message' | 'group_invite' | 'call' | 'system'
 * @param {string} title   - Short title
 * @param {string} [body]  - Longer body text
 * @param {string} [refType] - Referenced entity type ('chat','group','call')
 * @param {string} [refId]   - Referenced entity ID
 * @returns {Promise<string>} The new notification ID
 */
async function createNotification(userId, type, title, body = null, refType = null, refId = null) {
  const id = generateId();
  await pool.execute(
    `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, type, title, body, refType, refId]
  );
  return id;
}

/**
 * Get the unread notification count for a user.
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );
  return rows[0].cnt;
}

/**
 * Mark one notification as read.
 * @param {string} notificationId
 * @param {string} userId - Ownership check
 */
async function markRead(notificationId, userId) {
  await pool.execute(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [notificationId, userId]
  );
}

/**
 * Mark all notifications for a user as read.
 * @param {string} userId
 */
async function markAllRead(userId) {
  await pool.execute(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
    [userId]
  );
}

module.exports = {
  createNotification,
  getUnreadCount,
  markRead,
  markAllRead,
};
