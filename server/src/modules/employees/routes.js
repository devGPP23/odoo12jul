/**
 * Employees Module — Routes.
 */

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Directory — accessible to Admin and Asset Manager for lookups
router.get(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  controller.getAll
);

router.get(
  '/:id',
  requireRole(['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD']),
  [param('id').isUUID()],
  validate,
  controller.getById
);

// Update employee details (not role) — Admin only
router.put(
  '/:id',
  requireRole(['ADMIN']),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('departmentId').optional({ values: 'null' }).isUUID(),
    body('status').optional().isIn(['ACTIVE', 'INACTIVE']),
    // NOTE: 'role' is explicitly NOT accepted here
  ],
  validate,
  controller.update
);

// Promote — THE ONLY endpoint that writes Employee.role
router.post(
  '/:id/promote',
  requireRole(['ADMIN']),
  [
    param('id').isUUID(),
    body('role')
      .isIn(['DEPARTMENT_HEAD', 'ASSET_MANAGER', 'EMPLOYEE'])
      .withMessage('Role must be DEPARTMENT_HEAD, ASSET_MANAGER, or EMPLOYEE'),
  ],
  validate,
  controller.promote
);

module.exports = router;
