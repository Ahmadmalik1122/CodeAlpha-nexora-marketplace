const db = require('../db/database');
const { money, pkr } = require('../utils/helpers');

const getByCode = (code) =>
  db.get('SELECT * FROM coupons WHERE code = $1', [String(code || '').toUpperCase()]);
const all = () => db.all('SELECT * FROM coupons ORDER BY created_at DESC');

// Returns { discount, coupon } on success, or { error } if not applicable.
async function validate(code, subtotal) {
  const c = await getByCode(code);
  if (!c || !c.active) return { error: 'Invalid coupon code.' };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { error: 'This coupon has expired.' };
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return { error: 'This coupon is no longer available.' };
  if (subtotal < c.min_subtotal) return { error: `Spend at least ${pkr(c.min_subtotal)} to use ${c.code}.` };
  const discount = c.type === 'percent'
    ? money(subtotal * c.value / 100)
    : money(Math.min(c.value, subtotal));
  return { coupon: c, discount };
}

const incrementUsage = (code) =>
  db.run('UPDATE coupons SET used_count = used_count + 1 WHERE code = $1', [String(code).toUpperCase()]);

async function create(d) {
  const info = await db.run(
    `INSERT INTO coupons (code,type,value,min_subtotal,active,expires_at,usage_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [String(d.code).toUpperCase(), d.type, Number(d.value), Number(d.min_subtotal) || 0,
      d.active ? 1 : 0, d.expires_at || null, d.usage_limit != null ? parseInt(d.usage_limit, 10) : null]);
  return db.get('SELECT * FROM coupons WHERE id = $1', [info.rows[0].id]);
}
async function update(id, d) {
  const cur = await db.get('SELECT * FROM coupons WHERE id = $1', [id]);
  if (!cur) return null;
  await db.run('UPDATE coupons SET code=$1, type=$2, value=$3, min_subtotal=$4, active=$5, expires_at=$6, usage_limit=$7 WHERE id=$8',
    [String(d.code ?? cur.code).toUpperCase(), d.type ?? cur.type,
      d.value != null ? Number(d.value) : cur.value,
      d.min_subtotal != null ? Number(d.min_subtotal) : cur.min_subtotal,
      d.active !== undefined ? (d.active ? 1 : 0) : cur.active,
      d.expires_at !== undefined ? (d.expires_at || null) : cur.expires_at,
      d.usage_limit !== undefined ? (d.usage_limit != null ? parseInt(d.usage_limit, 10) : null) : cur.usage_limit,
      id]);
  return db.get('SELECT * FROM coupons WHERE id = $1', [id]);
}
const remove = async (id) => (await db.run('DELETE FROM coupons WHERE id = $1', [id])).changes > 0;

module.exports = { getByCode, all, validate, incrementUsage, create, update, remove };
