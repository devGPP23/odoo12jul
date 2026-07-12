/**
 * Asset Categories Module — Routes.
 */

const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');
const controller = require('./controller');

const router = Router();

router.use(authenticate);

// Read access for anyone authenticated (needed for asset registration dropdowns)
router.get('/', controller.getAll);
router.get('/:id', [param('id').isUUID()], validate, controller.getById);

// Write access — Admin only
router.post(
  '/',
  requireRole(['ADMIN']),
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('customFields').optional().isObject(),
  ],
  validate,
  controller.create
);

router.put(
  '/:id',
  requireRole(['ADMIN']),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('customFields').optional().isObject(),
  ],
  validate,
  controller.update
);

router.delete(
  '/:id',
  requireRole(['ADMIN']),
  [param('id').isUUID()],
  validate,
  controller.remove
);

module.exports = router;
