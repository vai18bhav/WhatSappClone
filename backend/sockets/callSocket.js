// backend/sockets/callSocket.js
// WebRTC signaling for audio and video calls
'use strict';

const { pool } = require('../config/db');
const { generateId } = require('../utils/helpers');

function registerCallEvents(io, socket, onlineUsers) {
  const userId = socket.userId;

  // ─── Call Offer (Initiate Call) ─────────────────────────────────────────────
  socket.on('call_offer', async (data) => {
    try {
      const { calleeId, chatId, type, sdpOffer } = data;
      if (!calleeId || !sdpOffer) return;

      const callId = generateId();

      // Store in database
      await pool.execute(
        `INSERT INTO calls (id, chat_id, caller_id, callee_id, type, status)
         VALUES (?, ?, ?, ?, ?, 'ringing')`,
        [callId, chatId, userId, calleeId, type || 'voice']
      );

      // Look up caller details
      const [callerRows] = await pool.execute(
        'SELECT id, display_name, avatar FROM users WHERE id = ?',
        [userId]
      );
      const caller = callerRows[0] || { id: userId, display_name: 'Caller' };

      // Send offer to callee if online
      const calleeSocketId = onlineUsers.get(calleeId);
      if (calleeSocketId) {
        io.to(calleeSocketId).emit('incoming_call', {
          callId,
          chatId,
          caller,
          type: type || 'voice',
          sdpOffer,
        });
      } else {
        // Callee offline
        socket.emit('call_failed', { callId, reason: 'User is offline' });
        await pool.execute(
          "UPDATE calls SET status = 'missed', ended_at = NOW() WHERE id = ?",
          [callId]
        );
      }
    } catch (err) {
      console.error('[CallSocket] call_offer error:', err.message);
    }
  });

  // ─── Call Answer ────────────────────────────────────────────────────────────
  socket.on('call_answer', async (data) => {
    try {
      const { callId, callerId, sdpAnswer } = data;
      if (!callId || !callerId || !sdpAnswer) return;

      await pool.execute(
        "UPDATE calls SET status = 'active', answered_at = NOW() WHERE id = ?",
        [callId]
      );

      const callerSocketId = onlineUsers.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_answered', {
          callId,
          sdpAnswer,
        });
      }
    } catch (err) {
      console.error('[CallSocket] call_answer error:', err.message);
    }
  });

  // ─── ICE Candidate Exchange ─────────────────────────────────────────────────
  socket.on('ice_candidate', (data) => {
    try {
      const { targetId, candidate, callId } = data;
      if (!targetId || !candidate) return;

      const targetSocketId = onlineUsers.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice_candidate', {
          callId,
          candidate,
          fromId: userId,
        });
      }
    } catch (err) {
      console.error('[CallSocket] ice_candidate error:', err.message);
    }
  });

  // ─── Call Reject ────────────────────────────────────────────────────────────
  socket.on('call_reject', async (data) => {
    try {
      const { callId, callerId } = data;
      if (callId) {
        await pool.execute(
          "UPDATE calls SET status = 'rejected', ended_at = NOW() WHERE id = ?",
          [callId]
        );
      }

      if (callerId) {
        const callerSocketId = onlineUsers.get(callerId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_rejected', { callId });
        }
      }
    } catch (err) {
      console.error('[CallSocket] call_reject error:', err.message);
    }
  });

  // ─── Call End ───────────────────────────────────────────────────────────────
  socket.on('call_end', async (data) => {
    try {
      const { callId, targetId, durationSeconds } = data;

      if (callId) {
        await pool.execute(
          "UPDATE calls SET status = 'ended', ended_at = NOW(), duration_seconds = ? WHERE id = ?",
          [parseInt(durationSeconds) || 0, callId]
        );
      }

      if (targetId) {
        const targetSocketId = onlineUsers.get(targetId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('call_ended', { callId });
        }
      }
    } catch (err) {
      console.error('[CallSocket] call_end error:', err.message);
    }
  });
}

module.exports = { registerCallEvents };
