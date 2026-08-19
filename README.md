# ⚡ Nexora Marketplace

<p align="center">
  <strong>Build Better. Game Faster.</strong>
</p>

<p align="center">
  A modern full-stack marketplace for PC hardware, gaming components, computers, monitors and technology accessories.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="MIT License">
</p>

---

## 🚀 About Nexora

**Nexora Marketplace** is a full-stack PC hardware marketplace designed around a modern e-commerce experience.

It connects **buyers, sellers and administrators** through one platform where users can discover, compare and purchase technology products while sellers manage their own stores and administrators control the marketplace.

From CPUs and GPUs to gaming peripherals, laptops, monitors and networking equipment, Nexora is focused entirely on the world of PC hardware and technology.

> **One platform. Every component. Infinite builds.**

---

## ✨ Core Features

### 🛍️ Storefront

* Modern responsive homepage
* PC hardware categories
* Featured products
* Trending products
* Best sellers
* Latest arrivals
* Technology brands
* Deals and discounts
* Product search
* Advanced filtering
* Sorting and pagination
* Product recommendations
* Product comparison

### 🖥️ Product System

Every product can contain:

* Product images
* Brand
* Category
* SKU
* Price in PKR
* Discount price
* Stock
* Warranty
* Seller
* Technical specifications
* Ratings
* Verified reviews
* Related products

Category-specific specifications are supported for hardware such as:

**CPU**

* Cores
* Threads
* Clock speed
* Socket
* Cache
* TDP

**GPU**

* VRAM
* Memory type
* Memory bus
* Boost clock
* Power
* Ports

**RAM**

* Capacity
* DDR generation
* Speed
* Latency

**SSD**

* Capacity
* Interface
* Read/write speed
* Form factor

---

# 👤 Buyer Experience

Users can register as buyers and access a complete shopping experience.

### Authentication

* Secure registration
* Login/logout
* Password hashing with bcrypt
* Password reset
* Persistent PostgreSQL sessions
* Protected user accounts

### Shopping

* Search products
* Filter products
* Compare hardware
* Add to cart
* Update quantities
* Remove products
* Wishlist
* Apply coupons
* Checkout
* Cash on Delivery
* Demo online payment
* Order tracking
* Printable invoices

### Reviews

Only verified buyers can review purchased products.

Reviews support:

* Rating
* Title
* Review text
* Verified buyer badge
* Average product rating

---

# 🏪 Seller Marketplace

Nexora is not just a storefront.

It is a **multi-vendor marketplace**.

Sellers can create and manage their own stores.

### Seller Dashboard

* Revenue overview
* Sales analytics
* Order statistics
* Product management
* Inventory management
* Low-stock alerts
* Add products
* Edit products
* Delete products
* Seller orders
* Product reviews
* Store settings
* Store description
* Store logo

### Seller Security

Every seller action is protected by backend ownership checks.

A seller cannot modify or delete another seller's products.

New seller accounts can require administrator approval before becoming active.

---

# 🛡️ Admin Control Center

Administrators have complete marketplace control.

### Dashboard

* Total revenue
* Monthly revenue
* Daily revenue
* Total orders
* Buyers
* Sellers
* Product statistics
* Sales analytics
* Order status analytics
* Top sellers
* Low-stock products

### Management

**Users**

* Activate/deactivate
* Promote/demote admins

**Sellers**

* Approve
* Reject
* Suspend

**Products**

* Approve
* Unapprove
* Delete
* Manage listings

**Orders**

* Update status
* Update payment status
* Tracking numbers

**Reviews**

* Moderate/remove reviews

**Coupons**

* Percentage discounts
* Fixed discounts
* Minimum order requirements
* Usage limits
* Expiration dates
* Activate/deactivate

---

# 🔐 Security

Security is built into the backend rather than relying only on frontend restrictions.

### Included

* bcrypt password hashing
* PostgreSQL session storage
* Role-based access control
* Buyer / Seller / Admin authorization
* Backend ownership validation
* CSRF protection
* Input validation
* Input sanitization
* Parameterized SQL queries
* SQL injection protection
* XSS protection
* Helmet security headers
* Content Security Policy
* Rate limiting on authentication endpoints
* HTTP-only cookies
* SameSite cookies
* Centralized error handling
* Custom 404 / 500 pages

---

# ☁️ Architecture

```text
                    ┌──────────────────────┐
                    │   Nexora Frontend    │
                    │ HTML • CSS • JS      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Express REST API  │
                    │ Authentication       │
                    │ Business Logic       │
                    │ Authorization        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   PostgreSQL / pg    │
                    │   Connection Pool    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Supabase Cloud ☁️  │
                    │   PostgreSQL DB      │
                    └──────────────────────┘
```

---

# 🧰 Tech Stack

| Layer             | Technology                      |
| ----------------- | ------------------------------- |
| Frontend          | HTML5, CSS3, Vanilla JavaScript |
| Backend           | Node.js                         |
| API               | Express.js                      |
| Database          | PostgreSQL                      |
| Database Platform | Supabase                        |
| Database Driver   | node-postgres (`pg`)            |
| Authentication    | Express Session + bcrypt        |
| Session Store     | connect-pg-simple               |
| Validation        | express-validator               |
| Security          | Helmet, CSRF, rate limiting     |
| Uploads           | Multer                          |
| Email             | Nodemailer                      |
| Package Manager   | npm                             |

---

# 📂 Project Structure

