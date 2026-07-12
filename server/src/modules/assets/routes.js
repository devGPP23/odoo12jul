/**
 * Assets Module — Routes.
 */

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Register — Asset Manager only
router.post(
  '/',
  requireRole(['ASSET_MANAGER']),
  [
    body('name').trim().notEmpty().withMessage('Asset name is required'),
    body('categoryId').isUUID().withMessage('Valid category ID is required'),
    body('serialNumber').optional().trim(),
    body('acquisitionDate').optional().isISO8601(),
    body('acquisitionCost').optional().isDecimal(),
    body('condition').optional().isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']),
    body('location').optional().trim(),
    body('isBookable').optional().isBoolean(),
  ],
  validate,
  controller.register
);

// Directory — all authenticated users can search
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn([
      'AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE',
      'LOST', 'RETIRED', 'DISPOSED',
    ]),
  ],
  validate,
  controller.getAll
);

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  controller.getById
);

router.get(
  '/:id/history',
  [param('id').isUUID()],
  validate,
  controller.getHistory
);

// Update — Asset Manager only
router.put(
  '/:id',
  requireRole(['ASSET_MANAGER']),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('categoryId').optional().isUUID(),
    body('condition').optional().isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']),
    body('location').optional().trim(),
    body('isBookable').optional().isBoolean(),
  ],
  validate,
  controller.update
);

module.exports = router;
