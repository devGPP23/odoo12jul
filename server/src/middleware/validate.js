/**
 * Validation middleware using express-validator.
 * Collects validation errors and throws a structured error if any exist.
 */

const { validationResult } = require('express-validator');

function validate(validations) {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

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
  };
}

module.exports = validate;
