/**
 * Custom application error with HTTP status code.
 * Used throughout services to throw meaningful errors that
 * the centralized error handler can translate to proper HTTP responses.
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {object} [details] - Optional extra data (e.g. conflicting holder info)
   */
  constructor(message, statusCode, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
