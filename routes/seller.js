const express = require('express');
const db = require('../db/database');
const productModel = require('../models/product');
const orderModel = require('../models/order');
const userModel = require('../models/user');
const reviewModel = require('../models/review');
const upload = require('../middleware/upload');
const { requireAuth, requireSeller } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireSeller);

// ---- Dashboard / overview ----
router.get('/overview', asyncHandler(async (req, res) => {
  const analytics = await orderModel.sellerAnalytics(req.user.id);
  res.json({
    ...analytics,
    lowStockItems: await productModel.lowStock(5, req.user.id),
    topSelling: (await productModel.list({ sellerId: req.user.id, sort: 'best_selling', perPage: 5 })).items,
  });
}));

// ---- Store settings ----
router.get('/store', asyncHandler(async (req, res) => res.json(await userModel.findById(req.user.id))));
router.put('/store', asyncHandler(async (req, res) => {
  const d = req.body;
  if (!d.store_name || !String(d.store_name).trim()) throw new HttpError(400, 'Store name is required.');
  res.json(await userModel.updateStore(req.user.id, {
    store_name: String(d.store_name).slice(0, 80),
    store_description: d.store_description ? String(d.store_description).slice(0, 500) : '',
    store_logo: d.store_logo || null,
  }));
}));

// ---- Product management (ownership enforced below) ----
function parseProductBody(b) {
  let images = b.images;
  if (typeof images === 'string') images = images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(images)) images = [];
  const price = Number(b.price);
  if (!b.title || !b.title.trim()) throw new HttpError(400, 'Title is required.');
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'A valid price is required.');
  let discount = b.discount_price === '' || b.discount_price == null ? null : Number(b.discount_price);
  if (discount != null && (!Number.isFinite(discount) || discount < 0)) discount = null;
  let specs = {};
  try { specs = (typeof b.specifications === 'string' && b.specifications.trim())
    ? JSON.parse(b.specifications) : (b.specifications && typeof b.specifications === 'object' ? b.specifications : {}); }
  catch { specs = {}; }
  return {
    title: b.title.trim(), description: b.description || '', sku: b.sku || null,
    price, discount_price: discount, stock: parseInt(b.stock, 10) || 0,
    category_id: b.category_id ? Number(b.category_id) : null,
    brand: b.brand || '', warranty: b.warranty || '', specifications: specs,
    tags: b.tags || '', images, is_featured: b.is_featured === true || b.is_featured === '1' || b.is_featured === 'on',
    // Seller-created products require admin approval before going live.
    is_approved: 0,
  };
}

router.get('/products', asyncHandler(async (req, res) =>
  res.json(await productModel.list({ sellerId: req.user.id, search: req.query.search,
    sort: req.query.sort || 'newest', page: req.query.page, perPage: req.query.perPage || 50, approved: null }))));
router.post('/products', asyncHandler(async (req, res) =>
  res.status(201).json(await productModel.create({ ...parseProductBody(req.body), seller_id: req.user.id }))));
router.put('/products/:id', asyncHandler(async (req, res) => {
  const existing = await productModel.getById(Number(req.params.id));
  if (!existing || existing.seller_id !== req.user.id) throw new HttpError(403, 'You can only edit your own products.');
  // Re-submitting a product requires re-approval.
  const p = await productModel.update(existing.id, { ...parseProductBody(req.body), is_approved: 0 });
  res.json(p);
}));
router.delete('/products/:id', asyncHandler(async (req, res) => {
  if (!(await productModel.removeBySeller(req.user.id, Number(req.params.id))))
    throw new HttpError(403, 'You can only delete your own products.');
  res.json({ ok: true });
}));

// ---- Image upload ----
router.post('/uploads', upload.single('image'), asyncHandler((req, res) => {
  if (!upload.available) return res.status(501).json({ error: 'File upload requires the "multer" package. Use an image URL instead.' });
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
}));

// ---- Orders (only those containing this seller's products) ----
router.get('/orders', asyncHandler(async (req, res) =>
  res.json(await orderModel.listBySeller(req.user.id, { status: req.query.status, page: req.query.page, perPage: req.query.perPage }))));
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const o = await orderModel.getForSeller(req.user.id, Number(req.params.id));
  if (!o) throw new HttpError(404, 'Order not found.');
  res.json(o);
}));
router.put('/orders/:id/status', asyncHandler(async (req, res) =>
  res.json(await orderModel.updateStatusBySeller(req.user.id, Number(req.params.id), req.body.status))));

// ---- Reviews on own products ----
router.get('/reviews', asyncHandler(async (req, res) => {
  const rows = await db.all(
    `SELECT r.id, r.rating, r.title, r.comment, r.verified, r.created_at,
            p.title AS product_title, p.id AS product_id, u.full_name AS author
     FROM reviews r
     JOIN products p ON p.id = r.product_id AND p.seller_id = $1
     JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC LIMIT 200`,
    [req.user.id]);
  res.json(rows);
}));

module.exports = router;