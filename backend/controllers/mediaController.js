// backend/controllers/mediaController.js
// File upload and media management
'use strict';

const path   = require('path');
const { pool }       = require('../config/db');
const { generateId, buildResponse, getMessageTypeFromMime } = require('../utils/helpers');

// ─── Upload Media ─────────────────────────────────────────────────────────────
async function uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json(buildResponse(false, 'No file uploaded'));
    }

    const file = req.file;
    const id   = generateId();

    // Determine subfolder from path
    const relPath = path.relative(
      path.join(__dirname, '..', 'uploads'),
      file.path
    ).replace(/\\/g, '/');

    // Insert media record (message_id will be linked when message is created)
    await pool.execute(
      `INSERT INTO media (id, message_id, uploader_id, file_name, original_name, file_type, file_size, file_path)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, file.filename, file.originalname, file.mimetype, file.size, relPath]
    );

    return res.status(201).json(buildResponse(true, 'File uploaded', {
      media_id:      id,
      file_name:     file.filename,
      original_name: file.originalname,
      file_type:     file.mimetype,
      file_size:     file.size,
      file_path:     relPath,
      url:           `/uploads/${relPath}`,
      message_type:  getMessageTypeFromMime(file.mimetype),
    }));
  } catch (err) {
    next(err);
  }
}

// ─── Get Chat Media ───────────────────────────────────────────────────────────
async function getMedia(req, res, next) {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Check membership
    const [member] = await pool.execute(
      'SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?', [chatId, userId]
    );
    if (member.length === 0) return res.status(403).json(buildResponse(false, 'Not a member'));

    const [rows] = await pool.execute(
      `SELECT med.id, med.file_name, med.original_name, med.file_type,
              med.file_size, med.file_path, med.created_at,
              m.sender_id, u.display_name AS sender_name
       FROM media med
       JOIN messages m ON m.id = med.message_id
       JOIN users u    ON u.id = m.sender_id
       WHERE m.chat_id = ?
         AND m.is_deleted_for_all = FALSE
       ORDER BY med.created_at DESC
       LIMIT 100`,
      [chatId]
    );

    const media = rows.map(r => ({
      ...r,
      url: `/uploads/${r.file_path}`,
    }));

    return res.json(buildResponse(true, 'OK', media));
  } catch (err) {
    next(err);
  }
}

// ─── Delete Media ─────────────────────────────────────────────────────────────
async function deleteMedia(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM media WHERE id = ? AND uploader_id = ?', [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json(buildResponse(false, 'Media not found'));

    await pool.execute('DELETE FROM media WHERE id = ?', [id]);

    // Optionally: delete the physical file here
    // fs.unlink(path.join(__dirname, '..', 'uploads', rows[0].file_path), () => {});

    return res.json(buildResponse(true, 'Media deleted'));
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadMedia, getMedia, deleteMedia };
