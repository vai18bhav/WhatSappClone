// backend/controllers/messageController.js
// Message CRUD, reactions, starring, search
'use strict';

const { pool }       = require('../config/db');
const { generateId, buildResponse, paginationParams } = require('../utils/helpers');

// ─── Helper: verify user is a chat member ────────────────────────────────────
async function assertMember(chatId, userId) {
  const [rows] = await pool.execute(
    'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?',
    [chatId, userId]
  );
  return rows.length > 0;
}

// ─── Get Messages ─────────────────────────────────────────────────────────────
async function getMessages(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { limit, offset } = paginationParams(req.query);

    if (!(await assertMember(chatId, userId))) {
      return res.status(403).json(buildResponse(false, 'Not a member of this chat'));
    }

    const [rows] = await pool.execute(
      `SELECT
         m.id, m.chat_id, m.sender_id, m.type, m.content,
         m.reply_to_id, m.is_edited, m.is_deleted_for_all,
         m.created_at, m.updated_at,
         -- Sender info
         u.display_name AS sender_name,
         u.avatar       AS sender_avatar,
         -- Reply-to message preview
         rm.content     AS reply_content,
         rm.type        AS reply_type,
         ru.display_name AS reply_sender_name,
         -- Media
         med.id            AS media_id,
         med.file_name     AS media_file_name,
         med.original_name AS media_original_name,
         med.file_type     AS media_file_type,
         med.file_size     AS media_file_size,
         med.file_path     AS media_file_path,
         med.duration_seconds AS media_duration,
         -- Read status (for sender: how many have read it)
         (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id != ?) AS read_count,
         -- Is starred by current user
         (SELECT COUNT(*) FROM starred_messages sm WHERE sm.message_id = m.id AND sm.user_id = ?) AS is_starred
       FROM messages m
       JOIN users u   ON u.id = m.sender_id
       LEFT JOIN messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users   ru ON ru.id = rm.sender_id
       LEFT JOIN media  med ON med.message_id = m.id
       WHERE m.chat_id = ?
         AND m.is_deleted_for_all = FALSE
         AND m.id NOT IN (
           SELECT message_id FROM message_deletions WHERE user_id = ?
         )
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [userId, userId, chatId, userId, limit, offset]
    );

    // Shape messages
    const messages = rows.map(r => ({
      id:                 r.id,
      chat_id:            r.chat_id,
      sender_id:          r.sender_id,
      sender_name:        r.sender_name,
      sender_avatar:      r.sender_avatar,
      type:               r.type,
      content:            r.is_deleted_for_all ? null : r.content,
      is_edited:          r.is_edited,
      is_deleted_for_all: r.is_deleted_for_all,
      created_at:         r.created_at,
      updated_at:         r.updated_at,
      is_starred:         r.is_starred > 0,
      read_count:         r.read_count,
      reply_to: r.reply_to_id ? {
        id:          r.reply_to_id,
        content:     r.reply_content,
        type:        r.reply_type,
        sender_name: r.reply_sender_name,
      } : null,
      media: r.media_id ? {
        id:            r.media_id,
        file_name:     r.media_file_name,
        original_name: r.media_original_name,
        file_type:     r.media_file_type,
        file_size:     r.media_file_size,
        file_path:     r.media_file_path,
        url:           `/uploads/${r.media_file_path}`,
        duration:      r.media_duration,
      } : null,
    }));

    // Update last_read_at
    await pool.execute(
      'UPDATE chat_members SET last_read_at = NOW() WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    return res.json(buildResponse(true, 'OK', messages, { limit, offset }));
  } catch (err) {
    next(err);
  }
}

// ─── Create Message ───────────────────────────────────────────────────────────
async function createMessage(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    if (!(await assertMember(chatId, userId))) {
      return res.status(403).json(buildResponse(false, 'Not a member of this chat'));
    }

    const { type = 'text', content, reply_to_id, media_id } = req.body;

    if (type === 'text' && !content?.trim()) {
      return res.status(400).json(buildResponse(false, 'Content is required for text messages'));
    }

    const msgId = generateId();

    await pool.execute(
      `INSERT INTO messages (id, chat_id, sender_id, type, content, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [msgId, chatId, userId, type, content || null, reply_to_id || null]
    );

    // Link media if provided
    if (media_id) {
      await pool.execute(
        'UPDATE media SET message_id = ? WHERE id = ? AND uploader_id = ?',
        [msgId, media_id, userId]
      );
    }

    // Update chat timestamp
    await pool.execute('UPDATE chats SET updated_at = NOW() WHERE id = ?', [chatId]);

    // Return full message
    const [rows] = await pool.execute(
      `SELECT m.*, u.display_name AS sender_name, u.avatar AS sender_avatar,
              med.id AS media_id, med.file_path, med.file_type, med.file_size, med.original_name, med.duration_seconds
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN media med ON med.message_id = m.id
       WHERE m.id = ?`,
      [msgId]
    );

    return res.status(201).json(buildResponse(true, 'Message sent', rows[0]));
  } catch (err) {
    next(err);
  }
}

