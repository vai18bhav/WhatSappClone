// backend/routes/users.js
// User profile, contacts, and blocking routes
'use strict';

const express = require('express');
const router  = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');
const { validateProfile } = require('../middleware/validate');

router.use(authenticate);

// Search and profile
router.get('/', userController.searchUsers);
router.get('/profile/:id', userController.getUserById);
router.put('/profile', uploadAvatar, validateProfile, userController.updateProfile);
router.post('/profile', uploadAvatar, validateProfile, userController.updateProfile);

// Contacts
router.get('/contacts', userController.getContacts);
router.post('/contacts', userController.addContact);
router.delete('/contacts/:id', userController.removeContact);

// Blocking
router.get('/blocked', userController.getBlockedUsers);
router.post('/block', userController.blockUser);
router.delete('/block/:id', userController.unblockUser);

// Single user details
router.get('/:id', userController.getUserById);

module.exports = router;
