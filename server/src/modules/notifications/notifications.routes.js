const express = require('express');
const router = express.Router();
const notificationController = require('./notifications.controller');

// 3B.3 - GET /api/notifications
router.get('/', notificationController.sabNotificationsLao);
router.put('/read-all', notificationController.sabReadKardo);
router.put('/:id/read', notificationController.ekNotificationReadKaro);

module.exports = router;
