/**
 * Activity Logs Module — Routes + Controller (combined, since there's no service logic).
 * Reads from MongoDB ActivityLog collection.
 */

const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const asyncHandler = require('../../utils/asyncHandler');
const ActivityLog = require('../../models/mongo/ActivityLog');

const router = Router();

router.use(authenticate, requireRole(['ADMIN', 'ASSET_MANAGER']));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entityType, entityId, actorId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (actorId) filter.actorId = actorId;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    });
  })
);

module.exports = router;
