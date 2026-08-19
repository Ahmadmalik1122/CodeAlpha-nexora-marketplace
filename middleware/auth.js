const db = require('../db/database');

// Load the current user (if any) onto req.user for every request.
function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    db.get(
      'SELECT id, full_name, email, phone, address, city, postal_code, country, role, is_active, store_name, seller_status FROM users WHERE id = $1',
      [req.session.userId]
    ).then((user) => {
      if (!user || !user.is_active) {
        // Account removed or deactivated mid-session.
        req.session.destroy(() => {});
        req.user = null;
      } else {
        req.user = user;
      }
      next();
    }).catch(next);
    return;
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: 'You must be logged in to do that.' });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Admin access required.' });
}

// Approved sellers only — ownership/role checks are enforced on the backend.
function requireSeller(req, res, next) {
  if (req.user && req.user.role === 'seller' && req.user.seller_status === 'approved') return next();
  if (req.user && req.user.role === 'seller' && req.user.seller_status !== 'approved')
    return res.status(403).json({ error: 'Your seller account is pending approval.' });
  return res.status(403).json({ error: 'Seller access required.' });
}

module.exports = { attachUser, requireAuth, requireAdmin, requireSeller };
