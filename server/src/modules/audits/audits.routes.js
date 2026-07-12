/**
 * Audits Routes — Phase 4
 *
 * POST   /api/audit-cycles                    — Create audit cycle
 * GET    /api/audit-cycles                    — List cycles
 * GET    /api/audit-cycles/:id                — Get cycle details
 * POST   /api/audit-cycles/:id/assign-auditors — Assign auditors
 * GET    /api/audit-cycles/:id/items          — Get items with progress
 * PUT    /api/audit-items/:id                 — Mark item result
 * POST   /api/audit-cycles/:id/close          — Close cycle (atomic)
 * GET    /api/audit-cycles/:id/report         — Discrepancy report
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const auditsController = require('./audits.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── POST /api/audit-cycles — Create audit cycle ─────────────────────────────
// Only ADMIN, ASSET_MANAGER can create cycles
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    body('scopeType').isIn(['DEPARTMENT', 'LOCATION']).withMessage('scopeType must be DEPARTMENT or LOCATION'),
    body('scopeValue').notEmpty().withMessage('scopeValue is required'),
    body('dateStart').isISO8601().withMessage('dateStart must be a valid ISO 8601 date'),
    body('dateEnd').isISO8601().withMessage('dateEnd must be a valid ISO 8601 date'),
  ]),
  auditsController.createCycle
);

// ── GET /api/audit-cycles — List audit cycles ───────────────────────────────
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit 1-100'),
    query('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'CLOSED']).withMessage('Invalid status'),
  ]),
  auditsController.listCycles
);

// ── GET /api/audit-cycles/:id — Get cycle details ───────────────────────────
router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid cycle ID')]),
  auditsController.getCycle
);

// ── POST /api/audit-cycles/:id/assign-auditors — Assign auditors ────────────
router.post(
  '/:id/assign-auditors',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID'),
    body('auditorIds').isArray({ min: 1 }).withMessage('auditorIds must be a non-empty array'),
    body('auditorIds.*').isUUID().withMessage('Each auditorId must be a valid UUID'),
  ]),
  auditsController.assignAuditors
);

// ── GET /api/audit-cycles/:id/items — Get items with progress ───────────────
router.get(
  '/:id/items',
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit 1-100'),
  ]),
  auditsController.getCycleItems
);

// ── PUT /api/audit-items/:id — Mark item result ─────────────────────────────
// Only the assigned auditor (or ADMIN/ASSET_MANAGER) can mark
router.put(
  '/items/:id',
  validate([
    param('id').isUUID().withMessage('Invalid item ID'),
    body('result').isIn(['VERIFIED', 'MISSING', 'DAMAGED']).withMessage('result must be VERIFIED, MISSING, or DAMAGED'),
    body('notes').optional().isString().withMessage('notes must be a string'),
  ]),
  auditsController.markItem
);

// ── POST /api/audit-cycles/:id/close — Close audit cycle ────────────────────
// ADMIN, ASSET_MANAGER can close. forceClose optional.
router.post(
  '/:id/close',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    param('id').isUUID().withMessage('Invalid cycle ID'),
    body('forceClose').optional().isBoolean().withMessage('forceClose must be a boolean'),
  ]),
  auditsController.closeCycle
);

// ── GET /api/audit-cycles/:id/report — Discrepancy report ───────────────────
router.get(
  '/:id/report',
  validate([param('id').isUUID().withMessage('Invalid cycle ID')]),
  auditsController.getReport
);

module.exports = router;