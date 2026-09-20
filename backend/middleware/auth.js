// backend/middleware/auth.js
// JWT authentication middleware — protects all private routes
'use strict';

const { verifyToken } = require('../services/authService');
const { pool }        = require('../config/db');

/**
 * Middleware: Verify Bearer JWT token.
 * On success: attaches req.user = { id, email, display_name, avatar }
 * On failure: returns 401 or 403
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    // Verify token signature and expiry
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }

    // Confirm user still exists and is active in the database
    const [rows] = await pool.execute(
      'SELECT id, email, display_name, avatar, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(403).json({ success: false, message: 'User not found or deactivated' });
    }

    // Attach user to request for downstream use
    req.user = rows[0];
    next();

  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
