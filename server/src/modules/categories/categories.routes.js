const express = require('express');
const { body } = require('express-validator');
const categoriesController = require('./categories.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    body('name').notEmpty().withMessage('Category name is required'),
    body('customFields').optional().isObject().withMessage('Custom fields must be an object'),
  ]),
  categoriesController.create
);

router.get('/', categoriesController.getAll);

router.get('/:id', categoriesController.getById);

router.put(
  '/:id',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  validate([
    body('name').optional().notEmpty().withMessage('Category name cannot be empty'),
    body('customFields').optional().isObject().withMessage('Custom fields must be an object'),
  ]),
  categoriesController.update
);

router.delete(
  '/:id',
  requireRole(['ADMIN', 'ASSET_MANAGER']),
  categoriesController.delete
);

module.exports = router;
