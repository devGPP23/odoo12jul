const express = require('express');
const { body, param, query } = require('express-validator');
const maintenanceController = require('./maintenance.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// GET /api/maintenance (list with optional filters)
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('assetId').optional().isUUID().withMessage('Invalid asset ID format'),
    query('raisedById').optional().isUUID().withMessage('Invalid raisedById format'),
    query('status')
      .optional()
      .isIn(['PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED'])
      .withMessage('Invalid status filter'),
    query('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('Invalid priority filter')
  ]),
  maintenanceController.getAll
);

// 3A.1: Raise maintenance request
router.post(
  '/',
  validate([
    body('assetId').optional().isUUID().withMessage('Invalid assetId format'),
    body('asset_id').optional().isUUID().withMessage('Invalid asset_id format'),
    body('issueDescription').optional().notEmpty().withMessage('issueDescription cannot be empty'),
    body('issue_description').optional().notEmpty().withMessage('issue_description cannot be empty'),
    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('Invalid priority value'),
    body('photoUrl').optional({ nullable: true }).isString().withMessage('photoUrl must be a string'),
    body('photo_url').optional({ nullable: true }).isString().withMessage('photo_url must be a string')
  ]),
  maintenanceController.raiseRequest
);

// 3A.2: Approve request (Admin & Asset Managers)
router.put(
  '/:id/approve',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid request ID format')
  ]),
  maintenanceController.approve
);

// 3A.3: Reject request (Admin & Asset Managers)
router.put(
  '/:id/reject',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid request ID format')
  ]),
  maintenanceController.reject
);

// 3A.4: Assign technician (Admin & Asset Managers)
router.put(
  '/:id/assign-technician',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid request ID format'),
    body('technicianId').optional().isUUID().withMessage('Invalid technicianId format'),
    body('technician_id').optional().isUUID().withMessage('Invalid technician_id format')
  ]),
  maintenanceController.assignTechnician
);

// Start progress on task (Any authenticated employee / assigned technician)
router.put(
  '/:id/start',
  validate([
    param('id').isUUID().withMessage('Invalid request ID format')
  ]),
  maintenanceController.startProgress
);

// 3A.5: Resolve request (Admin, Asset Manager, or technician)
router.put(
  '/:id/resolve',
  validate([
    param('id').isUUID().withMessage('Invalid request ID format')
  ]),
  maintenanceController.resolve
);

module.exports = router;
