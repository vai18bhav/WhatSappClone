// backend/controllers/groupController.js
// Group creation and management
'use strict';

const { pool }       = require('../config/db');
const { generateId, buildResponse } = require('../utils/helpers');

// ─── Create Group ─────────────────────────────────────────────────────────────
async function createGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, description, members = [] } = req.body;

    // Create the underlying chat
    const chatId  = generateId();
    const groupId = generateId();

    await pool.execute("INSERT INTO chats (id, type) VALUES (?, 'group')", [chatId]);

    // Avatar
    let avatarPath = null;
    if (req.file) avatarPath = `images/${req.file.filename}`;

    await pool.execute(
      'INSERT INTO `groups` (id, chat_id, name, description, avatar, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [groupId, chatId, name, description || null, avatarPath, userId]
    );

    // Add creator as owner
    await pool.execute(
      "INSERT INTO chat_members  (chat_id, user_id, role) VALUES (?, ?, 'owner')",
      [chatId, userId]
    );
    await pool.execute(
      "INSERT INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'admin', ?)",
      [groupId, userId, userId]
    );

    // Add other members (validate they exist first)
    const memberIds = [...new Set(members)].filter(id => id !== userId);
    for (const memberId of memberIds) {
      const [u] = await pool.execute('SELECT id FROM users WHERE id = ?', [memberId]);
      if (u.length > 0) {
        await pool.execute(
          "INSERT IGNORE INTO chat_members  (chat_id, user_id, role) VALUES (?, ?, 'member')",
          [chatId, memberId]
        );
        await pool.execute(
          "INSERT IGNORE INTO group_members (group_id, user_id, role, added_by) VALUES (?, ?, 'member', ?)",
          [groupId, memberId, userId]
        );
      }
    }

    return res.status(201).json(buildResponse(true, 'Group created', { group_id: groupId, chat_id: chatId }));
  } catch (err) {
    next(err);
  }
}

// ─── Get Group ────────────────────────────────────────────────────────────────
async function getGroup(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `SELECT g.*, c.id AS chat_id, c.created_at AS chat_created_at
       FROM \`groups\` g
       JOIN chats c ON c.id = g.chat_id
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = ?
       WHERE g.id = ?`,
      [userId, id]
    );

    if (rows.length === 0) return res.status(404).json(buildResponse(false, 'Group not found or not a member'));

    const [members] = await pool.execute(
      `SELECT u.id, u.display_name, u.avatar, u.is_online, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY FIELD(gm.role,'admin','member'), u.display_name ASC`,
      [id]
    );

    return res.json(buildResponse(true, 'OK', { ...rows[0], members }));
  } catch (err) {
    next(err);
  }
}

// ─── Update Group ─────────────────────────────────────────────────────────────
async function updateGroup(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check admin/owner
    const [role] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]
    );
    if (role.length === 0 || role[0].role === 'member') {
      return res.status(403).json(buildResponse(false, 'Admin permission required'));
    }

    const { name, description } = req.body;
    const fields = [];
    const values = [];
    if (name)        { fields.push('name = ?');        values.push(name); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (req.file)    { fields.push('avatar = ?');       values.push(`images/${req.file.filename}`); }

    if (fields.length === 0) return res.status(400).json(buildResponse(false, 'Nothing to update'));

    values.push(id);
    await pool.execute(`UPDATE \`groups\` SET ${fields.join(', ')} WHERE id = ?`, values);

    return res.json(buildResponse(true, 'Group updated'));
  } catch (err) {
    next(err);
  }
}

