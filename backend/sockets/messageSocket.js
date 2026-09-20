// backend/sockets/messageSocket.js
// Real-time message exchange, typing indicators, read receipts
'use strict';

const { pool } = require('../config/db');
const { generateId } = require('../utils/helpers');
const { createNotification } = require('../services/notificationService');

function registerMessageEvents(io, socket, onlineUsers) {
  const userId = socket.userId;

  // ─── Join Chat Room ─────────────────────────────────────────────────────────
  socket.on('join_chat', async (chatId) => {
    try {
      if (!chatId) return;
      // Verify membership
      const [members] = await pool.execute(
        'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?',
        [chatId, userId]
      );
      if (members.length > 0) {
        socket.join(`chat_${chatId}`);
      }
    } catch (err) {
      console.error('[MessageSocket] join_chat error:', err.message);
    }
  });

  // ─── Leave Chat Room ────────────────────────────────────────────────────────
  socket.on('leave_chat', (chatId) => {
    if (chatId) socket.leave(`chat_${chatId}`);
  });

  // ─── Send Message ───────────────────────────────────────────────────────────
  socket.on('send_message', async (data, ack) => {
    try {
      const { chatId, type = 'text', content, reply_to_id, media_id } = data;

      if (!chatId) {
        if (typeof ack === 'function') ack({ success: false, message: 'Chat ID required' });
        return;
      }

      if (type === 'location') {
        let location;
        try { location = JSON.parse(content || '{}'); } catch (error) { location = null; }
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude)) ||
            Number(location.latitude) < -90 || Number(location.latitude) > 90 ||
            Number(location.longitude) < -180 || Number(location.longitude) > 180) {
          if (typeof ack === 'function') ack({ success: false, message: 'Invalid location' });
          return;
        }
      }

      // Check membership
      const [members] = await pool.execute(
        'SELECT user_id FROM chat_members WHERE chat_id = ?',
        [chatId]
      );
      const isMember = members.some(m => m.user_id === userId);
      if (!isMember) {
        if (typeof ack === 'function') ack({ success: false, message: 'Not a member of this chat' });
        return;
      }

      const msgId = generateId();

      await pool.execute(
        `INSERT INTO messages (id, chat_id, sender_id, type, content, reply_to_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [msgId, chatId, userId, type, content || null, reply_to_id || null]
      );

      if (media_id) {
        await pool.execute(
          'UPDATE media SET message_id = ? WHERE id = ?',
          [msgId, media_id]
        );
      }

      // Update chat's updated_at
      await pool.execute('UPDATE chats SET updated_at = NOW() WHERE id = ?', [chatId]);

      // Fetch full message with sender & media info
      const [rows] = await pool.execute(
        `SELECT m.*,
                u.display_name AS sender_name, u.avatar AS sender_avatar,
                rm.content AS reply_content, rm.type AS reply_type, ru.display_name AS reply_sender_name,
                med.id AS media_id, med.file_name, med.original_name, med.file_type,
                med.file_size, med.file_path, med.duration_seconds
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         LEFT JOIN messages rm ON rm.id = m.reply_to_id
         LEFT JOIN users ru ON ru.id = rm.sender_id
         LEFT JOIN media med ON med.message_id = m.id
         WHERE m.id = ?`,
        [msgId]
      );

      const message = rows[0];
      const payload = {
        id: message.id,
        chat_id: message.chat_id,
        sender_id: message.sender_id,
        sender_name: message.sender_name,
        sender_avatar: message.sender_avatar,
        type: message.type,
        content: message.content,
        reply_to_id: message.reply_to_id,
        reply_to: message.reply_to_id ? {
          id: message.reply_to_id,
          content: message.reply_content,
          type: message.reply_type,
          sender_name: message.reply_sender_name,
        } : null,
        media: message.media_id ? {
          id: message.media_id,
          file_name: message.file_name,
          original_name: message.original_name,
          file_type: message.file_type,
          file_size: message.file_size,
          file_path: message.file_path,
          url: `/uploads/${message.file_path}`,
          duration: message.duration_seconds,
        } : null,
        created_at: message.created_at,
        is_edited: false,
        is_deleted_for_all: false,
        read_count: 0,
      };

      // Broadcast to all active chat sockets (including sender)
      io.to(`chat_${chatId}`).emit('receive_message', payload);

      // Also notify members' personal sockets so their sidebar chat lists update
      members.forEach(m => {
        const socketId = onlineUsers.get(m.user_id);
        if (socketId) {
          io.to(socketId).emit('chat_updated', {
            chatId,
            lastMessage: payload,
          });
        }
      });

      // For offline members or members not looking at this chat, create a notification
      const offlineMembers = members.filter(m => m.user_id !== userId && !onlineUsers.has(m.user_id));
      for (const m of offlineMembers) {
        await createNotification(
          m.user_id,
          'message',
          message.sender_name,
          type === 'text' ? content : `Sent a ${type}`,
          'chat',
          chatId
        );
      }

      if (typeof ack === 'function') ack({ success: true, message: payload });
    } catch (err) {
      console.error('[MessageSocket] send_message error:', err.message);
      if (typeof ack === 'function') ack({ success: false, message: err.message });
    }
  });

  // ─── Typing Indicator ───────────────────────────────────────────────────────
  socket.on('typing_start', (data) => {
    const { chatId } = data;
    if (chatId) {
      socket.to(`chat_${chatId}`).emit('typing', { chatId, userId });
    }
  });

  socket.on('typing_stop', (data) => {
    const { chatId } = data;
    if (chatId) {
      socket.to(`chat_${chatId}`).emit('stop_typing', { chatId, userId });
    }
  });

  // ─── Message Read Receipts ──────────────────────────────────────────────────
  socket.on('message_read', async (data) => {
    try {
      const { chatId, messageIds } = data;
      if (!chatId) return;

      if (Array.isArray(messageIds) && messageIds.length > 0) {
        for (const msgId of messageIds) {
          await pool.execute(
            'INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)',
            [msgId, userId]
          );
        }
      }

      await pool.execute(
        'UPDATE chat_members SET last_read_at = NOW() WHERE chat_id = ? AND user_id = ?',
        [chatId, userId]
      );

      socket.to(`chat_${chatId}`).emit('messages_read_receipt', {
        chatId,
        readBy: userId,
        messageIds,
      });
    } catch (err) {
      console.error('[MessageSocket] message_read error:', err.message);
    }
  });
}

module.exports = { registerMessageEvents };
