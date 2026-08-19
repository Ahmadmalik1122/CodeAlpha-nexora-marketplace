const express = require('express');
const orderModel = require('../models/order');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, HttpError } = require('../utils/helpers');
const { buildInvoice } = require('../utils/invoice');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await orderModel.listByUser(req.user.id))));

router.post('/', validate({
  shipping_name: { required: true, minLen: 2, maxLen: 80, escape: true, label: 'Name' },
  shipping_phone: { maxLen: 30, escape: true },
  shipping_address: { required: true, minLen: 4, maxLen: 200, escape: true, label: 'Address' },
  shipping_city: { maxLen: 80, escape: true },
  shipping_postal: { maxLen: 20, escape: true },
  shipping_country: { maxLen: 80, escape: true },
  payment_method: { in: ['cod', 'card'], default: 'cod', label: 'Payment method' },
  coupon_code: { maxLen: 40 },
}), asyncHandler(async (req, res) => {
  res.status(201).json(await orderModel.createFromCart(req.user.id, req.valid));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const order = await orderModel.getForUser(req.user.id, Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json(order);
}));

router.post('/:id/cancel', asyncHandler(async (req, res) =>
  res.json(await orderModel.cancelByUser(req.user.id, Number(req.params.id)))));

// Downloadable invoice / receipt (HTML, print-to-PDF friendly).
router.get('/:id/invoice', asyncHandler(async (req, res) => {
  const order = await orderModel.getForUser(req.user.id, Number(req.params.id));
  if (!order) throw new HttpError(404, 'Order not found.');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildInvoice(order, req.user));
}));

module.exports = router;