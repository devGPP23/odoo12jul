/**
 * Input Sanitizer Middleware.
 * Uses express-mongo-sanitize to prevent NoSQL injection by removing keys
 * that start with $ or contain periods (.), which are used as operators in MongoDB.
 */

const mongoSanitize = require('express-mongo-sanitize');

const sanitizer = mongoSanitize({
  // Replace prohibited characters rather than dropping the field entirely
  replaceWith: '_',
  // Executed on req.body, req.query, req.params, and req.headers
});

module.exports = sanitizer;
