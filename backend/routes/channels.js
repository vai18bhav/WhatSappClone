// backend/routes/channels.js
// Channels and Broadcast Communities routes
'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

router.use(authenticate);

// ─── CREATE CHANNEL ────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }

    const channelId = uuidv4();
    const chatId    = uuidv4();

    await pool.query('INSERT INTO chats (id, type) VALUES (?, ?)', [chatId, 'group']);

    await pool.query(
      'INSERT INTO `groups` (id, chat_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [channelId, chatId, `📢 ${name}`, description || 'Broadcast Channel', req.user.id]
    );

    await pool.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [channelId, req.user.id, 'admin']
    );

    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
      [chatId, req.user.id, 'admin']
    );

    res.status(201).json({
      success: true,
      message: 'Broadcast channel created successfully',
      channel: { id: channelId, chatId, name: `📢 ${name}`, description }
    });
  } catch (err) {
    next(err);
  }
});

// ─── LIST BROADCAST CHANNELS ───────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT g.id, g.chat_id, g.name, g.description, g.avatar, g.created_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS subscriber_count
       FROM \`groups\` g
       WHERE g.name LIKE '📢 %'
       ORDER BY g.created_at DESC`
    );

    res.json({ success: true, channels: rows });
  } catch (err) {
    next(err);
  }
});

// ─── SUBSCRIBE TO CHANNEL ──────────────────────────────────────────────────
router.post('/:id/subscribe', async (req, res, next) => {
  try {
    const channelId = req.params.id;

    const [channels] = await pool.query('SELECT chat_id FROM `groups` WHERE id = ?', [channelId]);
    if (channels.length === 0) {
      return res.status(404).json({ success: false, message: 'Channel not found' });
    }

    const chatId = channels[0].chat_id;

    await pool.query(
      'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [channelId, req.user.id, 'member']
    );

    await pool.query(
      'INSERT IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
      [chatId, req.user.id, 'member']
    );

    res.json({ success: true, message: 'Subscribed to channel successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
