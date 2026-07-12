/**
 * Departments Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

// All department management is Admin-only
router.use(authenticate, requireRole(['ADMIN']));

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('parentDepartmentId').optional().isUUID(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  ],
  validate,
  controller.create
);

router.get('/', controller.getAll);

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  controller.getById
);

router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('parentDepartmentId').optional({ values: 'null' }).isUUID(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
  ],
  validate,
  controller.update
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  controller.remove
);

router.post(
  '/:id/assign-head',
  [
    param('id').isUUID(),
    body('headEmployeeId').isUUID().withMessage('Valid employee ID is required'),
  ],
  validate,
  controller.assignHead
);

module.exports = router;
