/**
 * Validation middleware using express-validator.
 * Collects validation errors and throws a structured error if any exist.
 */

const { validationResult } = require('express-validator');

function validate(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.type = 'validation';
    error.statusCode = 422;
    error.errors = errors.array().map((e) => ({
      field: e.path,
      message: e.msg,
      value: e.value,
    }));
    return next(error);
  }
  next();
}

module.exports = validate;
