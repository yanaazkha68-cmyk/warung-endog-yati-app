-- Skema D1 untuk sinkronisasi OPSIONAL Warung Endog Yati.
-- Hanya menyimpan satu blob backup JSON per "Kode Sinkronisasi" milik toko
-- (kode dibuat sendiri oleh pemilik, BUKAN PIN/OTP/password bank atau
-- e-wallet manapun). Sumber kebenaran data tetap di HP (localStorage);
-- tabel ini semata-mata salinan cadangan.

CREATE TABLE IF NOT EXISTS backups (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Jalankan migrasi ini dengan:
--   npx wrangler d1 execute warung-endog-yati --file=./database/schema.sql
