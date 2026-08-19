// Runtime PostgreSQL connection (pg) for Supabase. Connection string comes from DATABASE_URL.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in your .env file (Supabase PostgreSQL connection string).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: /localhost|127\.0\.0\.1|::1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Run a query and return the full pg result ({ rows, rowCount, ... }).
async function query(text, params = []) {
  return await pool.query(text, params);
}

// First row or null (replaces SQLite .get()).
async function get(text, params = []) {
  const res = await query(text, params);
  return res.rows[0] ?? null;
}

// All rows (replaces SQLite .all()).
async function all(text, params = []) {
  const res = await query(text, params);
  return res.rows;
}

// Write query (replaces SQLite .run()). Supports INSERT ... RETURNING id.
async function run(text, params = []) {
  const res = await query(text, params);
  return {
    changes: res.rowCount,
    rows: res.rows,
    lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : null,
  };
}

// Borrow a single client from the pool.
async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Run fn inside a transaction. fn receives a pg client; use client.query(...) inside.
async function transaction(fn) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

module.exports = { pool, query, get, all, run, withClient, transaction };
