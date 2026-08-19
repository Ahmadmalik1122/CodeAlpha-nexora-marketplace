# Nexora Marketplace — PC Hardware E-Commerce Platform

**Your Marketplace for PC Hardware & Technology.** A production-style, full-stack marketplace built with **Node.js, Express, and PostgreSQL (Supabase)**, where buyers shop premium PC hardware from **trusted, approved sellers** and an **admin** manages the whole platform. Prices throughout are in **Pakistani Rupees (PKR)**.

It ships with a modern storefront, a complete seller dashboard, a full admin panel, secure session-based authentication, cart/wishlist/checkout, coupons, verified reviews, invoices, product comparison, and analytics — mirroring the core of stores like Daraz, Amazon and Newegg.

---

## Architecture

```
Nexora Frontend (public/)
        ↓  (fetch → /api/…)
Express REST API (routes/ + models/)
        ↓  (pg connection pool)
PostgreSQL  ☁️
        ↓
Supabase Cloud
```

The app keeps the existing session-based auth (Express `express-session` + bcrypt). Only the **data layer** changed from SQLite to Supabase PostgreSQL — the frontend and API contract are unchanged.

---

## Setup

### 1. Create a Supabase project

1. Go to https://supabase.com and sign in (or create an account).
2. Click **New project**, pick a name (e.g. `nexora`), choose a strong database password, and select a region close to you.
3. Wait for the project to be provisioned (a minute or two).

### 2. Get your PostgreSQL connection string

