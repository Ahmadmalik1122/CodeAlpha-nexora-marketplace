const express = require('express');
const productModel = require('../models/product');
const categoryModel = require('../models/category');
const orderModel = require('../models/order');
const couponModel = require('../models/coupon');
const userModel = require('../models/user');
const reviewModel = require('../models/review');
const upload = require('../middleware/upload');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---- Analytics dashboard ----
router.get('/analytics', asyncHandler(async (req, res) => {
  res.json({
    ...(await orderModel.analytics()),
    topSelling: await productModel.topSelling(5),
    lowStock: await productModel.lowStock(5),
  });
}));

// ---- Product CRUD ----
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
    seller_id: b.seller_id ? Number(b.seller_id) : null,
    brand: b.brand || '', warranty: b.warranty || '', specifications: specs,
    tags: b.tags || '', images, is_featured: b.is_featured === true || b.is_featured === '1' || b.is_featured === 'on',
    is_approved: b.is_approved === undefined ? 1 : (b.is_approved === true || b.is_approved === '1' || b.is_approved === 'on'),
  };
}

router.get('/products', asyncHandler(async (req, res) =>
  res.json(await productModel.list({ search: req.query.search, sort: req.query.sort || 'newest',
    page: req.query.page, perPage: req.query.perPage || 50, approved: null }))));
router.post('/products', asyncHandler(async (req, res) => res.status(201).json(await productModel.create(parseProductBody(req.body)))));
router.put('/products/:id', asyncHandler(async (req, res) => {
  const p = await productModel.update(Number(req.params.id), parseProductBody(req.body));
  if (!p) throw new HttpError(404, 'Product not found.');
  res.json(p);
}));
router.put('/products/:id/approve', asyncHandler(async (req, res) => {
  const p = await productModel.update(Number(req.params.id), { is_approved: req.body.is_approved === true || req.body.is_approved === 1 });
  if (!p) throw new HttpError(404, 'Product not found.');
  res.json(p);
}));
router.delete('/products/:id', asyncHandler(async (req, res) => {
  if (!(await productModel.remove(Number(req.params.id)))) throw new HttpError(404, 'Product not found.');
  res.json({ ok: true });
}));

// ---- Image upload (multer if installed) ----
router.post('/uploads', upload.single('image'), asyncHandler((req, res) => {
  if (!upload.available) return res.status(501).json({ error: 'File upload requires the "multer" package. Use an image URL instead, or run: npm install multer' });
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
}));

// ---- Category CRUD ----
router.get('/categories', asyncHandler(async (req, res) => res.json(await categoryModel.tree())));
router.post('/categories', asyncHandler(async (req, res) => {
  if (!req.body.name) throw new HttpError(400, 'Name is required.');
  res.status(201).json(await categoryModel.create(req.body));
}));
router.put('/categories/:id', asyncHandler(async (req, res) => {
  const c = await categoryModel.update(Number(req.params.id), req.body);
  if (!c) throw new HttpError(404, 'Category not found.');
  res.json(c);
}));
router.delete('/categories/:id', asyncHandler(async (req, res) => {
  if (!(await categoryModel.remove(Number(req.params.id)))) throw new HttpError(404, 'Category not found.');
  res.json({ ok: true });
}));

// ---- Order management ----
router.get('/orders', asyncHandler(async (req, res) =>
  res.json(await orderModel.adminList({ status: req.query.status, page: req.query.page, perPage: req.query.perPage }))));
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const o = await orderModel.adminGet(Number(req.params.id));
  if (!o) throw new HttpError(404, 'Order not found.');
  res.json(o);
}));
router.put('/orders/:id/status', asyncHandler(async (req, res) => res.json(await orderModel.updateStatus(Number(req.params.id), req.body.status))));
router.put('/orders/:id/payment', asyncHandler(async (req, res) => res.json(await orderModel.updatePayment(Number(req.params.id), req.body.payment_status))));
router.put('/orders/:id/tracking', asyncHandler(async (req, res) => res.json(await orderModel.setTracking(Number(req.params.id), String(req.body.tracking_number || '').slice(0, 60)))));

// ---- User management ----
router.get('/users', asyncHandler(async (req, res) => res.json(await userModel.list())));
router.put('/users/:id/role', asyncHandler(async (req, res) => {
  const role = ['buyer', 'seller', 'admin'].includes(req.body.role) ? req.body.role : 'buyer';
  if (Number(req.params.id) === req.user.id && role !== 'admin')
    throw new HttpError(400, 'You cannot remove your own admin role.');
  await userModel.setRole(Number(req.params.id), role);
  if (role !== 'seller') await userModel.setSellerStatus(Number(req.params.id), 'approved');
  res.json({ ok: true, role });
}));
router.put('/users/:id/active', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'You cannot deactivate your own account.');
  await userModel.setActive(Number(req.params.id), !!req.body.is_active);
  res.json({ ok: true });
}));

// ---- Seller management ----
router.get('/sellers', asyncHandler(async (req, res) => res.json(await userModel.listSellers())));
router.put('/sellers/:id/status', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(status))
    throw new HttpError(400, 'Invalid seller status.');
  const seller = await userModel.findById(id);
  if (!seller || seller.role !== 'seller') throw new HttpError(404, 'Seller not found.');
  await userModel.setSellerStatus(id, status);
  res.json(await userModel.findById(id));
}));

// ---- Reviews moderation ----
router.get('/reviews', asyncHandler(async (req, res) =>
  res.json(await reviewModel.adminList({ page: req.query.page, perPage: req.query.perPage || 50 }))));
router.delete('/reviews/:id', asyncHandler(async (req, res) => {
  if (!(await reviewModel.adminRemove(Number(req.params.id)))) throw new HttpError(404, 'Review not found.');
  res.json({ ok: true });
}));

// ---- Coupon management ----
router.get('/coupons', asyncHandler(async (req, res) => res.json(await couponModel.all())));
router.post('/coupons', asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.code || !['percent', 'fixed'].includes(b.type) || !Number.isFinite(Number(b.value)))
    throw new HttpError(400, 'Code, type (percent/fixed) and a numeric value are required.');
  res.status(201).json(await couponModel.create({ ...b, active: b.active === undefined ? 1 : (b.active ? 1 : 0) }));
}));
router.put('/coupons/:id', asyncHandler(async (req, res) => {
  const c = await couponModel.update(Number(req.params.id), req.body);
  if (!c) throw new HttpError(404, 'Coupon not found.');
  res.json(c);
}));
router.delete('/coupons/:id', asyncHandler(async (req, res) => {
  if (!(await couponModel.remove(Number(req.params.id)))) throw new HttpError(404, 'Coupon not found.');
  res.json({ ok: true });
}));

module.exports = router;