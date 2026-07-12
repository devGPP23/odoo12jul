// basic input sanitizer to remove html tags and prevent simple xss
const sanitizeInput = (req, res, next) => {
  const cleanData = (data) => {
    if (typeof data === 'string') {
      return data.replace(/<[^>]*>?/gm, ''); // strips html tags
    }
    
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach((key) => {
        data[key] = cleanData(data[key]);
      });
    }
    
    return data;
  };

  if (req.body) req.body = cleanData(req.body);
  if (req.query) req.query = cleanData(req.query);
  if (req.params) req.params = cleanData(req.params);

  next();
};

module.exports = sanitizeInput;
