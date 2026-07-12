const express = require('express');
const { body, param } = require('express-validator');
const allocationsController = require('./allocations.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// 2A.4: Create transfer request (Any authenticated employee)
router.post(
  '/',
  validate([
    body('assetId').isUUID().withMessage('Invalid asset ID format'),
    body('fromHolderId').isUUID().withMessage('Invalid fromHolder ID format'),
    body('toHolderId').isUUID().withMessage('Invalid toHolder ID format')
  ]),
  allocationsController.createTransferRequest
);

// 2A.5: Approve transfer request (Admins, Asset Managers, and Department Heads)
router.put(
  '/:id/approve',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']),
  validate([
    param('id').isUUID().withMessage('Invalid transfer request ID format')
  ]),
  allocationsController.approveTransfer
);

// 2A.6: Reject transfer request (Admins, Asset Managers, and Department Heads)
router.put(
  '/:id/reject',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD']),
  validate([
    param('id').isUUID().withMessage('Invalid transfer request ID format')
  ]),
  allocationsController.rejectTransfer
);

module.exports = router;
