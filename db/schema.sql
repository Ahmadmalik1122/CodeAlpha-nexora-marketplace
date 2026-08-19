-- Nexora Marketplace - Full Schema (PostgreSQL / Supabase)
-- Your Marketplace for PC Hardware & Technology
-- Applied by: npm run db:migrate  (db/migrate.js) — idempotent (CREATE ... IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  full_name         TEXT    NOT NULL,
  email             TEXT    NOT NULL UNIQUE,
  password_hash     TEXT    NOT NULL,
  phone             TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  country           TEXT,
  role              TEXT    NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','admin')),
  is_active         INTEGER NOT NULL DEFAULT 1,
  store_name        TEXT,
  store_description TEXT,
  store_logo        TEXT,
  seller_status     TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (seller_status IN ('pending','approved','rejected','suspended')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT    NOT NULL,
  slug       TEXT    NOT NULL UNIQUE,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  image      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  title          TEXT    NOT NULL,
  slug           TEXT    NOT NULL UNIQUE,
  description    TEXT,
  sku            TEXT    UNIQUE,
  price          DOUBLE PRECISION NOT NULL,
  discount_price DOUBLE PRECISION,
  stock          INTEGER NOT NULL DEFAULT 0,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  seller_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  brand          TEXT,
  warranty       TEXT,
  specifications TEXT    DEFAULT '{}',  -- JSON object of category-specific specs
  tags           TEXT,                  -- comma separated
  images         TEXT    DEFAULT '[]',  -- JSON array of image URLs
  is_featured    INTEGER NOT NULL DEFAULT 0,
  is_approved    INTEGER NOT NULL DEFAULT 1,
  rating_avg     DOUBLE PRECISION NOT NULL DEFAULT 0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_approved ON products(is_approved);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE TABLE IF NOT EXISTS cart_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id           SERIAL PRIMARY KEY,
  code         TEXT    NOT NULL UNIQUE,
  type         TEXT    NOT NULL CHECK (type IN ('percent','fixed')),
  value        DOUBLE PRECISION NOT NULL,
  min_subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  expires_at   TIMESTAMPTZ,
  usage_limit  INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtotal        DOUBLE PRECISION NOT NULL,
  discount        DOUBLE PRECISION NOT NULL DEFAULT 0,
  shipping_fee    DOUBLE PRECISION NOT NULL DEFAULT 0,
  total           DOUBLE PRECISION NOT NULL,
  coupon_code     TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled')),
  payment_method  TEXT    NOT NULL DEFAULT 'cod'
                    CHECK (payment_method IN ('cod','card')),
  payment_status  TEXT    NOT NULL DEFAULT 'unpaid'
                    CHECK (payment_status IN ('unpaid','paid','refunded')),
  tracking_number TEXT,
  shipping_name    TEXT,
  shipping_phone   TEXT,
  shipping_address TEXT,
  shipping_city    TEXT,
  shipping_postal  TEXT,
  shipping_country TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  seller_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  product_title TEXT    NOT NULL,
  price         DOUBLE PRECISION NOT NULL,
  quantity      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);

CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT,
  comment    TEXT,
  verified   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

-- Table used by connect-pg-simple for persistent server sessions.
CREATE TABLE IF NOT EXISTS session (
  sid   VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess  JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
