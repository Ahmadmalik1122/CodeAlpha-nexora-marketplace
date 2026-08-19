// Security helpers: env loading, HTTP security headers, CSRF, rate limiting.
// All work with zero external deps; use real packages (dotenv/helmet) if installed.
const fs = require('fs');
const path = require('path');

// --- Environment variables (dotenv if available, else tiny parser) ---
function loadEnv() {
  try {
    require('dotenv').config();
    return;
  } catch { /* dotenv not installed - fall back */ }
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

// --- Security headers (helmet if available, else manual) ---
function securityHeaders() {
  try {
    return require('helmet')({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'https:', 'data:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
    });
  } catch { /* helmet not installed */ }
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'");
    next();
  };
}

// --- CSRF (double-submit token stored in session, checked on mutations) ---
function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(24).toString('hex');
  }
  next();
}

function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('X-CSRF-Token') || (req.body && req.body._csrf);
  if (!sent || sent !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh and try again.' });
  }
  next();
}

// --- Simple in-memory rate limiter (per IP) ---
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, message } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(key, rec); }
    rec.count += 1;
    if (rec.count > max) {
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    next();
  };
}

module.exports = { loadEnv, securityHeaders, csrfToken, csrfProtect, rateLimit };
