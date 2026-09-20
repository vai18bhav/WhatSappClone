// backend/config/constants.js
// Application-wide constants
'use strict';

module.exports = {
  // ─── File Upload ──────────────────────────────────────────────────────────
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50 MB

  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/3gpp'],
  ALLOWED_AUDIO_TYPES: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/aac'],
  ALLOWED_DOC_TYPES:   [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ],

  // ─── JWT ──────────────────────────────────────────────────────────────────
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // ─── Pagination ───────────────────────────────────────────────────────────
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE:     100,

  // ─── Bcrypt ───────────────────────────────────────────────────────────────
  BCRYPT_ROUNDS: 12,

  // ─── Message Types ────────────────────────────────────────────────────────
  MESSAGE_TYPES: ['text', 'image', 'video', 'audio', 'document', 'voice', 'location', 'system'],

  // ─── User Roles ───────────────────────────────────────────────────────────
  ROLES: {
    MEMBER: 'member',
    ADMIN:  'admin',
    OWNER:  'owner',
  },

  // ─── Call Status ──────────────────────────────────────────────────────────
  CALL_STATUS: {
    RINGING:  'ringing',
    ACTIVE:   'active',
    ENDED:    'ended',
    MISSED:   'missed',
    REJECTED: 'rejected',
  },
};
