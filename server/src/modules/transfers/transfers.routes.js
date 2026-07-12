const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const asyncHandler = require('../../utils/asyncHandler');
const transfersService = require('./transfers.service');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── POST /api/transfers — Create transfer request ──────────────────────────
// AL6: toHolder must be active, asset must be allocated, asset must not be under maintenance
router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  validate([
    body('assetId').isUUID().withMessage('Invalid asset ID'),
    body('fromHolderId').isUUID().withMessage('Invalid from holder ID'),
    body('toHolderId').isUUID().withMessage('Invalid to holder ID'),
  ]),
  asyncHandler(async (req, res) => {
    const transfer = await transfersService.createTransferRequest(req.body, req.user.id);
    res.status(201).json({
      success: true,
      message: 'Transfer request created successfully',
      data: transfer,
    });
  })
);

// ── PUT /api/transfers/:id/approve — Approve transfer ─────────────────────
// Single transaction: close old allocation → open new allocation → emit event
// Re-checks allocation.status before approval (edge case AL6)
router.put(
  '/:id/approve',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  validate([
    param('id').isUUID().withMessage('Invalid transfer ID'),
  ]),
  asyncHandler(async (req, res) => {
    const transfer = await transfersService.approveTransfer(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Transfer approved successfully',
      data: transfer,
    });
  })
);

// ── PUT /api/transfers/:id/reject — Reject transfer ──────────────────────
// Simple status update + notification to requester and fromHolder
router.put(
  '/:id/reject',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  validate([
    param('id').isUUID().withMessage('Invalid transfer ID'),
    body('rejectionReason').optional().isString().withMessage('Reason must be a string'),
  ]),
  asyncHandler(async (req, res) => {
    const transfer = await transfersService.rejectTransfer(
      req.params.id,
      req.body.rejectionReason,
      req.user.id
    );
    res.status(200).json({
      success: true,
      message: 'Transfer rejected',
      data: transfer,
    });
  })
);

// ── GET /api/transfers/:id — Get transfer by ID ───────────────────────────
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid transfer ID'),
  ]),
  asyncHandler(async (req, res) => {
    const transfer = await transfersService.getById(req.params.id);
    res.status(200).json({ success: true, data: transfer });
  })
);

// ── GET /api/transfers — List transfer requests ───────────────────────────
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('assetId').optional().isUUID().withMessage('Invalid asset ID'),
    query('status').optional().isIn(['REQUESTED', 'APPROVED', 'REJECTED']).withMessage('Invalid status'),
    query('requesterId').optional().isUUID().withMessage('Invalid requester ID'),
  ]),
  asyncHandler(async (req, res) => {
    const filters = {
      assetId: req.query.assetId,
      status: req.query.status,
      requesterId: req.query.requesterId,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await transfersService.list(filters);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

module.exports = router;