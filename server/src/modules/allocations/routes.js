/**
 * Allocations Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Allocate — Asset Manager + Department Head (scope check in service)
router.post(
  '/',
  requireRole(['ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [
    body('assetId').isUUID().withMessage('Valid asset ID is required'),
    body('employeeHolderId').optional().isUUID(),
    body('departmentHolderId').optional().isUUID(),
    body('expectedReturnDate').optional().isISO8601(),
  ],
  validate,
  controller.allocate
);

// List allocations
router.get(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  controller.getAllocations
);

// Return asset
router.post(
  '/:id/return',
  requireRole(['ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [
    param('id').isUUID(),
    body('checkinNotes').optional().trim(),
    body('condition').optional().isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']),
  ],
  validate,
  controller.returnAsset
);

// Transfer requests
router.post(
  '/transfers',
  [
    body('assetId').isUUID().withMessage('Valid asset ID is required'),
    body('toHolderId').isUUID().withMessage('Valid target employee ID is required'),
  ],
  validate,
  controller.createTransfer
);

router.get(
  '/transfers',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  controller.getTransfers
);

router.put(
  '/transfers/:id/approve',
  requireRole(['ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [param('id').isUUID()],
  validate,
  controller.approveTransfer
);

router.put(
  '/transfers/:id/reject',
  requireRole(['ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [param('id').isUUID()],
  validate,
  controller.rejectTransfer
);

module.exports = router;
