// backend/controllers/chatController.js
// Chat creation and listing for direct and group conversations
'use strict';

const { pool }       = require('../config/db');
const { generateId, buildResponse } = require('../utils/helpers');

// ─── Get All Chats for Current User ──────────────────────────────────────────
async function getChats(req, res, next) {
  try {
    const userId = req.user.id;

    // For each chat the user is a member of, get the other member info (direct)
    // or group info, plus the latest message and unread count
    const [rows] = await pool.execute(
      `SELECT
         c.id            AS chat_id,
         c.type,
         c.updated_at,
         cm.is_archived,
         cm.is_muted,
         cm.last_read_at,

         -- Last message
         m.id            AS last_msg_id,
         m.content       AS last_msg_content,
         m.type          AS last_msg_type,
         m.created_at    AS last_msg_time,
         m.sender_id     AS last_msg_sender_id,
         sender.display_name AS last_msg_sender_name,

         -- Unread count
         (
           SELECT COUNT(*)
           FROM messages unread
           WHERE unread.chat_id = c.id
             AND unread.created_at > cm.last_read_at
             AND unread.sender_id != ?
             AND unread.is_deleted_for_all = FALSE
             AND unread.id NOT IN (
               SELECT message_id FROM message_deletions WHERE user_id = ?
             )
         ) AS unread_count,

         -- For direct chats: the OTHER user
         other_user.id            AS other_user_id,
         other_user.display_name  AS other_user_name,
         other_user.avatar        AS other_user_avatar,
         other_user.is_online     AS other_user_online,
         other_user.last_seen     AS other_user_last_seen,

         -- For group chats
         g.id            AS group_id,
         g.name          AS group_name,
         g.avatar        AS group_avatar,
         g.description   AS group_description

       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = ?

       -- Latest message (left join in case no messages yet)
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages
         WHERE chat_id = c.id AND is_deleted_for_all = FALSE
         ORDER BY created_at DESC LIMIT 1
       )
       LEFT JOIN users sender ON sender.id = m.sender_id

       -- Direct chat other user
       LEFT JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id != ? AND c.type = 'direct'
       LEFT JOIN users other_user  ON other_user.id = cm2.user_id

       -- Group info
       LEFT JOIN \`groups\` g ON g.chat_id = c.id

       WHERE cm.is_archived = FALSE
       ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [userId, userId, userId, userId]
    );

    // Shape the response
    const chats = rows.map(row => ({
      id:         row.chat_id,
      type:       row.type,
      updated_at: row.updated_at,
      is_muted:   row.is_muted,
      unread_count: row.unread_count,
      last_message: row.last_msg_id ? {
        id:          row.last_msg_id,
        content:     row.last_msg_content,
        type:        row.last_msg_type,
        created_at:  row.last_msg_time,
        sender_id:   row.last_msg_sender_id,
        sender_name: row.last_msg_sender_name,
      } : null,
      // Direct chat info
      ...(row.type === 'direct' && {
        other_user: {
          id:        row.other_user_id,
          name:      row.other_user_name,
          avatar:    row.other_user_avatar,
          is_online: row.other_user_online,
          last_seen: row.other_user_last_seen,
        },
      }),
      // Group chat info
      ...(row.type === 'group' && {
        group: {
          id:          row.group_id,
          name:        row.group_name,
          avatar:      row.group_avatar,
          description: row.group_description,
        },
      }),
    }));

    return res.json(buildResponse(true, 'OK', chats));
  } catch (err) {
    next(err);
  }
}

// ─── Create / Find Direct Chat ────────────────────────────────────────────────
async function createDirectChat(req, res, next) {
  try {
    const currentUserId = req.user.id;
    const { user_id }   = req.body;

    if (!user_id) return res.status(400).json(buildResponse(false, 'user_id required'));
    if (user_id === currentUserId) return res.status(400).json(buildResponse(false, 'Cannot chat with yourself'));

    // Check the target user exists
    const [userCheck] = await pool.execute('SELECT id FROM users WHERE id = ?', [user_id]);
    if (userCheck.length === 0) return res.status(404).json(buildResponse(false, 'User not found'));

    // Find existing direct chat between these two users
    const [existing] = await pool.execute(
      `SELECT c.id FROM chats c
       JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
       JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
       WHERE c.type = 'direct'
       LIMIT 1`,
      [currentUserId, user_id]
    );

    if (existing.length > 0) {
      return res.json(buildResponse(true, 'OK', { chat_id: existing[0].id, is_new: false }));
    }

    // Create new chat
    const chatId = generateId();
    await pool.execute("INSERT INTO chats (id, type) VALUES (?, 'direct')", [chatId]);
    await pool.execute(
      'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?), (?, ?)',
      [chatId, currentUserId, chatId, user_id]
    );

    return res.status(201).json(buildResponse(true, 'Chat created', { chat_id: chatId, is_new: true }));
  } catch (err) {
    next(err);
  }
}

// ─── Get Chat By ID ───────────────────────────────────────────────────────────
async function getChatById(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify membership
    const [member] = await pool.execute(
      'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [id, userId]
    );
    if (member.length === 0) return res.status(403).json(buildResponse(false, 'Not a member of this chat'));

    const [rows] = await pool.execute(
      `SELECT c.id, c.type, c.created_at, c.updated_at,
              g.name AS group_name, g.avatar AS group_avatar, g.description AS group_description
       FROM chats c
       LEFT JOIN \`groups\` g ON g.chat_id = c.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json(buildResponse(false, 'Chat not found'));

    // Get members
    const [members] = await pool.execute(
      `SELECT u.id, u.display_name, u.avatar, u.is_online, u.last_seen, cm.role
       FROM chat_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = ?`,
      [id]
    );

    return res.json(buildResponse(true, 'OK', { ...rows[0], members }));
  } catch (err) {
    next(err);
  }
}

// ─── Archive / Mute Chat ──────────────────────────────────────────────────────
async function archiveChat(req, res, next) {
  try {
    const { id } = req.params;
    const { is_archived } = req.body;
    await pool.execute(
      'UPDATE chat_members SET is_archived = ? WHERE chat_id = ? AND user_id = ?',
      [!!is_archived, id, req.user.id]
    );
    return res.json(buildResponse(true, is_archived ? 'Chat archived' : 'Chat unarchived'));
  } catch (err) {
    next(err);
  }
}

async function muteChat(req, res, next) {
  try {
    const { id } = req.params;
    const { is_muted } = req.body;
    await pool.execute(
      'UPDATE chat_members SET is_muted = ? WHERE chat_id = ? AND user_id = ?',
      [!!is_muted, id, req.user.id]
    );
    return res.json(buildResponse(true, is_muted ? 'Chat muted' : 'Chat unmuted'));
  } catch (err) {
    next(err);
  }
}

module.exports = { getChats, createDirectChat, getChatById, archiveChat, muteChat };
