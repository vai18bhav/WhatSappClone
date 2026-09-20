// backend/controllers/authController.js
// Authentication: register, login, logout, password management
'use strict';

const { pool }           = require('../config/db');
const authService        = require('../services/authService');
const { generateId, sanitizeUser, buildResponse } = require('../utils/helpers');

// ─── Register ─────────────────────────────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { email, password, display_name, phone } = req.body;

    // Check for existing email
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json(buildResponse(false, 'Email already registered'));
    }

    // Hash password
    const password_hash = await authService.hashPassword(password);
    const id            = generateId();

    // Handle optional avatar upload
    let avatarPath = null;
    if (req.file) {
      avatarPath = req.file.filename ? `images/${req.file.filename}` : null;
    }

    // Insert user
    await pool.execute(
      `INSERT INTO users (id, email, phone, password_hash, display_name, avatar)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, email, phone || null, password_hash, display_name, avatarPath]
    );

    // Fetch the new user
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    const user   = sanitizeUser(rows[0]);

    // Generate JWT
    const token = authService.generateToken(id);

    return res.status(201).json(buildResponse(true, 'Registration successful', { token, user }));
  } catch (err) {
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json(buildResponse(false, 'Invalid email or password'));
    }

    const user = rows[0];

    // Check account active
    if (!user.is_active) {
      return res.status(403).json(buildResponse(false, 'Account deactivated'));
    }

    // Compare password
    const valid = await authService.comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json(buildResponse(false, 'Invalid email or password'));
    }

    // Update online status
    await pool.execute(
      'UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = ?',
      [user.id]
    );

    const token       = authService.generateToken(user.id);
    const safeUser    = sanitizeUser(user);
    safeUser.is_online = true;

    return res.json(buildResponse(true, 'Login successful', { token, user: safeUser }));
  } catch (err) {
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout(req, res, next) {
  try {
    await pool.execute(
      'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = ?',
      [req.user.id]
    );
    return res.json(buildResponse(true, 'Logged out successfully'));
  } catch (err) {
    next(err);
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json(buildResponse(false, 'User not found'));
    }
    return res.json(buildResponse(true, 'OK', sanitizeUser(rows[0])));
  } catch (err) {
    next(err);
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);

    // Always return 200 — don't reveal whether email exists
    if (rows.length > 0) {
      const token       = authService.generateResetToken();
      const tokenHash   = authService.hashResetToken(token);
      const expires     = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await pool.execute(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [tokenHash, expires, rows[0].id]
      );

      // In production: send email with reset link
      // For development: log the token
      console.log(`[ForgotPassword] Reset token for ${email}: ${token}`);
      console.log(`[ForgotPassword] Link: ${process.env.FRONTEND_URL}/reset-password?token=${token}`);
    }

    return res.json(buildResponse(true, 'If that email exists, a reset link has been sent'));
  } catch (err) {
    next(err);
  }
}

// ─── Reset Password ───────────────────────────────────────────────────────────
async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;

    const tokenHash = authService.hashResetToken(token);

    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json(buildResponse(false, 'Invalid or expired reset token'));
    }

    const password_hash = await authService.hashPassword(password);

    await pool.execute(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [password_hash, rows[0].id]
    );

    return res.json(buildResponse(true, 'Password reset successfully'));
  } catch (err) {
    next(err);
  }
}

// ─── Change Password (authenticated) ─────────────────────────────────────────
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    // Fetch current hash
    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?', [req.user.id]
    );

    const valid = await authService.comparePassword(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json(buildResponse(false, 'Current password is incorrect'));
    }

    const newHash = await authService.hashPassword(newPassword);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return res.json(buildResponse(true, 'Password changed successfully'));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
};
