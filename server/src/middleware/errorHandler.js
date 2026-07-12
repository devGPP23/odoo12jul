// Centralized Error Handler
// Saare errors yahan catch honge (Prisma, Postgres 23P01, JWT, etc.)

const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Prisma Errors
  if (err.code === 'P2002') {
    statusCode = 409;
    const target = err.meta?.target;
    message = `Ye record pehle se exist karta hai: ${target ? target.join(', ') : 'value'}`;
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record nahi mila bhai.';
  }

  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Jisko reference kar rahe ho wo exist nahi karta.';
  }

  // Postgres 23P01 (Booking overlap check using GiST)
  if (
    err.code === '23P01' ||
    (err.message && err.message.includes('exclusion constraint'))
  ) {
    statusCode = 409;
    message = 'Booking conflict hai, time slot overlap ho raha hai.';
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token galat hai.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expire ho gaya.';
  }

  // validation errors (express-validator)
  if (err.type === 'validation') {
    statusCode = 422;
    message = 'Validation fail ho gaya.';
    details = err.errors;
  }

  // 500 errors pe terminal pe log marna zaroori hai
  if (statusCode >= 500) {
    console.error('🔥 Server phat gaya:', {
      message: err.message,
      stack: config.isDev ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    ...(config.isDev && statusCode >= 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
