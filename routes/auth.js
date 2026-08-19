const express = require('express');
const bcrypt = require('bcryptjs');
const userModel = require('../models/user');
const db = require('../db/database');
const { validate } = require('../middleware/validate');
const { rateLimit } = require('../middleware/security');
const { asyncHandler, genToken } = require('../utils/helpers');
const { sendMail, resetPasswordEmail } = require('../utils/mailer');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many attempts. Try again in a few minutes.' });

const publicUser = (u) => ({
  id: u.id, full_name: u.full_name, email: u.email, role: u.role,
  store_name: u.store_name, seller_status: u.seller_status,
});

router.post('/register', authLimiter, validate({
  full_name: { required: true, minLen: 2, maxLen: 80, escape: true, label: 'Full name' },
  email: { required: true, type: 'email' },
  password: { required: true, minLen: 6, maxLen: 100 },
  role: { in: ['buyer', 'seller'], default: 'buyer', label: 'Account type' },
  store_name: { maxLen: 80, escape: true, label: 'Store name' },
}), asyncHandler(async (req, res) => {
  const { full_name, email, password, role, store_name } = req.valid;
  if (await userModel.findByEmail(email)) return res.status(409).json({ error: 'An account with that email already exists.' });
  const user = await userModel.create({ full_name, email, password_hash: bcrypt.hashSync(password, 10), role, store_name });
  req.session.userId = user.id;
  res.status(201).json({ user: publicUser(user), message: role === 'seller'
    ? 'Account created. Your seller application is pending approval.'
    : 'Welcome to Nexora Marketplace!' });
}));

router.post('/login', authLimiter, validate({
  email: { required: true, type: 'email' },
  password: { required: true },
}), asyncHandler(async (req, res) => {
  const { email, password } = req.valid;
  const user = await userModel.findByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password.' });
  if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated.' });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true }); });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

// Password reset — emails a real reset link via Gmail SMTP (utils/mailer.js).
router.post('/request-reset', authLimiter, validate({ email: { required: true, type: 'email' } }),
  asyncHandler(async (req, res) => {
    const user = await userModel.findByEmail(req.valid.email);
    if (user) {
      const token = genToken(24);
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await db.run('INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1,$2,$3)',
        [user.id, token, expires]);
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
      const sent = await sendMail({ to: user.email, ...resetPasswordEmail({ resetUrl }) });
      if (!sent && process.env.NODE_ENV !== 'production') {
        // Mail not configured locally — surface the link so dev flow still works.
        return res.json({ ok: true, message: 'Email not configured — showing link for local testing.', reset_url: resetUrl });
      }
    }
    // Same response whether or not the email exists, so we don't leak account existence.
    res.json({ ok: true, message: 'If that email exists, a password reset link has been sent to it.' });
  }));

router.post('/reset-password', authLimiter, validate({
  token: { required: true },
  password: { required: true, minLen: 6, maxLen: 100 },
}), asyncHandler(async (req, res) => {
  const { token, password } = req.valid;
  const row = await db.get('SELECT * FROM password_resets WHERE token = $1', [token]);
  if (!row || row.used || new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  await userModel.updatePassword(row.user_id, bcrypt.hashSync(password, 10));
  await db.run('UPDATE password_resets SET used = 1 WHERE id = $1', [row.id]);
  res.json({ ok: true, message: 'Password updated. You can now log in.' });
}));

module.exports = router;