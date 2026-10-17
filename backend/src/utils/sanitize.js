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

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function sanitizeReviewComment(val) {
  if (typeof val !== 'string') return '';
  let clean = val.trim();
  // Strip null bytes
  clean = clean.replace(/\0/g, '');
  // Disallow pseudo-protocols like javascript:, vbscript:, data:
  clean = clean.replace(/(?:javascript|vbscript|data):/gi, '');
  // Disallow inline event handlers like onerror=, onload=, onclick=
  clean = clean.replace(/on\w+\s*=/gi, '');
  // Escape HTML entities to prevent Stored XSS
  return escapeHtml(clean);
}

module.exports = { sanitizeInput, sanitizeObject, escapeHtml, sanitizeReviewComment };