// ─── Delete Group ─────────────────────────────────────────────────────────────
async function deleteGroup(req, res, next) {
  try {
    const { id } = req.params;
    const [role] = await pool.execute(
      "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?", [id, req.user.id]
    );
    if (role.length === 0 || role[0].role !== 'admin') {
      return res.status(403).json(buildResponse(false, 'Only admins can delete the group'));
    }
    // Cascade deletes chats, messages, members
    const [g] = await pool.execute('SELECT chat_id FROM `groups` WHERE id = ?', [id]);
    if (g.length > 0) await pool.execute('DELETE FROM chats WHERE id = ?', [g[0].chat_id]);
    return res.json(buildResponse(true, 'Group deleted'));
  } catch (err) {
    next(err);
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────
async function getGroupMembers(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.display_name, u.avatar, u.is_online, gm.role, gm.joined_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?`,
      [req.params.id]
    );
    return res.json(buildResponse(true, 'OK', rows));
  } catch (err) {
    next(err);
  }
}

async function addMembers(req, res, next) {
  try {
    const { id } = req.params;
    const { members = [] } = req.body;
    const userId = req.user.id;

    const [role] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]
    );
    if (role.length === 0 || role[0].role === 'member') {
      return res.status(403).json(buildResponse(false, 'Admin permission required'));
    }

    const [g] = await pool.execute('SELECT chat_id FROM `groups` WHERE id = ?', [id]);
    if (g.length === 0) return res.status(404).json(buildResponse(false, 'Group not found'));
    const chatId = g[0].chat_id;

    for (const memberId of members) {
      const [u] = await pool.execute('SELECT id FROM users WHERE id = ?', [memberId]);
      if (u.length > 0) {
        await pool.execute(
          "INSERT IGNORE INTO chat_members  (chat_id, user_id) VALUES (?, ?)", [chatId, memberId]
        );
        await pool.execute(
          "INSERT IGNORE INTO group_members (group_id, user_id, added_by) VALUES (?, ?, ?)",
          [id, memberId, userId]
        );
      }
    }

    return res.json(buildResponse(true, 'Members added'));
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { id, userId: targetId } = req.params;
    const requesterId = req.user.id;

    const [role] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, requesterId]
    );
    if (role.length === 0 || role[0].role === 'member') {
      return res.status(403).json(buildResponse(false, 'Admin permission required'));
    }

    const [g] = await pool.execute('SELECT chat_id FROM `groups` WHERE id = ?', [id]);
    if (g.length === 0) return res.status(404).json(buildResponse(false, 'Group not found'));

    await pool.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [id, targetId]);
    await pool.execute('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', [g[0].chat_id, targetId]);

    return res.json(buildResponse(true, 'Member removed'));
  } catch (err) {
    next(err);
  }
}

async function leaveGroup(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [g] = await pool.execute('SELECT chat_id FROM `groups` WHERE id = ?', [id]);
    if (g.length === 0) return res.status(404).json(buildResponse(false, 'Group not found'));

    await pool.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
    await pool.execute('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?', [g[0].chat_id, userId]);

    return res.json(buildResponse(true, 'Left group'));
  } catch (err) {
    next(err);
  }
}

async function promoteToAdmin(req, res, next) {
  try {
    const { id, userId: targetId } = req.params;
    const [role] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, req.user.id]
    );
    if (role.length === 0 || role[0].role === 'member') {
      return res.status(403).json(buildResponse(false, 'Admin permission required'));
    }
    await pool.execute(
      "UPDATE group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?", [id, targetId]
    );
    await pool.execute(
      "UPDATE chat_members SET role = 'admin' WHERE chat_id = (SELECT chat_id FROM `groups` WHERE id = ?) AND user_id = ?",
      [id, targetId]
    );
    return res.json(buildResponse(true, 'Member promoted to admin'));
  } catch (err) {
    next(err);
  }
}

async function demoteFromAdmin(req, res, next) {
  try {
    const { id, userId: targetId } = req.params;
    const [role] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, req.user.id]
    );
    if (role.length === 0 || role[0].role === 'member') {
      return res.status(403).json(buildResponse(false, 'Admin permission required'));
    }
    await pool.execute(
      "UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?", [id, targetId]
    );
    await pool.execute(
      "UPDATE chat_members SET role = 'member' WHERE chat_id = (SELECT chat_id FROM `groups` WHERE id = ?) AND user_id = ?",
      [id, targetId]
    );
    return res.json(buildResponse(true, 'Admin demoted to member'));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createGroup, getGroup, updateGroup, deleteGroup,
  getGroupMembers, addMembers, removeMember, leaveGroup,
  promoteToAdmin, demoteFromAdmin,
};
