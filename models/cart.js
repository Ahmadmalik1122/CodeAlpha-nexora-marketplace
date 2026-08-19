const db = require('../db/database');
const { money, effectivePrice, parseImages, HttpError } = require('../utils/helpers');
const PLACEHOLDER = 'https://via.placeholder.com/120?text=No+Image';

async function getWithTotals(userId) {
  const rows = await db.all(
    `SELECT ci.id AS cart_item_id, ci.quantity, p.id AS product_id, p.title, p.slug,
            p.price, p.discount_price, p.stock, p.images, u.store_name AS seller_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE ci.user_id = $1 ORDER BY ci.id ASC`,
    [userId]);

  const items = rows.map((r) => {
    const eff = effectivePrice(r);
    return {
      cart_item_id: r.cart_item_id, product_id: r.product_id, title: r.title, slug: r.slug,
      price: r.price, discount_price: r.discount_price, effective_price: eff,
      quantity: r.quantity, stock: r.stock, seller_name: r.seller_name || 'Nexora',
      image: parseImages(r.images)[0] || PLACEHOLDER,
      line_total: money(eff * r.quantity),
    };
  });
  const subtotal = money(items.reduce((s, i) => s + i.effective_price * i.quantity, 0));
  const count = items.reduce((s, i) => s + i.quantity, 0);
  return { items, subtotal, count };
}

async function add(userId, productId, qty) {
  const product = await db.get('SELECT id, stock FROM products WHERE id = $1', [productId]);
  if (!product) throw new HttpError(404, 'Product not found.');
  const existing = await db.get('SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
  const desired = (existing ? existing.quantity : 0) + qty;
  if (product.stock < desired) throw new HttpError(400, 'Not enough stock available.');
  if (existing) await db.run('UPDATE cart_items SET quantity = $1 WHERE id = $2', [desired, existing.id]);
  else await db.run('INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1,$2,$3)', [userId, productId, qty]);
  return getWithTotals(userId);
}

async function update(userId, cartItemId, qty) {
  const item = await db.get(
    'SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.id = $1 AND ci.user_id = $2',
    [cartItemId, userId]);
  if (!item) throw new HttpError(404, 'Cart item not found.');
  if (qty <= 0) await db.run('DELETE FROM cart_items WHERE id = $1', [cartItemId]);
  else {
    if (item.stock < qty) throw new HttpError(400, 'Not enough stock available.');
    await db.run('UPDATE cart_items SET quantity = $1 WHERE id = $2', [qty, cartItemId]);
  }
  return getWithTotals(userId);
}

async function remove(userId, cartItemId) {
  await db.run('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [cartItemId, userId]);
  return getWithTotals(userId);
}
const clear = (userId) => db.run('DELETE FROM cart_items WHERE user_id = $1', [userId]);

module.exports = { getWithTotals, add, update, remove, clear };
