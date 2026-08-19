const db = require('../db/database');
const coupon = require('./coupon');
const { money, effectivePrice, HttpError } = require('../utils/helpers');

const SHIP_FEE = () => Number(process.env.SHIPPING_FEE || 350);
const FREE_OVER = () => Number(process.env.FREE_SHIP_THRESHOLD || 25000);

// Quote totals for the current cart without persisting (used by cart/checkout UI).
async function quote(userId, couponCode) {
  const rows = await db.all(
    `SELECT ci.quantity, p.price, p.discount_price FROM cart_items ci
     JOIN products p ON p.id = ci.product_id WHERE ci.user_id = $1`,
    [userId]);
  const subtotal = money(rows.reduce((s, i) => s + effectivePrice(i) * i.quantity, 0));
  let discount = 0, code = null, couponError = null;
  if (couponCode) {
    const v = await coupon.validate(couponCode, subtotal);
    if (v.error) couponError = v.error;
    else { discount = v.discount; code = v.coupon.code; }
  }
  const shipping_fee = subtotal > 0 && subtotal < FREE_OVER() ? SHIP_FEE() : 0;
  const total = money(subtotal - discount + shipping_fee);
  return { subtotal, discount, coupon_code: code, couponError, shipping_fee,
    free_shipping_threshold: FREE_OVER(), total };
}

