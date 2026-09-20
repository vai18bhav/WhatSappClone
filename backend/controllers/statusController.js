// backend/controllers/statusController.js
// Multi-media status updates (Text, Image, Video, Audio) with 24-hour expiry
'use strict';

const path = require('path');
const { pool } = require('../config/db');
const { generateId, buildResponse } = require('../utils/helpers');

async function getStatuses(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.id, s.user_id, COALESCE(s.type, 'text') AS type, s.content, s.media_url, s.background, s.created_at, s.expires_at,
              u.display_name, u.avatar
       FROM statuses s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW() AND u.is_active = TRUE
       ORDER BY s.created_at DESC`,
    );

    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

async function createStatus(req, res, next) {
  try {
    const content = String(req.body.content || '').trim();
    const background = String(req.body.background || '#075E54');
    let type = 'text';
    let mediaUrl = null;

    if (req.file) {
      const mime = req.file.mimetype;
      if (mime.startsWith('image/')) {
        type = 'image';
        mediaUrl = `/uploads/images/${req.file.filename}`;
      } else if (mime.startsWith('video/')) {
        type = 'video';
        mediaUrl = `/uploads/videos/${req.file.filename}`;
      } else if (mime.startsWith('audio/')) {
        type = 'audio';
        mediaUrl = `/uploads/audio/${req.file.filename}`;
      } else {
        type = 'image';
        mediaUrl = `/uploads/images/${req.file.filename}`;
      }
    } else {
      if (!content) {
        return res.status(400).json(buildResponse(false, 'Status content or media file is required'));
      }
    }

    if (content.length > 700) {
      return res.status(400).json(buildResponse(false, 'Status text must be 700 characters or fewer'));
    }
    if (!/^#[0-9a-f]{6}$/i.test(background)) {
      return res.status(400).json(buildResponse(false, 'Invalid status color'));
    }

    const id = generateId();
    await pool.execute(
      `INSERT INTO statuses (id, user_id, type, content, media_url, background, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [id, req.user.id, type, content, mediaUrl, background],
    );

    const [rows] = await pool.execute(
      `SELECT s.id, s.user_id, COALESCE(s.type, 'text') AS type, s.content, s.media_url, s.background, s.created_at, s.expires_at,
              u.display_name, u.avatar
       FROM statuses s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [id],
    );

    const statusData = rows[0];
    const io = req.app.get('io');
    if (io) {
      io.emit('status_updated', { action: 'created', status: statusData });
    }

    return res.status(201).json(buildResponse(true, 'Status posted', statusData));
  } catch (err) {
    next(err);
  }
}

async function deleteStatus(req, res, next) {
  try {
    const [result] = await pool.execute(
      'DELETE FROM statuses WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json(buildResponse(false, 'Status not found'));
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('status_updated', { action: 'deleted', id: req.params.id });
    }

    return res.json(buildResponse(true, 'Status deleted'));
  } catch (err) {
    next(err);
  }
}

module.exports = { getStatuses, createStatus, deleteStatus };
