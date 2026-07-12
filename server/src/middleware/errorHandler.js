/**
 * Centralized error handler.
 * Catches all errors, including:
 * - AppError (operational, expected)
 * - Prisma unique constraint violations (P2002)
 * - Postgres exclusion constraint errors (23P01 — booking overlaps)
 * - Validation errors from express-validator
 * - Unexpected errors (500)
 */

const config = require('../config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  // Default to 500
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // ── Prisma errors ──────────────────────────────────────────
  if (err.code === 'P2002') {
    // Unique constraint violation
    statusCode = 409;
    const target = err.meta?.target;
    message = `A record with this ${target ? target.join(', ') : 'value'} already exists.`;
  }

  if (err.code === 'P2025') {
    // Record not found
    statusCode = 404;
    message = 'Record not found.';
  }

  if (err.code === 'P2003') {
    // Foreign key constraint failed
    statusCode = 400;
    message = 'Referenced record does not exist.';
  }

  // ── Postgres exclusion constraint (booking overlap) ────────
  // Prisma wraps raw query errors; the Postgres error code 23P01 appears
  // in the error message or in err.code for raw queries.
  if (
    err.code === '23P01' ||
    (err.message && err.message.includes('exclusion constraint'))
  ) {
    statusCode = 409;
    message = 'Booking conflict: the requested time slot overlaps with an existing booking.';
  }

  // ── JWT errors ─────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired.';
  }

  // ── express-validator errors ───────────────────────────────
  if (err.type === 'validation') {
    statusCode = 422;
    message = 'Validation failed.';
    details = err.errors;
  }

  // ── Log server errors ─────────────────────────────────────
  if (statusCode >= 500) {
    console.error('🔥 Server Error:', {
      message: err.message,
      stack: config.isDev ? err.stack : undefined,
      path: req.path,
      method: req.method,
    });
  }

  // ── Response ──────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    ...(config.isDev && statusCode >= 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
