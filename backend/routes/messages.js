// backend/routes/messages.js
// Message routes
'use strict';

const express = require('express');
const router  = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validate');

router.use(authenticate);

// Chat-specific message routes
router.get('/chats/:chatId/messages', messageController.getMessages);
router.post('/chats/:chatId/messages', validateMessage, messageController.createMessage);
router.get('/chats/:chatId/messages/search', messageController.searchMessages);

// Individual message actions
router.put('/:id', messageController.editMessage);
router.delete('/:id', messageController.deleteMessage);
router.post('/:id/react', messageController.addReaction);
router.delete('/:id/react', messageController.removeReaction);
router.post('/:id/star', messageController.starMessage);
router.delete('/:id/star', messageController.unstarMessage);

module.exports = router;
