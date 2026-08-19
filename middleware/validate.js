// Lightweight validation + sanitization (dependency-free).
// Prefers express-validator's sanitizers when installed, else uses built-ins.
const { escapeHtml } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * validate(schema) -> express middleware.
 * schema: { field: { required, type, min, max, minLen, maxLen, in, escape, label, default } }
 * type: 'email' | 'int' | 'number' | 'string'(default) | 'bool'
 * On success sets req.valid with cleaned values. On failure -> 400 {error, errors}.
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const data = {};
    for (const [field, rule] of Object.entries(schema)) {
      const label = rule.label || field;
      let v = req.body[field];

      const empty = v === undefined || v === null || v === '';
      if (empty) {
        if (rule.required) { errors.push(`${label} is required.`); continue; }
        if (rule.default !== undefined) { data[field] = rule.default; }
        continue;
      }

      if (typeof v === 'string' && rule.trim !== false) v = v.trim();

      switch (rule.type) {
        case 'email':
          v = String(v).toLowerCase();
          if (!EMAIL_RE.test(v)) errors.push(`${label} must be a valid email address.`);
          break;
        case 'int':
        case 'number': {
          let n = Number(v);
          if (!Number.isFinite(n)) { errors.push(`${label} must be a number.`); break; }
          if (rule.type === 'int') n = Math.trunc(n);
          if (rule.min != null && n < rule.min) errors.push(`${label} must be at least ${rule.min}.`);
          if (rule.max != null && n > rule.max) errors.push(`${label} must be at most ${rule.max}.`);
          v = n;
          break;
        }
        case 'bool':
          v = v === true || v === 'true' || v === 1 || v === '1';
          break;
        default: // string
          v = String(v);
          if (rule.minLen && v.length < rule.minLen) errors.push(`${label} must be at least ${rule.minLen} characters.`);
          if (rule.maxLen && v.length > rule.maxLen) errors.push(`${label} must be at most ${rule.maxLen} characters.`);
          if (rule.escape) v = escapeHtml(v); // XSS: neutralise HTML in free text
          if (rule.lower) v = v.toLowerCase();
      }

      if (rule.in && !rule.in.includes(v)) errors.push(`${label} is invalid.`);
      data[field] = v;
    }

    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    req.valid = data;
    next();
  };
}

module.exports = { validate };
