const AppError = require('../utils/AppError');

// Role check karne ka middleware
// Note: Isme sirf role check ho raha hai. Agar scope check karna hai (jaise "apna data hi dekh sakta hai"), 
// toh wo controller me karna padega bhai.
function requireRole(allowedRoles) {
  return (req, _res, next) => {
    // Agar token verify nahi hua auth me, toh block kar do
    if (!req.user) {
      return next(new AppError('Auth token nahi mila bhai, login karle pehle.', 401));
    }

    // Role check
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Ye karne ke liye ${allowedRoles.join(' ya ')} hona zaroori hai, tera role ${req.user.role} hai.`,
          403
        )
      );
    }

    next();
  };
}

module.exports = requireRole;
