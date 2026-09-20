// backend/controllers/notificationController.js
// Notifications management
'use strict';

const { pool } = require('../config/db');
const { buildResponse } = require('../utils/helpers');
const notificationService = require('../services/notificationService');

// ─── Get Notifications ────────────────────────────────────────────────────────
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT id, type, title, body, is_read, ref_type, ref_id, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const unreadCount = await notificationService.getUnreadCount(userId);

    return res.json(buildResponse(true, 'OK', { notifications: rows, unread_count: unreadCount }));
  } catch (err) {
    next(err);
  }
}

// ─── Mark One as Read ─────────────────────────────────────────────────────────
async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    await notificationService.markRead(id, req.user.id);
    return res.json(buildResponse(true, 'Notification marked as read'));
  } catch (err) {
    next(err);
  }
}

// ─── Mark All as Read ─────────────────────────────────────────────────────────
async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllRead(req.user.id);
    return res.json(buildResponse(true, 'All notifications marked as read'));
  } catch (err) {
    next(err);
  }
}

// ─── Delete Notification ──────────────────────────────────────────────────────
async function deleteNotification(req, res, next) {
  try {
    const { id } = req.params;
    await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    return res.json(buildResponse(true, 'Notification deleted'));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
};
