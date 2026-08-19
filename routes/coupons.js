const express = require('express');
const couponModel = require('../models/coupon');
const cartModel = require('../models/cart');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();

// Validate a coupon against the current user's cart subtotal.
router.post('/validate', requireAuth, validate({ code: { required: true, maxLen: 40 } }),
  asyncHandler(async (req, res) => {
    const { subtotal } = await cartModel.getWithTotals(req.user.id);
    const result = await couponModel.validate(req.valid.code, subtotal);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ code: result.coupon.code, type: result.coupon.type, value: result.coupon.value, discount: result.discount });
  }));

module.exports = router;