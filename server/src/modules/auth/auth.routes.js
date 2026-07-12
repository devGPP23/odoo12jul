const express = require('express');
const { body } = require('express-validator');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.post(
  '/signup',
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]),
  authController.signup
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  authController.login
);

router.post(
  '/forgot-password',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
  ]),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate([
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ]),
  authController.resetPassword
);

router.post(
  '/refresh',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ]),
  authController.refreshToken
);

// Protected routes
router.use(authenticate);

router.get('/me', authController.getMe);

module.exports = router;
