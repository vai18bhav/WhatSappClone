// backend/routes/media.js
// Media upload and retrieval routes
'use strict';

const express = require('express');
const router  = express.Router();
const mediaController = require('../controllers/mediaController');
const { authenticate } = require('../middleware/auth');
const { uploadAny } = require('../middleware/upload');

router.use(authenticate);

router.post('/upload', uploadAny, mediaController.uploadMedia);
router.get('/chats/:chatId/media', mediaController.getMedia);
router.delete('/:id', mediaController.deleteMedia);

module.exports = router;
