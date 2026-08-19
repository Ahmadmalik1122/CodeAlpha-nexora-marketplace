const db = require('../db/database');
const { slugify } = require('../utils/helpers');

async function uniqueSlug(name, excludeId = null) {
  let base = slugify(name) || 'category';
  let slug = base, i = 1;
  while (true) {
    const row = await db.get('SELECT id FROM categories WHERE slug = $1', [slug]);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${++i}`;
  }
}

const all = () =>
  db.all('SELECT * FROM categories ORDER BY parent_id IS NOT NULL, name');

// Nested tree: top-level categories each with a children array + product counts.
async function tree() {
  const rows = await db.all(
    `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
     FROM categories c ORDER BY c.name`
  );
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
    else roots.push(node);
  }
  return roots;
}

const getById = (id) => db.get('SELECT * FROM categories WHERE id = $1', [id]);
const getBySlug = (slug) => db.get('SELECT * FROM categories WHERE slug = $1', [slug]);

async function create(d) {
  const info = await db.run(
    'INSERT INTO categories (name,slug,parent_id,image) VALUES ($1,$2,$3,$4) RETURNING id',
    [d.name, await uniqueSlug(d.name), d.parent_id || null, d.image || null]);
  return getById(info.rows[0].id);
}
async function update(id, d) {
  const cur = await getById(id);
  if (!cur) return null;
  const slug = d.name && d.name !== cur.name ? await uniqueSlug(d.name, id) : cur.slug;
  await db.run('UPDATE categories SET name=$1, slug=$2, parent_id=$3, image=$4 WHERE id=$5',
    [d.name ?? cur.name, slug,
      d.parent_id !== undefined ? (d.parent_id || null) : cur.parent_id,
      d.image !== undefined ? d.image : cur.image, id]);
  return getById(id);
}
const remove = async (id) => (await db.run('DELETE FROM categories WHERE id = $1', [id])).changes > 0;

module.exports = { all, tree, getById, getBySlug, create, update, remove };
