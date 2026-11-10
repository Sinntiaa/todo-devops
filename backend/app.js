const express = require('express');
const os = require('os');

const POLI = ['Poli Umum', 'Poli Anak', 'Poli Gigi', 'Poli Penyakit Dalam'];
const COLS = 'id, number, name, poli, loket, status';

function createApp(pool) {
  const app = express();
  app.use(express.json());

  const fail = (res, e) => res.status(500).json({ error: e.message });

  // info container (untuk melihat load balancing)
  app.get('/api/info', (req, res) => res.json({ status: 'ok', host: os.hostname() }));

  // daftar semua antrean
  app.get('/api/queues', async (req, res) => {
    try {
      const r = await pool.query(`SELECT ${COLS} FROM antrean ORDER BY id`);
      res.json(r.rows);
    } catch (e) { fail(res, e); }
  });

  // ambil nomor antrean baru
  app.post('/api/queues', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const poli = String(req.body.poli || '');
    if (!name) return res.status(400).json({ error: 'name wajib diisi' });
    if (!POLI.includes(poli)) return res.status(400).json({ error: 'poli tidak valid' });
    try {
      const r = await pool.query(
        `WITH n AS (SELECT nextval(pg_get_serial_sequence('antrean', 'id')) AS id)
         INSERT INTO antrean (id, number, name, poli)
         SELECT id, $1 || '-' || LPAD(id::text, 3, '0'), $2, $3 FROM n
         RETURNING ${COLS}`,
        [poli.charAt(5).toUpperCase(), name, poli]
      );
      res.status(201).json(r.rows[0]);
    } catch (e) { fail(res, e); }
  });

  // panggil antrean: yang sedang dilayani otomatis selesai (1 statement = atomik)
  app.post('/api/queues/:id/call', async (req, res) => {
    const loket = String(req.body.loket || '').trim();
    if (!loket) return res.status(400).json({ error: 'loket wajib diisi' });
    try {
      const r = await pool.query(
        `WITH done AS (
           UPDATE antrean SET status = 'Selesai'
           WHERE status = 'Sedang Dilayani' AND id <> $1
             AND EXISTS (SELECT 1 FROM antrean WHERE id = $1 AND status = 'Menunggu')
         )
         UPDATE antrean SET status = 'Sedang Dilayani', loket = $2
         WHERE id = $1 AND status = 'Menunggu'
         RETURNING ${COLS}`,
        [req.params.id, loket]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'antrean tidak ditemukan / bukan status Menunggu' });
      res.json(r.rows[0]);
    } catch (e) { fail(res, e); }
  });

  // selesaikan antrean
  app.post('/api/queues/:id/complete', async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE antrean SET status = 'Selesai' WHERE id = $1 RETURNING ${COLS}`,
        [req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'antrean tidak ditemukan' });
      res.json(r.rows[0]);
    } catch (e) { fail(res, e); }
  });

  return app;
}

module.exports = { createApp, POLI };