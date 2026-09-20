// backend/controllers/callController.js
// Voice & Video call history and session records
'use strict';

const { pool } = require('../config/db');
const { generateId, buildResponse } = require('../utils/helpers');

// ─── Initiate Call Record ─────────────────────────────────────────────────────
async function initiateCall(req, res, next) {
  try {
    const callerId = req.user.id;
    const { chat_id, callee_id, type } = req.body;

    if (!chat_id || !type) {
      return res.status(400).json(buildResponse(false, 'chat_id and type (voice/video) are required'));
    }

    const callId = generateId();

    await pool.execute(
      `INSERT INTO calls (id, chat_id, caller_id, callee_id, type, status)
       VALUES (?, ?, ?, ?, ?, 'ringing')`,
      [callId, chat_id, callerId, callee_id || null, type]
    );

    return res.status(201).json(buildResponse(true, 'Call initiated', { call_id: callId }));
  } catch (err) {
    next(err);
  }
}

// ─── Update Call Status ───────────────────────────────────────────────────────
async function updateCallStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, duration_seconds } = req.body;

    if (!status) {
      return res.status(400).json(buildResponse(false, 'Status is required'));
    }

    const fields = ['status = ?'];
    const values = [status];

    if (status === 'active') {
      fields.push('answered_at = NOW()');
    } else if (['ended', 'rejected', 'missed'].includes(status)) {
      fields.push('ended_at = NOW()');
      if (duration_seconds !== undefined) {
        fields.push('duration_seconds = ?');
        values.push(parseInt(duration_seconds) || 0);
      }
    }

    values.push(id);

    await pool.execute(
      `UPDATE calls SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return res.json(buildResponse(true, 'Call status updated'));
  } catch (err) {
    next(err);
  }
}

// ─── Get Call History ─────────────────────────────────────────────────────────
async function getCallHistory(req, res, next) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT c.*,
              caller.display_name AS caller_name, caller.avatar AS caller_avatar,
              callee.display_name AS callee_name, callee.avatar AS callee_avatar
       FROM calls c
       JOIN users caller ON caller.id = c.caller_id
       LEFT JOIN users callee ON callee.id = c.callee_id
       WHERE c.caller_id = ? OR c.callee_id = ?
       ORDER BY c.started_at DESC
       LIMIT 50`,
      [userId, userId]
    );

    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initiateCall,
  updateCallStatus,
  getCallHistory,
};
