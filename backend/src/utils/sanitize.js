/**
 * Sanitize user input to protect against Stored XSS
 */
function sanitizeInput(val) {
  if (typeof val !== 'string') return val;
  // Strip HTML tags and angle brackets
  return val.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim();
}

function sanitizeObject(obj, fields) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const field of fields) {
    if (obj[field] !== undefined && typeof obj[field] === 'string') {
      obj[field] = sanitizeInput(obj[field]);
    }
  }
  return obj;
}

module.exports = { sanitizeInput, sanitizeObject };
