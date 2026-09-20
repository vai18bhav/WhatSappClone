// backend/services/authService.js
// Authentication helpers: JWT, bcrypt, reset tokens
'use strict';

const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { BCRYPT_ROUNDS } = require('../config/constants');

/**
 * Generate a signed JWT for the given user ID.
 * @param {string} userId
 * @returns {string} JWT token
 */
function generateToken(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Hash a plain-text password using bcrypt.
 * @param {string} password
 * @returns {Promise<string>} Hash
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plain-text password against a stored bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically random reset token (plain text to send to user).
 * @returns {string} hex token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a reset token for storage (SHA-256, not bcrypt — fast lookup by hash).
 * @param {string} token - plain text token
 * @returns {string} SHA-256 hex hash
 */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  generateResetToken,
  hashResetToken,
};
