const db = require('../db/database');

const PUBLIC = 'id, full_name, email, phone, address, city, postal_code, country, role, is_active, store_name, store_description, store_logo, seller_status, created_at';

const findByEmail = (email) =>
  db.get('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
const findById = (id) => db.get(`SELECT ${PUBLIC} FROM users WHERE id = $1`, [id]);

async function create({ full_name, email, password_hash, phone, address, city, postal_code, country, role = 'buyer', store_name }) {
  const info = await db.run(
    `INSERT INTO users (full_name,email,password_hash,phone,address,city,postal_code,country,role,store_name,seller_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [full_name, String(email).toLowerCase(), password_hash, phone || null, address || null,
      city || null, postal_code || null, country || null, role,
      role === 'seller' ? (store_name || `${full_name}'s Store`) : null,
      role === 'seller' ? 'pending' : 'approved']);
  return findById(info.rows[0].id);
}

async function updateProfile(id, d) {
  const cur = await db.get('SELECT * FROM users WHERE id = $1', [id]);
  await db.run(
    'UPDATE users SET full_name=$1, phone=$2, address=$3, city=$4, postal_code=$5, country=$6 WHERE id=$7',
    [d.full_name ?? cur.full_name, d.phone ?? cur.phone, d.address ?? cur.address,
      d.city ?? cur.city, d.postal_code ?? cur.postal_code, d.country ?? cur.country, id]);
  return findById(id);
}

const updatePassword = (id, hash) =>
  db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
const list = () => db.all(`SELECT ${PUBLIC} FROM users ORDER BY created_at DESC`);
const setRole = (id, role) => db.run('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
const setActive = (id, active) => db.run('UPDATE users SET is_active = $1 WHERE id = $2', [active ? 1 : 0, id]);

// ---- Seller store profile ----
async function updateStore(id, d) {
  const cur = await db.get('SELECT * FROM users WHERE id = $1', [id]);
  await db.run('UPDATE users SET store_name=$1, store_description=$2, store_logo=$3 WHERE id=$4',
    [d.store_name ?? cur.store_name, d.store_description ?? cur.store_description,
      d.store_logo !== undefined ? (d.store_logo || null) : cur.store_logo, id]);
  return findById(id);
}

const setSellerStatus = (id, status) =>
  db.run('UPDATE users SET seller_status = $1 WHERE id = $2', [status, id]);

// Sellers with per-seller stats (product count, orders, revenue, rating).
function listSellers() {
  return db.all(
    `SELECT u.id, u.full_name, u.email, u.phone, u.city, u.store_name, u.store_description,
            u.store_logo, u.seller_status, u.is_active, u.created_at,
            (SELECT COUNT(*)::int FROM products p WHERE p.seller_id = u.id) AS product_count,
            COALESCE((SELECT ROUND(AVG(p.rating_avg)::numeric,2)::float8 FROM products p WHERE p.seller_id = u.id),0) AS avg_rating,
            COALESCE((SELECT SUM(oi.quantity)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
                      WHERE oi.seller_id = u.id AND o.status != 'cancelled'),0) AS items_sold,
            COALESCE((SELECT SUM(oi.quantity * oi.price)::float8 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                      WHERE oi.seller_id = u.id AND o.status != 'cancelled'),0) AS revenue
     FROM users u WHERE u.role = 'seller' ORDER BY u.created_at DESC`
  );
}

module.exports = {
  findByEmail, findById, create, updateProfile, updatePassword, list, setRole, setActive,
  updateStore, setSellerStatus, listSellers,
};
