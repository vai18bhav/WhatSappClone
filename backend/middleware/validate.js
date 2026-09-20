// backend/middleware/validate.js
// Input validation chains using express-validator
'use strict';

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware: Check validation results and return 400 if any errors.
 * Always use this as the LAST item in a validation chain array.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ─── Auth Validators ──────────────────────────────────────────────────────────

const validateRegister = [
  body('display_name')
    .trim()
    .notEmpty().withMessage('Display name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Display name must be 2-100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),

  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isMobilePhone().withMessage('Invalid phone number'),

  handleValidation,
];

const validateLogin = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
];

const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidation,
];

const validateForgotPassword = [
  body('email').trim().notEmpty().isEmail().normalizeEmail().withMessage('Valid email required'),
  handleValidation,
];

const validateResetPassword = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').notEmpty().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidation,
];

// ─── Profile Validator ────────────────────────────────────────────────────────

const validateProfile = [
  body('display_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Display name must be 2-100 characters'),
  body('bio')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isMobilePhone().withMessage('Invalid phone number'),
  handleValidation,
];

// ─── Message Validator ────────────────────────────────────────────────────────

const validateMessage = [
  body('type')
    .notEmpty().withMessage('Message type is required')
    .isIn(['text','image','video','audio','document','voice','location']).withMessage('Invalid message type'),
  body('content')
    .if(body('type').equals('text'))
    .notEmpty().withMessage('Content is required for text messages')
    .trim()
    .isLength({ max: 10000 }).withMessage('Message too long'),
  handleValidation,
];

// ─── Group Validator ──────────────────────────────────────────────────────────

const validateGroup = [
  body('name').trim().notEmpty().withMessage('Group name is required').isLength({ max: 100 }),
  body('members').optional().isArray().withMessage('Members must be an array'),
  handleValidation,
];

module.exports = {
  handleValidation,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateProfile,
  validateMessage,
  validateGroup,
};
