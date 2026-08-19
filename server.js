// Nexora Marketplace — application entry point.
const path = require('path');
const { loadEnv, securityHeaders, csrfToken, csrfProtect } = require('./middleware/security');
loadEnv(); // populate process.env from .env before anything reads it

const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { attachUser } = require('./middleware/auth');
const { apiNotFound, errorHandler } = require('./middleware/error');
const { HttpError } = require('./utils/helpers');
const { pool } = require('./db/database');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(securityHeaders());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Persistent session store backed by PostgreSQL (survives restarts/deploys).
const store = new PgSession({ pool, createTableIfMissing: true });
app.use(session({
  store,
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'nexora-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  },
}));

app.use(attachUser);
app.use(csrfToken);

// Expose CSRF token to the frontend (also primes the session cookie).
app.get('/api/csrf-token', (req, res) => res.json({ csrfToken: req.session.csrfToken }));

// Enforce CSRF on all state-changing API requests.
app.use('/api', csrfProtect);

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/account', require('./routes/account'));
app.use('/api/seller', require('./routes/seller'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', apiNotFound);

// Guard role pages server-side — non-role users get redirected to login.
app.get(['/admin', '/admin.html'], (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.redirect('/login.html?redirect=/admin.html');
});
app.get(['/seller', '/seller.html'], (req, res, next) => {
  if (req.user && req.user.role === 'seller') return next();
  return res.redirect('/login.html?redirect=/seller.html');
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Unknown non-API GET -> 404 page
app.use((req, res, next) => next(new HttpError(404, 'Page not found.')));
app.use(errorHandler);

// Start the server only when run directly (allows in-process testing via require).
if (require.main === module) {
  app.listen(PORT, process.env.HOST, () =>
    console.log(`Nexora Marketplace running at http://localhost:${PORT}`));
}

module.exports = app;