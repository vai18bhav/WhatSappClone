// backend/controllers/userController.js
// User search, profile management, contacts, blocking
'use strict';

const { pool }  = require('../config/db');
const { sanitizeUser, buildResponse, paginationParams, getFileUrl } = require('../utils/helpers');

// ─── Search / List Users ─────────────────────────────────────────────────────
async function searchUsers(req, res, next) {
  try {
    const { q = '' } = req.query;
    const { limit, offset } = paginationParams(req.query);
    const currentUserId = req.user.id;

    const searchTerm = `%${q.trim()}%`;

    // Exclude current user and users who blocked the requester (or are blocked by requester)
    const [rows] = await pool.execute(
      `SELECT u.id, u.display_name, u.email, u.avatar, u.bio, u.is_online, u.last_seen,
              u.privacy_last_seen, u.privacy_profile_photo, u.privacy_about
       FROM users u
       WHERE u.id != ?
         AND u.is_active = TRUE
         AND (u.display_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
         AND u.id NOT IN (
           SELECT blocked_id  FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id  FROM blocked_users WHERE blocked_id = ?
         )
       ORDER BY u.display_name ASC
       LIMIT ? OFFSET ?`,
      [currentUserId, searchTerm, searchTerm, searchTerm, currentUserId, currentUserId, limit, offset]
    );

    // Apply privacy settings — hide last_seen if privacy is 'nobody'
    const users = rows.map(u => {
      if (u.privacy_last_seen === 'nobody') u.last_seen = null;
      if (u.privacy_profile_photo === 'nobody') u.avatar = null;
      if (u.privacy_about === 'nobody') u.bio = null;
      // Don't expose privacy fields themselves
      const { privacy_last_seen, privacy_profile_photo, privacy_about, ...safe } = u;
      return safe;
    });

    return res.json(buildResponse(true, 'OK', users));
  } catch (err) {
    next(err);
  }
}

// ─── Get User By ID (public profile) ─────────────────────────────────────────
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT id, display_name, avatar, bio, is_online, last_seen,
              privacy_last_seen, privacy_profile_photo, privacy_about
       FROM users WHERE id = ? AND is_active = TRUE`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json(buildResponse(false, 'User not found'));
    }
    const u = rows[0];
    if (u.privacy_last_seen    === 'nobody') u.last_seen = null;
    if (u.privacy_profile_photo === 'nobody') u.avatar   = null;
    if (u.privacy_about         === 'nobody') u.bio      = null;
    const { privacy_last_seen, privacy_profile_photo, privacy_about, ...safe } = u;
    return res.json(buildResponse(true, 'OK', safe));
  } catch (err) {
    next(err);
  }
}

// ─── Update Profile ───────────────────────────────────────────────────────────
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      display_name, bio, phone,
      privacy_last_seen, privacy_profile_photo, privacy_about,
    } = req.body;

    // Build update fields dynamically
    const fields = [];
    const values = [];

    if (display_name !== undefined)        { fields.push('display_name = ?');         values.push(display_name); }
    if (bio !== undefined)                 { fields.push('bio = ?');                  values.push(bio || null); }
    if (phone !== undefined)               { fields.push('phone = ?');                values.push(phone || null); }
    if (privacy_last_seen !== undefined)   { fields.push('privacy_last_seen = ?');    values.push(privacy_last_seen); }
    if (privacy_profile_photo !== undefined){ fields.push('privacy_profile_photo = ?'); values.push(privacy_profile_photo); }
    if (privacy_about !== undefined)       { fields.push('privacy_about = ?');        values.push(privacy_about); }

    // Avatar upload
    if (req.file) {
      fields.push('avatar = ?');
      values.push(`images/${req.file.filename}`);
    }

    if (fields.length === 0) {
      return res.status(400).json(buildResponse(false, 'No fields to update'));
    }

    values.push(userId);
    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
    return res.json(buildResponse(true, 'Profile updated', sanitizeUser(rows[0])));
  } catch (err) {
    next(err);
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────────
async function getContacts(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.display_name, u.avatar, u.is_online, u.last_seen, c.nickname, c.created_at
       FROM contacts c
       JOIN users u ON u.id = c.contact_id
       WHERE c.user_id = ?
       ORDER BY u.display_name ASC`,
      [req.user.id]
    );
    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

async function addContact(req, res, next) {
  try {
    const { contact_id, nickname } = req.body;
    if (!contact_id) return res.status(400).json(buildResponse(false, 'contact_id required'));
    if (contact_id === req.user.id) return res.status(400).json(buildResponse(false, 'Cannot add yourself'));

    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [contact_id]);
    if (existing.length === 0) return res.status(404).json(buildResponse(false, 'User not found'));

    await pool.execute(
      'INSERT IGNORE INTO contacts (user_id, contact_id, nickname) VALUES (?, ?, ?)',
      [req.user.id, contact_id, nickname || null]
    );
    return res.status(201).json(buildResponse(true, 'Contact added'));
  } catch (err) {
    next(err);
  }
}

async function removeContact(req, res, next) {
  try {
    await pool.execute(
      'DELETE FROM contacts WHERE user_id = ? AND contact_id = ?',
      [req.user.id, req.params.id]
    );
    return res.json(buildResponse(true, 'Contact removed'));
  } catch (err) {
    next(err);
  }
}

// ─── Blocking ─────────────────────────────────────────────────────────────────
async function blockUser(req, res, next) {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json(buildResponse(false, 'user_id required'));
    await pool.execute(
      'INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)',
      [req.user.id, user_id]
    );
    return res.json(buildResponse(true, 'User blocked'));
  } catch (err) {
    next(err);
  }
}

async function unblockUser(req, res, next) {
  try {
    await pool.execute(
      'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?',
      [req.user.id, req.params.id]
    );
    return res.json(buildResponse(true, 'User unblocked'));
  } catch (err) {
    next(err);
  }
}

async function getBlockedUsers(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.display_name, u.avatar, b.created_at AS blocked_at
       FROM blocked_users b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ?`,
      [req.user.id]
    );
    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchUsers,
  getUserById,
  updateProfile,
  getContacts,
  addContact,
  removeContact,
  blockUser,
  unblockUser,
  getBlockedUsers,
};
