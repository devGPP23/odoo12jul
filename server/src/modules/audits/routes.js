/**
 * Audits Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Create cycle — Admin + Asset Manager
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  [
    body('scopeType').isIn(['DEPARTMENT', 'LOCATION']).withMessage('Scope type must be DEPARTMENT or LOCATION'),
    body('scopeValue').trim().notEmpty().withMessage('Scope value is required'),
    body('dateStart').isISO8601().withMessage('Valid start date is required'),
    body('dateEnd').isISO8601().withMessage('Valid end date is required'),
  ],
  validate,
  controller.createCycle
);

// List cycles
router.get(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  controller.getCycles
);

// Assign auditors
router.post(
  '/:id/assign-auditors',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  [
    param('id').isUUID(),
    body('auditorIds').isArray({ min: 1 }).withMessage('At least one auditor ID is required'),
    body('auditorIds.*').isUUID(),
  ],
  validate,
  controller.assignAuditors
);

// Get assets in scope
router.get(
  '/:id/assets',
  [param('id').isUUID()],
  validate,
  controller.getAssets
);

// Create audit items (batch)
router.post(
  '/:id/items',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  [
    param('id').isUUID(),
    body('assetIds').isArray({ min: 1 }),
    body('assetIds.*').isUUID(),
    body('auditorId').optional().isUUID(),
  ],
  validate,
  controller.createItems
);

// Mark audit item
router.put(
  '/items/:id',
  [
    param('id').isUUID(),
    body('result').isIn(['VERIFIED', 'MISSING', 'DAMAGED']).withMessage('Result must be VERIFIED, MISSING, or DAMAGED'),
    body('notes').optional().trim(),
  ],
  validate,
  controller.markItem
);

// Close cycle
router.post(
  '/:id/close',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  [param('id').isUUID()],
  validate,
  controller.closeCycle
);

module.exports = router;
