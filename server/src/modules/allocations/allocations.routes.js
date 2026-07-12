/**
 * Allocations Routes — Phase 2A
 *
 * POST   /api/allocations             — allocate asset
 * POST   /api/allocations/:id/return  — return asset
 * GET    /api/allocations/:id         — get allocation details
 * GET    /api/allocations             — list allocations (with filters)
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const allocationsController = require('./allocations.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── POST / — Allocate an asset ────────────────────────────────────────────
// Only Asset Managers, Admins, and Dept Heads can allocate.
// AL6: Dept heads are further restricted to their own dept in the service.
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  validate([
    body('assetId')
      .isUUID()
      .withMessage('assetId must be a valid UUID'),
    body('employeeHolderId')
      .optional()
      .isUUID()
      .withMessage('employeeHolderId must be a valid UUID'),
    body('departmentHolderId')
      .optional()
      .isUUID()
      .withMessage('departmentHolderId must be a valid UUID'),
    body('expectedReturnDate')
      .optional()
      .isISO8601()
      .withMessage('expectedReturnDate must be a valid ISO 8601 date'),
    body('idempotencyKey')
      .optional()
      .isString()
      .withMessage('idempotencyKey must be a string'),
  ]),
  allocationsController.allocate
);

// ── POST /:id/return — Return an asset ───────────────────────────────────
// The holder, dept head, asset manager, or admin can return.
// Role check is done in the service (more context needed than requireRole).
router.post(
  '/:id/return',
  validate([
    param('id').isUUID().withMessage('Invalid allocation ID'),
    body('returnCondition')
      .optional()
      .isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'damaged'])
      .withMessage('Invalid return condition'),
    body('returnNotes')
      .optional()
      .isString()
      .withMessage('returnNotes must be a string'),
  ]),
  allocationsController.returnAllocation
);

// ── GET /:id — Get allocation by ID ──────────────────────────────────────
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid allocation ID'),
  ]),
  allocationsController.getById
);

// ── GET / — List allocations ─────────────────────────────────────────────
// OVERDUE added to valid statuses (2A.7 cron sets this).
router.get(
  '/',
  validate([
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be between 1 and 100'),
    query('assetId')
      .optional()
      .isUUID()
      .withMessage('Invalid asset ID'),
    query('employeeId')
      .optional()
      .isUUID()
      .withMessage('Invalid employee ID'),
    query('departmentId')
      .optional()
      .isUUID()
      .withMessage('Invalid department ID'),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'RETURNED', 'TRANSFERRED', 'OVERDUE'])
      .withMessage('status must be one of: ACTIVE, RETURNED, TRANSFERRED, OVERDUE'),
  ]),
  allocationsController.list
);

module.exports = router;