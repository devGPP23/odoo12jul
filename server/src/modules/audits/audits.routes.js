const express = require('express');
const { body, param, query } = require('express-validator');
const auditsController = require('./audits.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// GET /api/audit-cycles — list all cycles
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['OPEN', 'IN_PROGRESS', 'CLOSED'])
      .withMessage('Invalid status filter'),
    query('scopeType')
      .optional()
      .isIn(['DEPARTMENT', 'LOCATION'])
      .withMessage('Invalid scopeType filter')
  ]),
  auditsController.getAllCycles
);

// 4A.1: POST /api/audit-cycles — create cycle
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    body('scopeType')
      .optional()
      .isIn(['DEPARTMENT', 'LOCATION'])
      .withMessage('scopeType must be DEPARTMENT or LOCATION'),
    body('scope_type')
      .optional()
      .isIn(['DEPARTMENT', 'LOCATION'])
      .withMessage('scope_type must be DEPARTMENT or LOCATION'),
    body('scopeValue').optional().notEmpty().withMessage('scopeValue is required'),
    body('scope_value').optional().notEmpty().withMessage('scope_value is required'),
    body('dateStart').optional().isISO8601().withMessage('dateStart must be a valid ISO date'),
    body('date_start').optional().isISO8601().withMessage('date_start must be a valid ISO date'),
    body('dateEnd').optional().isISO8601().withMessage('dateEnd must be a valid ISO date'),
    body('date_end').optional().isISO8601().withMessage('date_end must be a valid ISO date')
  ]),
  auditsController.createCycle
);

// 4A.2: POST /api/audit-cycles/:id/assign-auditors
router.post(
  '/:id/assign-auditors',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID format'),
    body('auditorIds').optional().isArray({ min: 1 }).withMessage('auditorIds must be a non-empty array'),
    body('auditor_ids').optional().isArray({ min: 1 }).withMessage('auditor_ids must be a non-empty array')
  ]),
  auditsController.assignAuditors
);

// 4A.3: POST /api/audit-cycles/:id/populate — auto-populate items
router.post(
  '/:id/populate',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID format')
  ]),
  auditsController.populateItems
);

// 4A.4: GET /api/audit-cycles/:id/items — paginated with progress
router.get(
  '/:id/items',
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID format'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]),
  auditsController.getCycleItems
);

module.exports = router;
