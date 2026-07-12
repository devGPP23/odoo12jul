/**
 * Auth Module — Routes.
 */

const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const controller = require('./controller');

const router = Router();

router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('departmentId').optional().isUUID().withMessage('Invalid department ID'),
  ],
  validate,
  controller.signup
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.login
);

router.get('/me', authenticate, controller.getMe);

router.post('/logout', authenticate, controller.logout);

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  validate,
  controller.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  controller.resetPassword
);

module.exports = router;
