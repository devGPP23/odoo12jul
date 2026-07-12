// NoSQL Injection se bachne ka jugaad
// req.body wagera me se $ aur . wale keys replace kar deta hai

const mongoSanitize = require('express-mongo-sanitize');

const sanitizer = mongoSanitize({
  // Key drop karne ke bajaye underscore daal do
  replaceWith: '_',
});

module.exports = sanitizer;
