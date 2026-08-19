const db = require('../db/database');
const { decorateProduct } = require('../utils/helpers');

const list = (userId) =>
  db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            u.store_name AS seller_name
     FROM wishlist_items w
     JOIN products p ON p.id = w.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
    [userId]).then((rows) => rows.map((r) => decorateProduct(r, r.seller_name)));

const has = (userId, productId) =>
  db.get('SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [userId, productId]).then(Boolean);

async function toggle(userId, productId) {
  if (await has(userId, productId)) {
    await db.run('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
    return { added: false };
  }
  await db.run(
    'INSERT INTO wishlist_items (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [userId, productId]);
  return { added: true };
}
const remove = (userId, productId) =>
  db.run('DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);

module.exports = { list, has, toggle, remove };