// ─── Edit Message ─────────────────────────────────────────────────────────────
async function editMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json(buildResponse(false, 'Content required'));

    const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json(buildResponse(false, 'Message not found'));
    if (rows[0].sender_id !== req.user.id) return res.status(403).json(buildResponse(false, 'Not your message'));
    if (rows[0].type !== 'text') return res.status(400).json(buildResponse(false, 'Only text messages can be edited'));

    await pool.execute(
      'UPDATE messages SET content = ?, is_edited = TRUE WHERE id = ?',
      [content.trim(), id]
    );

    return res.json(buildResponse(true, 'Message edited', { id, content: content.trim(), is_edited: true }));
  } catch (err) {
    next(err);
  }
}

// ─── Delete Message ───────────────────────────────────────────────────────────
async function deleteMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { delete_type = 'for_me' } = req.body; // 'for_me' | 'for_everyone'
    const userId = req.user.id;

    const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json(buildResponse(false, 'Message not found'));

    if (delete_type === 'for_everyone') {
      if (rows[0].sender_id !== userId) {
        return res.status(403).json(buildResponse(false, 'Only the sender can delete for everyone'));
      }
      await pool.execute(
        'UPDATE messages SET is_deleted_for_all = TRUE, content = NULL WHERE id = ?', [id]
      );
    } else {
      // delete for me only
      await pool.execute(
        'INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)',
        [id, userId]
      );
    }

    return res.json(buildResponse(true, 'Message deleted', { id, delete_type }));
  } catch (err) {
    next(err);
  }
}

// ─── Reactions ────────────────────────────────────────────────────────────────
async function addReaction(req, res, next) {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json(buildResponse(false, 'Emoji required'));

    await pool.execute(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE emoji = ?',
      [id, req.user.id, emoji, emoji]
    );
    return res.json(buildResponse(true, 'Reaction added'));
  } catch (err) {
    next(err);
  }
}

async function removeReaction(req, res, next) {
  try {
    await pool.execute(
      'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return res.json(buildResponse(true, 'Reaction removed'));
  } catch (err) {
    next(err);
  }
}

// ─── Starring ─────────────────────────────────────────────────────────────────
async function starMessage(req, res, next) {
  try {
    await pool.execute(
      'INSERT IGNORE INTO starred_messages (message_id, user_id) VALUES (?, ?)',
      [req.params.id, req.user.id]
    );
    return res.json(buildResponse(true, 'Message starred'));
  } catch (err) {
    next(err);
  }
}

async function unstarMessage(req, res, next) {
  try {
    await pool.execute(
      'DELETE FROM starred_messages WHERE message_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return res.json(buildResponse(true, 'Message unstarred'));
  } catch (err) {
    next(err);
  }
}

// ─── Search Messages ──────────────────────────────────────────────────────────
async function searchMessages(req, res, next) {
  try {
    const { chatId } = req.params;
    const { q = '' } = req.query;
    const userId = req.user.id;

    if (!(await assertMember(chatId, userId))) {
      return res.status(403).json(buildResponse(false, 'Not a member'));
    }

    if (!q.trim()) return res.json(buildResponse(true, 'OK', []));

    const [rows] = await pool.execute(
      `SELECT m.id, m.content, m.type, m.created_at,
              u.display_name AS sender_name, u.avatar AS sender_avatar
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.chat_id = ?
         AND m.type = 'text'
         AND m.is_deleted_for_all = FALSE
         AND LOWER(m.content) LIKE LOWER(?)
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [chatId, `%${q.trim()}%`]
    );

    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMessages,
  createMessage,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  starMessage,
  unstarMessage,
  searchMessages,
};
