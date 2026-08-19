// Nexora Marketplace — apply the PostgreSQL schema:  npm run db:migrate
// Reads db/schema.sql and executes it against the Supabase PostgreSQL database.
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../middleware/security');
loadEnv();

const { pool } = require('./database');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Nexora PostgreSQL schema applied successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
