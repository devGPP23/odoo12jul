/**
 * Notifications Module — Routes.
 */

const { Router } = require('express');
const { param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

router.get('/', controller.getNotifications);
router.put('/:id/read', [param('id').isMongoId()], validate, controller.markAsRead);
router.put('/read-all', controller.markAllAsRead);

module.exports = router;
