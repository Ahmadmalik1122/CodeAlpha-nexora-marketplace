const db = require('../db/database');
const { slugify, money, decorateProduct } = require('../utils/helpers');

async function uniqueSlug(title, excludeId = null) {
  let base = slugify(title) || 'product';
  let slug = base, i = 1;
  while (true) {
    const row = await db.get('SELECT id FROM products WHERE slug = $1', [slug]);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${++i}`;
  }
}

// Public listing with search, filters, sort, pagination.
async function list(opts = {}) {
  const { search, categoryId, brand, minPrice, maxPrice, minRating, sellerId, sellerName,
    inStock, onSale, sort = 'newest', page = 1, perPage = 12, approved = 1, featured, specs } = opts;
  const where = ['1=1'];
  const params = [];
  // Push a value and return its $n placeholder (PostgreSQL allows reuse, so each
  // placeholder must be minted at the exact position the value is added).
  const P = (v) => { params.push(v); return `$${params.length}`; };

  // Category-specific specification filters, e.g. { socket: 'AM5', vram: '12 GB' }.
  if (specs && typeof specs === 'object') {
    for (const [key, value] of Object.entries(specs)) {
      if (!value) continue;
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      if (!cleanKey) continue;
      where.push(`p.specifications::jsonb ->> ${P(cleanKey)} = ${P(String(value))}`);
    }
  }

  if (search) {
    // Real search across name, brand, category, SKU and description.
    const q = `%${search}%`;
    where.push(`(p.title ILIKE ${P(q)} OR p.brand ILIKE ${P(q)} OR p.description ILIKE ${P(q)}
                 OR p.sku ILIKE ${P(q)} OR p.tags ILIKE ${P(q)}
                 OR COALESCE(u.store_name,'') ILIKE ${P(q)} OR c.name ILIKE ${P(q)})`);
  }
  if (categoryId) {
    const children = await db.all('SELECT id FROM categories WHERE id = $1 OR parent_id = $1', [categoryId]);
    const ids = children.map((r) => r.id);
    if (ids.length === 0) {
      where.push('1 = 0');
    } else {
      const ph = ids.map((id) => P(id));
      where.push(`p.category_id IN (${ph.join(',')})`);
    }
  }
  if (brand) { where.push(`p.brand = ${P(brand)}`); }
  if (sellerId) { where.push(`p.seller_id = ${P(sellerId)}`); }
  if (sellerName) { where.push(`COALESCE(u.store_name,'') ILIKE ${P(`%${sellerName}%`)}`); }
  if (minPrice != null) { where.push(`COALESCE(p.discount_price, p.price) >= ${P(minPrice)}`); }
  if (maxPrice != null) { where.push(`COALESCE(p.discount_price, p.price) <= ${P(maxPrice)}`); }
  if (minRating != null) { where.push(`p.rating_avg >= ${P(minRating)}`); }
  if (inStock) where.push('p.stock > 0');
  if (onSale) where.push('p.discount_price IS NOT NULL AND p.discount_price < p.price');
  if (featured) where.push('p.is_featured = 1');
  if (approved !== undefined && approved !== null) { where.push(`p.is_approved = ${P(approved ? 1 : 0)}`); }

  const plainOrderBy = {
    price_asc: 'COALESCE(p.discount_price, p.price) ASC',
    price_desc: 'COALESCE(p.discount_price, p.price) DESC',
    newest: 'p.created_at DESC, p.id DESC',
    top_rated: 'p.rating_avg DESC, p.rating_count DESC',
    best_selling: `(SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status != 'cancelled') DESC, p.id DESC`,
  };

  let orderBy;
  const extraParams = [];
  if (sort === 'relevance' && search) {
    orderBy = `CASE WHEN p.title ILIKE $${params.length + 1} THEN 0 ELSE 1 END, p.rating_avg DESC, p.id DESC`;
    extraParams.push(`%${search}%`);
  } else {
    orderBy = plainOrderBy[sort] || 'p.created_at DESC, p.id DESC';
  }

  const whereSql = where.join(' AND ');
  const totalRow = await db.get(`SELECT COUNT(*)::int AS n FROM products p
    LEFT JOIN users u ON u.id = p.seller_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${whereSql}`, params);
  const total = totalRow ? totalRow.n : 0;

  const pp = Math.min(Math.max(parseInt(perPage, 10) || 12, 1), 60);
  const pg = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (pg - 1) * pp;

  const rowParams = [...params, ...extraParams, pp, offset];
  const rows = await db.all(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            u.store_name AS seller_name, u.seller_status
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE ${whereSql} ORDER BY ${orderBy} LIMIT $${rowParams.length - 1} OFFSET $${rowParams.length}`,
    rowParams);

  return {
    items: rows.map((r) => decorateProduct(r, r.seller_name)),
    total, page: pg, perPage: pp, pages: Math.max(Math.ceil(total / pp), 1),
  };
}

