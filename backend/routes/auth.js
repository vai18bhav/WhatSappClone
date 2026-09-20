// backend/routes/auth.js
// Authentication routes
'use strict';

const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/validate');

// Public routes
router.post('/register', uploadAvatar, validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', validateResetPassword, authController.resetPassword);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/change-password', authenticate, validateChangePassword, authController.changePassword);
router.post('/change-password', authenticate, validateChangePassword, authController.changePassword);

module.exports = router;
