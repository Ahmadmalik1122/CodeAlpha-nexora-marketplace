const express = require('express');
const bcrypt = require('bcryptjs');
const userModel = require('../models/user');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await userModel.findById(req.user.id))));

router.put('/', validate({
  full_name: { required: true, minLen: 2, maxLen: 80, escape: true, label: 'Full name' },
  phone: { maxLen: 30, escape: true },
  address: { maxLen: 200, escape: true },
  city: { maxLen: 80, escape: true },
  postal_code: { maxLen: 20, escape: true },
  country: { maxLen: 80, escape: true },
}), asyncHandler(async (req, res) => res.json(await userModel.updateProfile(req.user.id, req.valid))));

router.put('/password', validate({
  current_password: { required: true },
  new_password: { required: true, minLen: 6, maxLen: 100, label: 'New password' },
}), asyncHandler(async (req, res) => {
  const full = await db.get('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!bcrypt.compareSync(req.valid.current_password, full.password_hash))
    return res.status(400).json({ error: 'Current password is incorrect.' });
  await userModel.updatePassword(req.user.id, bcrypt.hashSync(req.valid.new_password, 10));
  res.json({ ok: true, message: 'Password updated.' });
}));

module.exports = router;