const getById = (id) =>
  db.get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            u.store_name AS seller_name, u.seller_status
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.id = $1`, [id]).then((p) => decorateProduct(p, p && p.seller_name));

const getBySlug = (slug) =>
  db.get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            u.store_name AS seller_name, u.seller_status
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.slug = $1`, [slug]).then((p) => decorateProduct(p, p && p.seller_name));

function related(product, limit = 4) {
  if (!product) return Promise.resolve([]);
  return db.all(
    `SELECT p.*, u.store_name AS seller_name
     FROM products p LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.is_approved = 1 AND p.id != $1 AND (p.category_id IS NOT DISTINCT FROM $2 OR p.brand = $3)
     ORDER BY p.rating_avg DESC, p.id DESC LIMIT $4`,
    [product.id, product.category_id, product.brand, limit]
  ).then((rows) => rows.map((r) => decorateProduct(r, r.seller_name)));
}

async function create(d) {
  const slug = await uniqueSlug(d.title);
  const info = await db.run(
    `INSERT INTO products (title,slug,description,sku,price,discount_price,stock,category_id,seller_id,
       brand,warranty,specifications,tags,images,is_featured,is_approved)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
    [d.title, slug, d.description || '', d.sku || null, money(d.price),
      d.discount_price != null ? money(d.discount_price) : null,
      parseInt(d.stock, 10) || 0, d.category_id || null, d.seller_id || null,
      d.brand || '', d.warranty || '',
      JSON.stringify(d.specifications || {}), d.tags || '',
      JSON.stringify(d.images || []), d.is_featured ? 1 : 0,
      d.is_approved === undefined ? 1 : (d.is_approved ? 1 : 0)]);
  return getById(info.rows[0].id);
}

async function update(id, d) {
  const cur = await db.get('SELECT * FROM products WHERE id = $1', [id]);
  if (!cur) return null;
  const slug = d.title && d.title !== cur.title ? await uniqueSlug(d.title, id) : cur.slug;
  await db.run(
    `UPDATE products SET title=$1, slug=$2, description=$3, sku=$4, price=$5, discount_price=$6,
       stock=$7, category_id=$8, brand=$9, warranty=$10, specifications=$11, tags=$12, images=$13,
       is_featured=$14, is_approved=$15 WHERE id=$16`,
    [
      d.title ?? cur.title, slug, d.description ?? cur.description, d.sku ?? cur.sku,
      d.price != null ? money(d.price) : cur.price,
      d.discount_price !== undefined ? (d.discount_price != null ? money(d.discount_price) : null) : cur.discount_price,
      d.stock != null ? parseInt(d.stock, 10) : cur.stock,
      d.category_id !== undefined ? d.category_id : cur.category_id,
      d.brand ?? cur.brand, d.warranty ?? cur.warranty,
      d.specifications !== undefined ? JSON.stringify(d.specifications) : cur.specifications,
      d.tags ?? cur.tags,
      d.images !== undefined ? JSON.stringify(d.images) : cur.images,
      d.is_featured !== undefined ? (d.is_featured ? 1 : 0) : cur.is_featured,
      d.is_approved !== undefined ? (d.is_approved ? 1 : 0) : cur.is_approved,
      id
    ]);
  return getById(id);
}

const remove = async (id) => (await db.run('DELETE FROM products WHERE id = $1', [id])).changes > 0;
const removeBySeller = async (sellerId, id) =>
  (await db.run('DELETE FROM products WHERE id = $1 AND seller_id = $2', [id, sellerId])).changes > 0;

const lowStock = (threshold = 5, sellerId = null) => {
  if (sellerId) return db.all('SELECT id,title,stock,sku FROM products WHERE seller_id = $1 AND stock <= $2 ORDER BY stock ASC', [sellerId, threshold]);
  return db.all('SELECT id,title,stock,sku FROM products WHERE stock <= $1 ORDER BY stock ASC', [threshold]);
};

function topSelling(limit = 5) {
  return db.all(
    `SELECT p.id, p.title, SUM(oi.quantity)::int AS sold, SUM(oi.quantity * oi.price)::float8 AS revenue
     FROM order_items oi JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
     GROUP BY p.id ORDER BY sold DESC LIMIT $1`, [limit]);
}

// Distinct brands for the filter sidebar.
const brands = async () => {
  const rows = await db.all(
    `SELECT DISTINCT brand FROM products WHERE brand != '' AND is_approved = 1 ORDER BY brand`);
  return rows.map((r) => r.brand);
};

module.exports = {
  list, getById, getBySlug, related, create, update, remove, removeBySeller,
  lowStock, topSelling, uniqueSlug, brands,
};
