/**
 * Bookings Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Book a resource — any authenticated user can book
router.post(
  '/',
  [
    body('assetId').isUUID().withMessage('Valid asset ID is required'),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
  ],
  validate,
  controller.create
);

// List bookings (calendar view)
router.get('/', controller.getAll);

// Cancel
router.put(
  '/:id/cancel',
  [param('id').isUUID()],
  validate,
  controller.cancel
);

// Reschedule
router.put(
  '/:id/reschedule',
  [
    param('id').isUUID(),
    body('startTime').isISO8601().withMessage('Valid start time is required'),
    body('endTime').isISO8601().withMessage('Valid end time is required'),
  ],
  validate,
  controller.reschedule
);

module.exports = router;
