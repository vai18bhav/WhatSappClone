// backend/routes/chats.js
// Chat management routes
'use strict';

const express = require('express');
const router  = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', chatController.getChats);
router.post('/', chatController.createDirectChat);
router.get('/:id', chatController.getChatById);
router.put('/:id/archive', chatController.archiveChat);
router.put('/:id/mute', chatController.muteChat);

module.exports = router;
