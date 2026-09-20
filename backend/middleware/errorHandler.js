// backend/middleware/errorHandler.js
// Central error-handling middleware — always the last middleware registered
'use strict';

const multer = require('multer');

/**
 * Global Express error handler.
 * Handles Multer errors, JWT errors, MySQL errors, and generic errors.
 */
function errorHandler(err, req, res, next) {
  console.error('[ErrorHandler]', err.message || err);

  // ── Multer errors (file upload) ──
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE / (1024 * 1024)} MB`,
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  // ── Custom file filter errors from multer ──
  if (err.message && err.message.startsWith('Only') || err.message && err.message.includes('not allowed')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // ── MySQL errors ──
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({ success: false, message: 'Duplicate entry — resource already exists' });
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
      case 'ECONNREFUSED':
        return res.status(503).json({ success: false, message: 'Database unavailable' });
    }
  }

  // ── JWT errors ──
  if (err.name === 'JsonWebTokenError')  return res.status(403).json({ success: false, message: 'Invalid token' });
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Token expired' });

  // ── Generic / Unhandled ──
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
