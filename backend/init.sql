CREATE TABLE IF NOT EXISTS antrean (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  poli TEXT NOT NULL,
  loket TEXT NOT NULL DEFAULT 'Menunggu Loket',
  status TEXT NOT NULL DEFAULT 'Menunggu'
);

INSERT INTO antrean (number, name, poli, loket, status)
SELECT * FROM (VALUES
  ('U-001', 'Siti Rahma',   'Poli Umum',           'Loket 1 - Poli Umum', 'Selesai'),
  ('A-002', 'Ahmad Fauzi',  'Poli Anak',           'Loket 2 - Poli Anak', 'Sedang Dilayani'),
  ('G-003', 'Dewi Lestari', 'Poli Gigi',           'Menunggu Loket',      'Menunggu'),
  ('P-004', 'Rian Pratama', 'Poli Penyakit Dalam', 'Menunggu Loket',      'Menunggu')
) AS v(number, name, poli, loket, status)
WHERE NOT EXISTS (SELECT 1 FROM antrean);