const express = require('express');
const categoryModel = require('../models/category');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();

router.get('/', asyncHandler(async (req, res) => res.json(await categoryModel.tree())));
router.get('/flat', asyncHandler(async (req, res) => res.json(await categoryModel.all())));
router.get('/:slug', asyncHandler(async (req, res) => {
  const c = await categoryModel.getBySlug(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Category not found.' });
  res.json(c);
}));

module.exports = router;