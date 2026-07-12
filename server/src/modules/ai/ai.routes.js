const express = require('express');
const { body, param, query } = require('express-validator');
const aiController = require('./ai.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// All AI endpoints require authentication
router.use(authenticate);

// 5A.2: POST /api/ai/search — NL asset search
router.post(
  '/search',
  validate([
    body('query').optional().notEmpty().withMessage('query cannot be empty'),
    body('q').optional().notEmpty().withMessage('q cannot be empty')
  ]),
  aiController.nlSearch
);

// 5A.3: GET /api/ai/maintenance-risk/:assetId
router.get(
  '/maintenance-risk/:assetId',
  validate([
    param('assetId').isUUID().withMessage('Invalid asset ID format')
  ]),
  aiController.maintenanceRisk
);

// 5A.4: GET /api/ai/audit-insights/:cycleId
router.get(
  '/audit-insights/:cycleId',
  validate([
    param('cycleId').isUUID().withMessage('Invalid cycle ID format')
  ]),
  aiController.auditInsights
);

// 5A.5: GET /api/ai/report-summary?type=utilization
router.get(
  '/report-summary',
  validate([
    query('type')
      .isIn(['utilization', 'maintenance', 'audit'])
      .withMessage('type must be utilization, maintenance, or audit')
  ]),
  aiController.reportSummary
);

module.exports = router;
