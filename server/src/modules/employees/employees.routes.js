const express = require('express');
const { body, query } = require('express-validator');
const employeesController = require('./employees.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('departmentId').optional().isUUID().withMessage('Invalid department ID format'),
  ]),
  employeesController.getAll
);

router.post(
  '/:id/promote',
  requireRole(['ADMIN']), // Only admins can promote users
  validate([
    body('role')
      .notEmpty()
      .isIn(['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'])
      .withMessage('Invalid role'),
  ]),
  employeesController.promote
);

module.exports = router;