async function createFromCart(userId, o) {
  const orderId = await db.transaction(async (client) => {
    const rowsRes = await client.query(
      `SELECT ci.quantity, p.id AS product_id, p.title, p.price, p.discount_price, p.stock, p.seller_id
       FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = $1`,
      [userId]);
    const rows = rowsRes.rows;
    if (rows.length === 0) throw new HttpError(400, 'Your cart is empty.');
    for (const it of rows)
      if (it.stock < it.quantity) throw new HttpError(400, `Not enough stock for "${it.title}".`);

    const subtotal = money(rows.reduce((s, i) => s + effectivePrice(i) * i.quantity, 0));
    let discount = 0, couponCode = null;
    if (o.coupon_code) {
      const v = await coupon.validate(o.coupon_code, subtotal);
      if (v.error) throw new HttpError(400, v.error);
      discount = v.discount; couponCode = v.coupon.code;
    }
    const shipping_fee = subtotal < FREE_OVER() ? SHIP_FEE() : 0;
    const total = money(subtotal - discount + shipping_fee);
    // Demo online payment ("card") is simulated as paid; COD stays unpaid.
    const payment_status = o.payment_method && o.payment_method !== 'cod' ? 'paid' : 'unpaid';

    const insRes = await client.query(
      `INSERT INTO orders (user_id,subtotal,discount,shipping_fee,total,coupon_code,status,
         payment_method,payment_status,shipping_name,shipping_phone,shipping_address,
         shipping_city,shipping_postal,shipping_country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [userId, subtotal, discount, shipping_fee, total, couponCode, 'pending',
        o.payment_method || 'cod', payment_status, o.shipping_name, o.shipping_phone || null,
        o.shipping_address, o.shipping_city || null, o.shipping_postal || null, o.shipping_country || null]);
    const orderId = insRes.rows[0].id;

    for (const it of rows) {
      await client.query(
        'INSERT INTO order_items (order_id,product_id,seller_id,product_title,price,quantity) VALUES ($1,$2,$3,$4,$5,$6)',
        [orderId, it.product_id, it.seller_id, it.title, effectivePrice(it), it.quantity]);
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [it.quantity, it.product_id]);
    }
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
    if (couponCode) await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE code = $1', [couponCode]);
    return orderId;
  });
  return getWithItems(orderId);
}

async function getWithItems(orderId) {
  const order = await db.get('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) return null;
  order.items = await db.all('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return order;
}

const listByUser = (userId) =>
  db.all('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);

async function getForUser(userId, orderId) {
  const order = await db.get('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
  if (!order) return null;
  order.items = await db.all('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return order;
}

async function adminGet(orderId) {
  const order = await db.get(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
    [orderId]);
  if (!order) return null;
  order.items = await db.all(
    `SELECT oi.*, p.slug AS product_slug, u.store_name AS seller_name
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN users u ON u.id = oi.seller_id
     WHERE oi.order_id = $1`,
    [orderId]);
  return order;
}

async function adminList({ status, page = 1, perPage = 20 } = {}) {
  const where = status ? 'WHERE o.status = $1' : '';
  const params = status ? [status] : [];
  const totalRow = await db.get(`SELECT COUNT(*)::int AS n FROM orders o ${where}`, params);
  const total = totalRow ? totalRow.n : 0;
  const pp = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const rows = await db.all(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id ${where}
     ORDER BY o.created_at DESC LIMIT ${pp} OFFSET ${(pg - 1) * pp}`,
    params);
  return { items: rows, total, page: pg, perPage: pp, pages: Math.max(Math.ceil(total / pp), 1) };
}

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
async function updateStatus(orderId, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  await db.run("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [status, orderId]);
  return adminGet(orderId);
}
async function updatePayment(orderId, payment_status) {
  if (!['unpaid', 'paid', 'refunded'].includes(payment_status)) throw new HttpError(400, 'Invalid payment status.');
  await db.run("UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2", [payment_status, orderId]);
  return adminGet(orderId);
}
async function setTracking(orderId, tracking) {
  await db.run("UPDATE orders SET tracking_number = $1, updated_at = NOW() WHERE id = $2", [tracking, orderId]);
  return adminGet(orderId);
}

// Customer-initiated cancellation (only before shipping); restocks items.
async function cancelByUser(userId, orderId) {
  await db.transaction(async (client) => {
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
    const order = orderRes.rows[0];
    if (!order) throw new HttpError(404, 'Order not found.');
    if (!['pending', 'confirmed', 'processing'].includes(order.status))
      throw new HttpError(400, 'This order can no longer be cancelled.');
    const itemsRes = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    for (const it of itemsRes.rows) if (it.product_id) {
      await client.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [it.quantity, it.product_id]);
    }
    await client.query("UPDATE orders SET status='cancelled', updated_at=NOW() WHERE id = $1", [orderId]);
  });
  return getForUser(userId, orderId);
}

// ===================== SELLER ORDER FUNCTIONS =====================
// Orders that contain at least one item belonging to this seller.
async function listBySeller(sellerId, { status, page = 1, perPage = 20 } = {}) {
  const where = ['oi.seller_id = $1'];
  const params = [sellerId];
  const P = (v) => { params.push(v); return `$${params.length}`; };
  if (status) { where.push(`o.status = ${P(status)}`); }
  const totalRow = await db.get(
    `SELECT COUNT(DISTINCT o.id)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${where.join(' AND ')}`,
    params);
  const total = totalRow ? totalRow.n : 0;
  const pp = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const rowParams = [...params, pp, (pg - 1) * pp];
  const rows = await db.all(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN users u ON u.id = o.user_id
     WHERE ${where.join(' AND ')}
     GROUP BY o.id, u.full_name, u.email ORDER BY o.created_at DESC LIMIT $${rowParams.length - 1} OFFSET $${rowParams.length}`,
    rowParams);
  return { items: rows, total, page: pg, perPage: pp, pages: Math.max(Math.ceil(total / pp), 1) };
}

async function getForSeller(sellerId, orderId) {
  const order = await db.get(
    `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
    [orderId]);
  if (!order) return null;
  order.items = await db.all(
    'SELECT oi.* FROM order_items oi WHERE oi.order_id = $1 AND oi.seller_id = $2',
    [orderId, sellerId]);
  if (order.items.length === 0) return null;
  return order;
}

// Seller may advance the order status ONLY when every item in it belongs to them.
async function updateStatusBySeller(sellerId, orderId, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  const allMine = (await db.get(
    'SELECT COUNT(*)::int AS c FROM order_items WHERE order_id = $1 AND seller_id = $2',
    [orderId, sellerId])).c;
  const totalItems = (await db.get('SELECT COUNT(*)::int AS c FROM order_items WHERE order_id = $1', [orderId])).c;
  if (totalItems === 0 || allMine !== totalItems)
    throw new HttpError(403, 'You can only update orders that belong entirely to your store.');
  await db.run("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [status, orderId]);
  return getForSeller(sellerId, orderId);
}

// Seller-specific analytics.
async function sellerAnalytics(sellerId) {
  const totalRevenue = (await db.get(`SELECT COALESCE(SUM(oi.quantity * oi.price),0)::float8 AS v FROM order_items oi
    JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = $1 AND o.status != 'cancelled'`, [sellerId])).v;
  const month = (await db.get(`SELECT COALESCE(SUM(oi.quantity * oi.price),0)::float8 AS v, COUNT(DISTINCT o.id)::int AS c FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = $1 AND o.status != 'cancelled' AND to_char(o.created_at,'YYYY-MM') = to_char(NOW(),'YYYY-MM')`, [sellerId]));
  const monthOrders = (await db.get(`SELECT COUNT(DISTINCT o.id)::int AS c FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = $1 AND to_char(o.created_at,'YYYY-MM') = to_char(NOW(),'YYYY-MM')`, [sellerId])).c;
  const pendingOrders = (await db.get(`SELECT COUNT(DISTINCT o.id)::int AS c FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.seller_id = $1 AND o.status IN ('pending','confirmed')`, [sellerId])).c;
  const totalOrders = (await db.get(`SELECT COUNT(DISTINCT o.id)::int AS c FROM order_items oi
    JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = $1`, [sellerId])).c;
  const products = (await db.get('SELECT COUNT(*)::int AS c FROM products WHERE seller_id = $1', [sellerId])).c;
  const lowStock = (await db.get('SELECT COUNT(*)::int AS c FROM products WHERE seller_id = $1 AND stock <= 5', [sellerId])).c;
  const avgRating = await db.get(
    `SELECT COALESCE(ROUND(AVG(rating),2),0)::float8 AS a, COUNT(*)::int AS c FROM reviews
     WHERE product_id IN (SELECT id FROM products WHERE seller_id = $1)`, [sellerId]);
  const last7 = await db.all(
    `SELECT to_char(o.created_at,'YYYY-MM-DD') AS d, COALESCE(SUM(oi.quantity * oi.price),0)::float8 AS v FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 AND o.status != 'cancelled' AND o.created_at >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY d ORDER BY d`, [sellerId]);
  return {
    totalRevenue: money(totalRevenue), monthRevenue: money(month.v), monthOrders,
    totalOrders, pendingOrders, products, lowStock,
    avgRating: avgRating.a, reviewCount: avgRating.c, last7Days: last7,
  };
}

async function analytics() {
  const totalRevenue = (await db.get(`SELECT COALESCE(SUM(total),0)::float8 AS v FROM orders WHERE status!='cancelled'`)).v;
  const today = await db.get(`SELECT COALESCE(SUM(total),0)::float8 AS v, COUNT(*)::int AS c FROM orders WHERE status!='cancelled' AND created_at::date = CURRENT_DATE`);
  const month = await db.get(`SELECT COALESCE(SUM(total),0)::float8 AS v, COUNT(*)::int AS c FROM orders WHERE status!='cancelled' AND to_char(created_at,'YYYY-MM') = to_char(NOW(),'YYYY-MM')`);
  const totalOrders = (await db.get('SELECT COUNT(*)::int AS c FROM orders')).c;
  const pendingOrders = (await db.get("SELECT COUNT(*)::int AS c FROM orders WHERE status IN ('pending','confirmed')")).c;
  const buyers = (await db.get("SELECT COUNT(*)::int AS c FROM users WHERE role='buyer'")).c;
  const sellers = (await db.get("SELECT COUNT(*)::int AS c FROM users WHERE role='seller'")).c;
  const pendingSellers = (await db.get("SELECT COUNT(*)::int AS c FROM users WHERE role='seller' AND seller_status='pending'")).c;
  const products = (await db.get('SELECT COUNT(*)::int AS c FROM products')).c;
  const pendingProducts = (await db.get('SELECT COUNT(*)::int AS c FROM products WHERE is_approved=0')).c;
  const reviews = (await db.get('SELECT COUNT(*)::int AS c FROM reviews')).c;
  const byStatus = await db.all('SELECT status, COUNT(*)::int AS c FROM orders GROUP BY status');
  const last7 = await db.all(
    `SELECT to_char(created_at,'YYYY-MM-DD') AS d, COALESCE(SUM(total),0)::float8 AS v FROM orders
     WHERE status!='cancelled' AND created_at >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY d ORDER BY d`);
  const recentOrders = await db.all(
    `SELECT o.*, u.full_name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 8`);
  return {
    totalRevenue: money(totalRevenue), todayRevenue: money(today.v), todayOrders: today.c,
    monthRevenue: money(month.v), monthOrders: month.c, totalOrders, pendingOrders,
    buyers, sellers, pendingSellers, products, pendingProducts, reviews,
    byStatus, last7Days: last7, recentOrders,
  };
}

module.exports = {
  quote, createFromCart, getWithItems, listByUser, getForUser, adminGet, adminList,
  updateStatus, updatePayment, setTracking, cancelByUser,
  listBySeller, getForSeller, updateStatusBySeller, sellerAnalytics,
  analytics, STATUSES,
};
