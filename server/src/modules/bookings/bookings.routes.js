const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const bookingsService = require('./bookings.service');

const router = express.Router();

router.use(authenticate);

// ── POST /api/bookings — Create booking ─────────────────────────────────────
router.post(
  '/',
  validate([
    body('assetId').isUUID().withMessage('Invalid asset ID'),
    body('startTime').isISO8601().withMessage('startTime must be ISO 8601 date'),
    body('endTime').isISO8601().withMessage('endTime must be ISO 8601 date'),
  ]),
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.create(req.body, req.user);
    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  })
);

// ── GET /api/bookings — List bookings with filters ──────────────────────────
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('assetId').optional().isUUID(),
    query('bookedById').optional().isUUID(),
    query('status').optional().isIn(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']),
  ]),
  asyncHandler(async (req, res) => {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      assetId: req.query.assetId,
      bookedById: req.query.bookedById,
      status: req.query.status,
    };
    const result = await bookingsService.list(filters);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  })
);

// ── GET /api/bookings/calendar — Calendar view for an asset on a date ───────
router.get(
  '/calendar',
  validate([
    query('assetId').isUUID().withMessage('assetId is required'),
    query('date').isISO8601().withMessage('date must be ISO 8601 (YYYY-MM-DD)'),
  ]),
  asyncHandler(async (req, res) => {
    const result = await bookingsService.calendar({
      assetId: req.query.assetId,
      date: req.query.date,
    });
    res.status(200).json({ success: true, data: result });
  })
);

// ── PUT /api/bookings/:id/cancel — Cancel booking ───────────────────────────
router.put(
  '/:id/cancel',
  validate([param('id').isUUID().withMessage('Invalid booking ID')]),
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.cancel(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: 'Booking cancelled',
      data: booking,
    });
  })
);

// ── PUT /api/bookings/:id/reschedule — Reschedule booking ───────────────────
router.put(
  '/:id/reschedule',
  validate([
    param('id').isUUID().withMessage('Invalid booking ID'),
    body('startTime').isISO8601().withMessage('startTime must be ISO 8601'),
    body('endTime').isISO8601().withMessage('endTime must be ISO 8601'),
  ]),
  asyncHandler(async (req, res) => {
    const booking = await bookingsService.reschedule(
      req.params.id,
      req.body,
      req.user
    );
    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully',
      data: booking,
    });
  })
);

module.exports = router;