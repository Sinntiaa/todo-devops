const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../app');

const row = { id: 1, number: 'U-001', name: 'Budi', poli: 'Poli Umum', loket: 'Menunggu Loket', status: 'Menunggu' };

// pool palsu supaya test tidak butuh database
const fakePool = {
  query: async (sql, params) => {
    if (sql.includes('FROM antrean ORDER BY')) return { rows: [row] };
    if (sql.includes('INSERT INTO antrean')) return { rows: [{ ...row, id: 2, number: params[0] + '-002', name: params[1], poli: params[2] }] };
    if (sql.includes("status = 'Sedang Dilayani', loket")) return params[0] === '99' ? { rows: [] } : { rows: [{ ...row, status: 'Sedang Dilayani', loket: params[1] }] };
    if (sql.includes("SET status = 'Selesai' WHERE id")) return { rows: [{ ...row, status: 'Selesai' }] };
    return { rows: [] };
  },
};

async function withServer(fn) {
  const server = createApp(fakePool).listen(0);
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base); } finally { server.close(); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /api/info mengembalikan status ok', () => withServer(async (base) => {
  const body = await (await fetch(base + '/api/info')).json();
  assert.strictEqual(body.status, 'ok');
}));

test('GET /api/queues mengembalikan daftar antrean', () => withServer(async (base) => {
  const body = await (await fetch(base + '/api/queues')).json();
  assert.strictEqual(body.length, 1);
  assert.strictEqual(body[0].number, 'U-001');
}));

test('POST /api/queues tanpa nama ditolak', () => withServer(async (base) => {
  assert.strictEqual((await post(base + '/api/queues', { poli: 'Poli Umum' })).status, 400);
}));

test('POST /api/queues dengan poli tidak valid ditolak', () => withServer(async (base) => {
  assert.strictEqual((await post(base + '/api/queues', { name: 'Budi', poli: 'Poli Hantu' })).status, 400);
}));

test('POST /api/queues berhasil membuat antrean', () => withServer(async (base) => {
  const res = await post(base + '/api/queues', { name: 'Budi', poli: 'Poli Anak' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual((await res.json()).number, 'A-002');
}));

test('POST /api/queues/:id/call memanggil antrean', () => withServer(async (base) => {
  const res = await post(base + '/api/queues/1/call', { loket: 'Loket 1 - Poli Umum' });
  assert.strictEqual((await res.json()).status, 'Sedang Dilayani');
}));

test('POST /api/queues/:id/call tanpa loket ditolak', () => withServer(async (base) => {
  assert.strictEqual((await post(base + '/api/queues/1/call', {})).status, 400);
}));

test('POST /api/queues/:id/call id tidak ada -> 404', () => withServer(async (base) => {
  assert.strictEqual((await post(base + '/api/queues/99/call', { loket: 'Loket 1' })).status, 404);
}));

test('POST /api/queues/:id/complete menyelesaikan antrean', () => withServer(async (base) => {
  const res = await post(base + '/api/queues/1/complete', {});
  assert.strictEqual((await res.json()).status, 'Selesai');
}));