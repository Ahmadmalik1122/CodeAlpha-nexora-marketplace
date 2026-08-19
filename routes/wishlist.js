const express = require('express');
const wishlistModel = require('../models/wishlist');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => res.json(await wishlistModel.list(req.user.id))));
router.post('/toggle', validate({ productId: { required: true, type: 'int', min: 1 } }),
  asyncHandler(async (req, res) => res.json(await wishlistModel.toggle(req.user.id, req.valid.productId))));
router.delete('/:productId', asyncHandler(async (req, res) => {
  await wishlistModel.remove(req.user.id, Number(req.params.productId));
  res.json(await wishlistModel.list(req.user.id));
}));

module.exports = router;