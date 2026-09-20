// backend/routes/statuses.js
// Status update routes with multi-media support
'use strict';

const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');
const { authenticate } = require('../middleware/auth');
const { uploadAny } = require('../middleware/upload');

router.use(authenticate);

function safeStatusUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return uploadAny(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
      }
      next();
    });
  }
  next();
}

router.get('/', statusController.getStatuses);
router.post('/', safeStatusUpload, statusController.createStatus);
router.delete('/:id', statusController.deleteStatus);

module.exports = router;
