// backend/routes/calls.js
// Voice and video call records
'use strict';

const express = require('express');
const router  = express.Router();
const callController = require('../controllers/callController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', callController.getCallHistory);
router.post('/', callController.initiateCall);
router.put('/:id', callController.updateCallStatus);

module.exports = router;
