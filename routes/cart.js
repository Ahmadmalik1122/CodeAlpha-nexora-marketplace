const express = require('express');
const cartModel = require('../models/cart');
const orderModel = require('../models/order');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await cartModel.getWithTotals(req.user.id))));

// Cart totals incl. shipping + optional coupon preview.
router.get('/quote', asyncHandler(async (req, res) => {
  const cart = await cartModel.getWithTotals(req.user.id);
  res.json({ ...cart, ...(await orderModel.quote(req.user.id, req.query.coupon)) });
}));

// Validate + apply a coupon to the cart (returns preview totals; coupon is
// persisted client-side and honoured at checkout via coupon_code).
router.post('/apply-coupon', validate({ code: { required: true, maxLen: 40 } }),
  asyncHandler(async (req, res) => {
    const quote = await orderModel.quote(req.user.id, req.valid.code);
    if (quote.couponError) return res.status(400).json({ error: quote.couponError });
    res.json({ coupon: { code: quote.coupon_code, discount: quote.discount }, ...quote });
  }));

router.post('/', validate({
  productId: { required: true, type: 'int', min: 1 },
  quantity: { type: 'int', min: 1, max: 99, default: 1 },
}), asyncHandler(async (req, res) => {
  res.status(201).json(await cartModel.add(req.user.id, req.valid.productId, req.valid.quantity));
}));

router.put('/:cartItemId', validate({ quantity: { required: true, type: 'int', min: 0, max: 99 } }),
  asyncHandler(async (req, res) => {
    res.json(await cartModel.update(req.user.id, Number(req.params.cartItemId), req.valid.quantity));
  }));

router.delete('/:cartItemId', asyncHandler(async (req, res) =>
  res.json(await cartModel.remove(req.user.id, Number(req.params.cartItemId)))));

router.delete('/', asyncHandler(async (req, res) => { await cartModel.clear(req.user.id); res.json({ items: [], subtotal: 0, count: 0 }); }));

module.exports = router;