```text
nexora-marketplace/
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
│
├── db/
│   ├── database.js
│   ├── schema.sql
│   ├── migrate.js
│   └── init.js
│
├── models/
│   ├── user.js
│   ├── product.js
│   ├── category.js
│   ├── cart.js
│   ├── order.js
│   ├── review.js
│   ├── wishlist.js
│   └── coupon.js
│
├── routes/
│
├── middleware/
│   ├── auth.js
│   ├── error.js
│   ├── security.js
│   ├── upload.js
│   └── validate.js
│
├── utils/
│
└── public/
    ├── css/
    ├── js/
    └── *.html
```

---

# ⚡ Quick Start

## 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/nexora-marketplace.git
cd nexora-marketplace
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

Create `.env` from `.env.example`.

```env
DATABASE_URL=your_supabase_postgresql_connection_string
SESSION_SECRET=your_long_random_secret
PORT=3000
NODE_ENV=development
```

> ⚠️ Never commit `.env` or database credentials.

## 4. Run database migration

```bash
npm run db:migrate
```

## 5. Seed Nexora

```bash
npm run db:seed
```

The seed system provides demo categories, products, users, reviews, orders and coupons.

## 6. Start

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🔑 Demo Accounts

| Role               | Email                  | Password    |
| ------------------ | ---------------------- | ----------- |
| 👑 Admin           | `admin@nexora.com`     | `admin123`  |
| 🛒 Buyer           | `buyer@nexora.com`     | `buyer123`  |
| 🏪 Seller          | `seller@nexora.com`    | `seller123` |
| 🎮 Seller          | `gamersden@nexora.com` | `seller123` |
| 🖥️ Pending Seller | `pchub@nexora.com`     | `seller123` |

> Demo credentials are for local development/testing only.

---

# 🎟️ Demo Coupons

| Coupon      | Discount |
| ----------- | -------- |
| `NEXORA10`  | 10%      |
| `BUILDER20` | 20%      |
| `FLAT250`   | Rs. 250  |

---

# 🔌 API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/request-reset
POST /api/auth/reset-password
```

### Products

```text
GET  /api/products
GET  /api/products/brands
GET  /api/products/:key
POST /api/products/:key/reviews
```

### Categories

```text
GET /api/categories
GET /api/categories/flat
```

### Cart

```text
GET    /api/cart
POST   /api/cart
PUT    /api/cart/:id
DELETE /api/cart/:id
POST   /api/cart/apply-coupon
```

### Wishlist

```text
GET  /api/wishlist
POST /api/wishlist/toggle
```

### Orders

```text
GET  /api/orders
POST /api/orders
GET  /api/orders/:id
POST /api/orders/:id/cancel
GET  /api/orders/:id/invoice
```

### Seller

```text
/api/seller/overview
/api/seller/store
/api/seller/products
/api/seller/orders
/api/seller/reviews
```

### Admin

```text
/api/admin/analytics
/api/admin/users
/api/admin/sellers
/api/admin/products
/api/admin/orders
/api/admin/reviews
/api/admin/coupons
/api/admin/categories
```

---

# 📊 Database

Nexora uses **PostgreSQL hosted through Supabase**.

The database manages:

```text
Users
  ├── Buyers
  ├── Sellers
  └── Admins

Products
  ├── Categories
  ├── Sellers
  ├── Reviews
  └── Inventory

Orders
  ├── Order Items
  ├── Payments
  └── Status Tracking

Shopping
  ├── Cart
  ├── Wishlist
  └── Coupons
```

---

# 💳 Payments

The current checkout supports:

* Cash on Delivery
* Demo Online Payment

The online card payment flow is **simulated for demonstration purposes**.

Real payment gateway integration can be added later with services such as Stripe, JazzCash or Easypaisa.

---

# 📈 Future Roadmap

* [ ] Real Stripe payment integration
* [ ] JazzCash integration
* [ ] Easypaisa integration
* [ ] Real-time order notifications
* [ ] Product image storage/CDN
* [ ] Advanced seller analytics
* [ ] AI-powered product recommendations
* [ ] AI PC build assistant
* [ ] PC compatibility checker
* [ ] GPU/CPU performance comparison
* [ ] Production deployment
* [ ] Automated testing
* [ ] CI/CD pipeline
* [ ] PWA/mobile experience

---

# 🧪 Development

Run development mode:

```bash
npm run dev
```

Run database migration:

```bash
npm run db:migrate
```

Seed database:

```bash
npm run db:seed
```

Force reseed:

```bash
npm run db:seed -- --force
```

---

# 🌐 Production Notes

Before production deployment:

* Use HTTPS
* Use a strong `SESSION_SECRET`
* Set `NODE_ENV=production`
* Keep `.env` private
* Configure a real payment gateway
* Configure a production email provider
* Configure persistent image storage
* Review Supabase database security
* Add automated tests
* Configure CI/CD
* Monitor database and application logs

---

# 👨‍💻 Project

**Nexora Marketplace**

A full-stack portfolio project demonstrating:

* REST API development
* PostgreSQL database design
* Supabase integration
* Authentication
* RBAC
* Multi-vendor marketplace architecture
* E-commerce workflows
* Secure backend development
* Responsive frontend development

---

<p align="center">

### ⚡ Build Better. Game Faster.

**Nexora Marketplace**

*Your Marketplace for PC Hardware & Technology.*

</p>

<p align="center">
  <sub>Built with Node.js • Express • PostgreSQL • Supabase • JavaScript</sub>
</p>
