// backend/utils/helpers.js
// Shared utility functions used throughout the backend
'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Generate a new UUID v4.
 */
function generateId() {
  return uuidv4();
}

/**
 * Remove sensitive fields from a user object before sending to the client.
 * @param {Object} user - Raw user row from DB
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

/**
 * Parse pagination parameters from query string.
 * @param {Object} query - req.query
 * @returns {{ limit: number, offset: number, page: number }}
 */
function paginationParams(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Build a consistent JSON response object.
 * @param {boolean} success
 * @param {string}  message
 * @param {*}       [data]
 * @param {Object}  [meta] - Pagination metadata etc.
 */
function buildResponse(success, message, data = null, meta = null) {
  const response = { success, message };
  if (data !== null)  response.data = data;
  if (meta !== null)  response.meta = meta;
  return response;
}

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g. "1.23 MB"
 */
function formatFileSize(bytes) {
  if (bytes < 1024)                   return `${bytes} B`;
  if (bytes < 1024 * 1024)            return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)     return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Get the public URL path for an uploaded file.
 * @param {string} filePath - Path stored in DB (relative to uploads dir)
 * @returns {string} URL-safe path
 */
function getFileUrl(filePath) {
  if (!filePath) return null;
  // Replace backslashes and ensure leading slash
  return '/uploads/' + filePath.replace(/\\/g, '/').replace(/^.*uploads[/\\]/, '');
}

/**
 * Determine message type from MIME type.
 * @param {string} mimeType
 * @returns {string} 'image'|'video'|'audio'|'document'
 */
function getMessageTypeFromMime(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/'))  return 'image';
  if (mimeType.startsWith('video/'))  return 'video';
  if (mimeType.startsWith('audio/'))  return 'audio';
  return 'document';
}

module.exports = {
  generateId,
  sanitizeUser,
  paginationParams,
  buildResponse,
  formatFileSize,
  getFileUrl,
  getMessageTypeFromMime,
};
