const express = require('express');
const productModel = require('../models/product');
const categoryModel = require('../models/category');
const reviewModel = require('../models/review');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler, HttpError } = require('../utils/helpers');
const router = express.Router();

const resolve = (key) =>
  /^\d+$/.test(key) ? productModel.getById(Number(key)) : productModel.getBySlug(key);

// GET /api/products  (search, filters, sort, pagination)
router.get('/', asyncHandler(async (req, res) => {
  const q = req.query;
  let categoryId = null;
  if (q.category && q.category !== 'all') {
    if (/^\d+$/.test(q.category)) categoryId = Number(q.category);
    else { const c = await categoryModel.getBySlug(q.category); categoryId = c ? c.id : -1; }
  }
  // Collect spec_* filters (e.g. ?spec_socket=AM5&spec_capacity=32) into an object.
  const specs = {};
  for (const key of Object.keys(q)) if (key.startsWith('spec_') && q[key]) specs[key.slice(5)] = q[key];
  res.json(await productModel.list({
    search: q.search ? String(q.search).slice(0, 100) : undefined,
    categoryId,
    brand: q.brand ? String(q.brand).slice(0, 60) : null,
    sellerName: q.seller ? String(q.seller).slice(0, 60) : null,
    minPrice: q.min ? Number(q.min) : null,
    maxPrice: q.max ? Number(q.max) : null,
    minRating: q.rating ? Number(q.rating) : null,
    inStock: q.inStock === '1' || q.inStock === 'true',
    onSale: q.onSale === '1' || q.onSale === 'true',
    sort: q.sort,
    page: q.page,
    perPage: q.perPage,
    specs,
  }));
}));

// GET /api/products/brands — distinct brands for the filter sidebar.
router.get('/brands', asyncHandler(async (req, res) => res.json(await productModel.brands())));

// GET /api/products/:key  (id or slug) with reviews + related
router.get('/:key', asyncHandler(async (req, res) => {
  const product = await resolve(req.params.key);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!product.is_approved && (!req.user || req.user.role !== 'admin'))
    return res.status(404).json({ error: 'Product not found.' });
  product.reviews = await reviewModel.listByProduct(product.id);
  product.related = await productModel.related(product, 4);
  product.can_review = req.user ? await reviewModel.hasPurchased(req.user.id, product.id) : false;
  product.has_reviewed = req.user
    ? !!(await db.get('SELECT 1 FROM reviews WHERE product_id = $1 AND user_id = $2', [product.id, req.user.id]))
    : false;
  res.json(product);
}));

// POST /api/products/:key/reviews — verified buyers only, one per product.
router.post('/:key/reviews', requireAuth, validate({
  rating: { required: true, type: 'int', min: 1, max: 5 },
  title: { maxLen: 120, escape: true, default: '' },
  comment: { maxLen: 1000, escape: true, default: '' },
}), asyncHandler(async (req, res) => {
  const product = await resolve(req.params.key);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!(await reviewModel.hasPurchased(req.user.id, product.id)))
    return res.status(403).json({ error: 'Only verified buyers who purchased this product can review it.' });
  await reviewModel.upsert(product.id, req.user.id, req.valid.rating, req.valid.title, req.valid.comment);
  res.status(201).json({ reviews: await reviewModel.listByProduct(product.id), product: await productModel.getById(product.id) });
}));

module.exports = router;