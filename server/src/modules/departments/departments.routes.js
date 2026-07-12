const express = require('express');
const { body } = require('express-validator');
const departmentsController = require('./departments.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  requireRole(['ADMIN']),
  validate([
    body('name').notEmpty().withMessage('Department name is required'),
    body('parentDepartmentId').optional().isUUID().withMessage('Invalid parent ID'),
  ]),
  departmentsController.create
);

router.get('/', departmentsController.getAll);

router.get('/:id', departmentsController.getById);

router.put(
  '/:id',
  requireRole(['ADMIN']),
  validate([
    body('name').optional().notEmpty().withMessage('Department name cannot be empty'),
    body('parentDepartmentId').optional().isUUID().withMessage('Invalid parent ID'),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']).withMessage('Invalid status'),
  ]),
  departmentsController.update
);

router.put(
  '/:id/assign-head',
  requireRole(['ADMIN']),
  validate([
    body('employeeId').notEmpty().withMessage('Employee ID is required').isUUID().withMessage('Invalid employee ID'),
  ]),
  departmentsController.assignHead
);

module.exports = router;
