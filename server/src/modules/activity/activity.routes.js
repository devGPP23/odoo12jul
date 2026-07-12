const express = require('express');
const router = express.Router();
const activityController = require('./activity.controller');

// 3B.13 - GET /api/activity-logs
router.get('/', activityController.activitiesLao);

module.exports = router;
