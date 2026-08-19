const db = require('../db/database');

const listByProduct = (productId) =>
  db.all(
    `SELECT r.id, r.rating, r.title, r.comment, r.verified, r.created_at, u.full_name AS author
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 ORDER BY r.created_at DESC`,
    [productId]);

// Keep the denormalised rating fields on products in sync.
async function recompute(productId) {
  const agg = await db.get(
    `SELECT COUNT(*)::int AS c, COALESCE(ROUND(AVG(rating),2),0)::float8 AS a FROM reviews WHERE product_id = $1`,
    [productId]);
  await db.run('UPDATE products SET rating_count = $1, rating_avg = $2 WHERE id = $3',
    [agg.c, agg.a, productId]);
}

// Has this user purchased this product? (verified buyers only may review)
const hasPurchased = (userId, productId) =>
  db.get(
    `SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = $1 AND o.user_id = $2 AND o.status != 'cancelled'`,
    [productId, userId]).then(Boolean);

// One review per user per product; re-submitting updates it.
async function upsert(productId, userId, rating, title, comment) {
  const verified = (await hasPurchased(userId, productId)) ? 1 : 0;
  await db.run(
    `INSERT INTO reviews (product_id, user_id, rating, title, comment, verified) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (product_id, user_id)
     DO UPDATE SET rating = EXCLUDED.rating, title = EXCLUDED.title, comment = EXCLUDED.comment,
       verified = EXCLUDED.verified, created_at = NOW()`,
    [productId, userId, rating, title, comment, verified]);
  await recompute(productId);
}

// Admin moderation: list all reviews with product/user context; delete.
async function adminList({ page = 1, perPage = 50 } = {}) {
  const total = (await db.get('SELECT COUNT(*)::int AS n FROM reviews')).n;
  const pp = Math.min(Math.max(parseInt(perPage, 10) || 50, 1), 100);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const rows = await db.all(
    `SELECT r.id, r.rating, r.title, r.comment, r.verified, r.created_at,
            p.title AS product_title, p.id AS product_id,
            u.full_name AS author, u.email AS author_email
     FROM reviews r
     JOIN products p ON p.id = r.product_id
     JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
    [pp, (pg - 1) * pp]);
  return { items: rows, total, page: pg, perPage: pp, pages: Math.max(Math.ceil(total / pp), 1) };
}

const adminRemove = async (id) => {
  const row = await db.get('SELECT product_id FROM reviews WHERE id = $1', [id]);
  const done = (await db.run('DELETE FROM reviews WHERE id = $1', [id])).changes > 0;
  if (done && row) await recompute(row.product_id);
  return done;
};

module.exports = { listByProduct, recompute, hasPurchased, upsert, adminList, adminRemove };
