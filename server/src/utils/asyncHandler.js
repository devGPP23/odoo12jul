/**
 * Wraps an async Express handler so thrown errors are forwarded to next().
 * Eliminates try/catch boilerplate in every controller function.
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