1. In your Supabase project, open **Project Settings → Database**.
2. Under **Connection string**, copy the **URI** connection string. It looks like:
   ```
   postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
   > Replace `[YOUR_PASSWORD]` with the database password you set in step 1 (the password is never stored by Supabase, so you must paste it in).

### 3. Create `.env`

Copy the template and fill in your connection string:

```bash
copy .env.example .env     # Windows
# or
cp .env.example .env       # macOS / Linux
```

### 4. Set `DATABASE_URL`

Edit `.env`:

```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
SESSION_SECRET=some-long-random-secret-string
PORT=3000
NODE_ENV=development
```

> **Never commit `.env`.** It is already ignored via `.gitignore`. Never put real credentials in source code.

### 5. Install dependencies

```bash
npm install
```

### 6. Run migrations

Creates all tables (idempotent — safe to run repeatedly):

```bash
npm run db:migrate
```

### 7. Seed the database

Loads 54 products, 43 categories, demo users, coupons, reviews and orders:

```bash
npm run db:seed
```

- Skips automatically if the database already has data (no duplicates).
- To wipe and reseed: `npm run db:seed -- --force`

### 8. Start Nexora

```bash
npm start        # production
npm run dev      # development (auto-reload)
```

Then open **http://localhost:3000**.

---

### Demo accounts

| Role            | Email                    | Password    | Store / status            |
|-----------------|--------------------------|-------------|---------------------------|
| Admin           | `admin@nexora.com`       | `admin123`  | —                         |
| Buyer           | `buyer@nexora.com`       | `buyer123`  | —                         |
| Seller          | `seller@nexora.com`      | `seller123` | TechVerse Lahore (approved) |
| Seller          | `gamersden@nexora.com`   | `seller123` | Gamer's Den Karachi (approved) |
| Seller (demo)   | `pchub@nexora.com`       | `seller123` | PC Hub Islamabad (**pending** — try approving it from the admin panel) |

- **Admin panel** → `/admin.html` (after logging in as the admin).
- **Seller dashboard** → `/seller.html` (after logging in as a seller).

### Demo coupons

`NEXORA10` (10% off orders over Rs 10,000) · `BUILDER20` (20% off over Rs 50,000) · `FLAT250` (Rs 250 off)

---

## Features

### Storefront
- **Homepage** with hero, featured categories, trending, deals of the week, best sellers, PC components, gaming hardware, latest arrivals, trusted brands, "why Nexora", testimonials and newsletter.
- **Product listing** with full-text search (title, brand, category, SKU, tags, description, store), filters for category, brand, price, rating, stock, discount and seller, plus **specification filters** (`?spec_socket=AM5`), six sort modes (relevance, newest, top rated, best selling, price ↑/↓) and server-side pagination.
- **Product detail** with gallery, deep technical specifications, seller card, warranty, low-stock alerts, Buy Now, **verified reviews** (title + badge, buyers only) and related products.
- **Compare** — add up to 4 products (localStorage) and compare price, rating, stock and specs side by side.
- **Cart** with AJAX add/update/remove, move-to-wishlist, coupon application, PKR shipping calculation and live totals.
- **Checkout** supporting **Cash on Delivery** plus a **Demo Online Payment** (simulated card checkout) with free shipping over Rs 25,000.
- **Wishlist** — persistent, per-user.

### Accounts & auth
- Register as a **buyer or seller** (sellers supply a store name and require **admin approval**).
- Login, logout, and password reset with bcrypt-hashed passwords and a persistent **PostgreSQL session store** (`connect-pg-simple`) that survives server restarts.
- **Account dashboard**: editable profile, password change, order history with live status timeline, downloadable/printable invoices, wishlist and compare.

### Seller dashboard (`/seller.html`)
- **Overview**: total/month revenue, order counts, pending orders, product counts, low-stock alerts, 7-day revenue chart, top sellers.
- **Products**: create/edit/delete your own listings with specs, images, discounts and featured flags. New or edited products require **re-approval** before going live. Ownership is enforced on the backend — a seller can never modify another seller's product.
- **Orders**: view orders containing your items and advance their status — only when the whole order belongs to your store.
- **Reviews** on your products, and **store settings** (name, description, logo).

### Admin panel (`/admin.html`)
- **Dashboard**: total/today/month revenue, order counts, buyers/sellers, 7-day chart, orders-by-status, top sellers, low-stock alerts.
- **Sellers**: approve / reject / suspend seller applications.
- **Products**: approve, unapprove and delete any listing.
- **Orders**: update status & payment, add tracking numbers.
- **Reviews**: moderation (remove any review).
- **Coupons**: create percent/fixed coupons with minimums, usage limits and expiry; activate/deactivate.
- **Users**: promote/demote admins, activate/deactivate accounts.

### Security
- Custom **CSRF protection** (token + `X-CSRF-Token` header on every mutation).
- Input **validation & sanitization** (XSS-escaped) on every write endpoint.
- **Parameterized SQL** everywhere (`$1, $2, …` — no string-built queries), safe against injection.
- **RBAC** middleware guards `/api/admin`, `/api/seller`, and the role pages server-side.
- Security headers / CSP, per-IP rate limiting on auth endpoints, `httpOnly` + `sameSite` cookies.
- Central error handling with custom **404 / 500** pages.

---

## API overview

| Area | Routes |
|------|--------|
| Auth | `POST /api/auth/register` · `login` · `logout` · `GET /me` · `request-reset` · `reset-password` |
| Products | `GET /api/products` (search/filter/sort/paginate) · `GET /api/products/brands` · `GET/POST /api/products/:key(/reviews)` |
| Categories | `GET /api/categories` (tree) · `GET /api/categories/flat` |
| Cart | `GET/POST /api/cart` · `PUT/DELETE /api/cart/:id` · `POST /api/cart/apply-coupon` |
| Wishlist | `GET /api/wishlist` · `POST /api/wishlist/toggle` |
| Orders | `GET/POST /api/orders` · `GET /api/orders/:id` · `POST /api/orders/:id/cancel` · `GET /api/orders/:id/invoice` |
| Account | `GET/PUT /api/account` · `PUT /api/account/password` |
| Seller | `/api/seller/overview` · `store` · `products` CRUD · `orders` · `reviews` |
| Admin | `/api/admin/analytics` · `sellers` · `products` · `orders` · `reviews` · `coupons` · `users` · `categories` |

---

## Project structure

```
nexora-marketplace/
├── server.js              # App entry point (exports app; listens when run directly)
├── package.json
├── .env.example           # Copy to .env and adjust (DATABASE_URL, SESSION_SECRET)
├── db/
│   ├── schema.sql         # PostgreSQL schema (migrations)
│   ├── database.js        # pg connection pool + query helpers
│   ├── migrate.js         # npm run db:migrate — applies schema.sql
│   └── init.js            # npm run db:seed — idempotent PostgreSQL seed
├── models/                # Data layer: product, category, cart, wishlist, order, user, review, coupon
├── routes/                # Thin Express routers per resource
├── middleware/            # auth (RBAC), validate, security (CSRF/headers/rate-limit), upload, error
├── utils/                 # helpers (PKR, spec labels), invoice builder
└── public/                # Frontend (static HTML + vanilla JS + CSS design system)
    ├── css/style.css      # Nexora design system
    ├── js/                # common.js (shared chrome + client lib) + one script per page
    └── *.html             # index, shop, product, cart, checkout, account, admin, seller, compare, auth, 404, 500
```

## Environment variables (`.env`)

```
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@…pooler.supabase.com:5432/postgres
PORT=3000
NODE_ENV=development
SESSION_SECRET=some-long-random-secret
SHIPPING_FEE=350
FREE_SHIP_THRESHOLD=25000
# Payment gateway keys (placeholders — wire real callbacks in production)
STRIPE_SECRET_KEY=
JAZZCASH_MERCHANT_ID=
EASYPAISA_STORE_ID=
```

## Notes for production
- Set a strong `SESSION_SECRET` and run behind HTTPS (`NODE_ENV=production` enables secure cookies). Session cookies are `httpOnly` + `sameSite: lax`.
- The PostgreSQL connection is pooled (`pg`). Pool errors are logged; queries are parameterized.
- Online card payments are **simulated as paid** for demo purposes; wire the real gateway callbacks to set `payment_status`.
- Password-reset links are returned in the API response for local testing — connect an email provider to send them instead.
- Image file uploads use `multer` if installed; otherwise use image URLs.

---

Built as a full-stack e-commerce showcase. All prices in **Pakistani Rupees (PKR)**. Database: **Supabase PostgreSQL**.