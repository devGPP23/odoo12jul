const express = require('express');
const { body, param } = require('express-validator');
const allocationsController = require('./allocations.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All endpoints in this module require authentication
router.use(authenticate);

// 2A.2: Allocate asset (Admins and Asset Managers only)
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    body('assetId').isUUID().withMessage('Invalid asset ID format'),
    body('employeeHolderId').optional({ nullable: true }).isUUID().withMessage('Invalid employee holder ID format'),
    body('departmentHolderId').optional({ nullable: true }).isUUID().withMessage('Invalid department holder ID format'),
    body('expectedReturnDate').optional({ nullable: true }).isISO8601().withMessage('expectedReturnDate must be a valid ISO 8601 date string')
  ]),
  allocationsController.allocate
);

// 2A.3: Return asset (Admins and Asset Managers only)
router.post(
  '/:id/return',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid allocation ID format'),
    body('condition')
      .optional()
      .isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'])
      .withMessage('Invalid asset condition'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ]),
  allocationsController.returnAllocation
);

module.exports = router;
