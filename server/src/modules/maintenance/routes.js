/**
 * Maintenance Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Raise — any authenticated user (employee for own assets, etc.)
router.post(
  '/',
  [
    body('assetId').isUUID().withMessage('Valid asset ID is required'),
    body('issueDescription').trim().notEmpty().withMessage('Issue description is required'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('photoUrl').optional().trim(),
  ],
  validate,
  controller.raise
);

// List requests
router.get('/', controller.getAll);

// Approve/Reject — Asset Manager only
router.put(
  '/:id/approve',
  requireRole(['ASSET_MANAGER']),
  [param('id').isUUID()],
  validate,
  controller.approve
);

router.put(
  '/:id/reject',
  requireRole(['ASSET_MANAGER']),
  [param('id').isUUID()],
  validate,
  controller.reject
);

// Assign technician — Asset Manager only
router.put(
  '/:id/assign-technician',
  requireRole(['ASSET_MANAGER']),
  [
    param('id').isUUID(),
    body('technicianId').isUUID().withMessage('Valid technician ID is required'),
  ],
  validate,
  controller.assignTechnician
);

// Start progress
router.put(
  '/:id/start',
  requireRole(['ASSET_MANAGER']),
  [param('id').isUUID()],
  validate,
  controller.startProgress
);

// Resolve
router.put(
  '/:id/resolve',
  requireRole(['ASSET_MANAGER']),
  [param('id').isUUID()],
  validate,
  controller.resolve
);

module.exports = router;
