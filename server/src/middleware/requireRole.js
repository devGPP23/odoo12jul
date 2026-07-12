/**
 * Role-based access control middleware.
 *
 * Usage:
 *   router.post('/assets', authenticate, requireRole(['ADMIN', 'ASSET_MANAGER']), controller.create);
 *
 * This checks the role only. Scope checks (e.g. "Dept Head can only act on
 * their own department") are done in the controller/service layer.
 */

const AppError = require('../utils/AppError');

/**
 * @param {string[]} allowedRoles - Array of EmployeeRole enum values
 */
function requireRole(allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = requireRole;
