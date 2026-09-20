// backend/routes/groups.js
// Group management routes
'use strict';

const express = require('express');
const router  = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');
const { uploadGroupImg } = require('../middleware/upload');
const { validateGroup } = require('../middleware/validate');

router.use(authenticate);

router.post('/', uploadGroupImg, validateGroup, groupController.createGroup);
router.get('/:id', groupController.getGroup);
router.put('/:id', uploadGroupImg, groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);

// Member routes
router.get('/:id/members', groupController.getGroupMembers);
router.post('/:id/members', groupController.addMembers);
router.delete('/:id/members/:userId', groupController.removeMember);
router.post('/:id/leave', groupController.leaveGroup);
router.put('/:id/members/:userId/promote', groupController.promoteToAdmin);
router.put('/:id/members/:userId/demote', groupController.demoteFromAdmin);

module.exports = router;
