const express = require('express');
const { body, param } = require('express-validator');
const auditsController = require('./audits.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// All endpoints require authentication
router.use(authenticate);

// 4A.5: PUT /api/audit-items/:id — mark result (assigned auditor RBAC enforced in service)
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid audit item ID format'),
    body('result')
      .isIn(['VERIFIED', 'MISSING', 'DAMAGED'])
      .withMessage('result must be VERIFIED, MISSING, or DAMAGED'),
    body('notes').optional({ nullable: true }).isString().withMessage('notes must be a string')
  ]),
  auditsController.markItem
);

module.exports = router;
