const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createApp } = require('./app');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'todo',
  password: process.env.DB_PASSWORD || 'todo123',
  database: process.env.DB_NAME || 'tododb',
  port: 5432,
});

// Pastikan tabel ada (aman untuk volume lama & untuk 2 replika yang start bersamaan)
async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(424242)');
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    client.release();
  }
}

async function main() {
  for (let i = 1; ; i++) {
    try { await initSchema(); break; }
    catch (e) {
      if (i >= 15) throw e;
      console.log(`DB belum siap (${e.message}), coba lagi...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  const port = process.env.PORT || 3000;
  createApp(pool).listen(port, () => console.log('Backend jalan di port ' + port));
}

main().catch(e => { console.error(e); process.exit(1); });