/**
 * Validation middleware using express-validator.
 * Returns an array of validation middlewares followed by an error checker.
 */

const { validationResult } = require('express-validator');

function validate(validations) {
  return [
    ...validations,
    (req, _res, next) => {
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
  ];
}

module.exports = validate;
