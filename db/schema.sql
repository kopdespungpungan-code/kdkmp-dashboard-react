-- ============================================================
-- KDKMP PENJUALAN DAN SO APN — Skema Database SQLite
-- ============================================================
-- Tabel:
--   penjualan  : rekap penjualan harian (1 baris per tanggal/petugas)
--   struk      : URL struk (1 penjualan -> banyak struk, relasi 1-N)
--   so_apn     : Sales Order / APN (induk)
--   so_apn_item: detail item SO/APN
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ---------- PENJUALAN ----------
CREATE TABLE IF NOT EXISTS penjualan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal    TEXT NOT NULL,                -- format YYYY-MM-DD
  omset      INTEGER NOT NULL DEFAULT 0,   -- omset penjualan (Rp)
  gross      INTEGER NOT NULL DEFAULT 0,   -- pendapatan kotor (omset + modal)
  petugas    TEXT NOT NULL DEFAULT '',
  sumber     TEXT NOT NULL DEFAULT 'excel',-- excel / sheet / manual
  catatan    TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_penjualan_tanggal_petugas
  ON penjualan(tanggal, petugas);

-- ---------- STRUK (URL) ----------
-- 1 penjualan -> banyak struk. URL disimpan, bukan gambar (DB tetap ringan).
CREATE TABLE IF NOT EXISTS struk (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  penjualan_id INTEGER NOT NULL REFERENCES penjualan(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  urutan       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_struk_penjualan ON struk(penjualan_id);

-- ---------- SO / APN (induk) ----------
CREATE TABLE IF NOT EXISTS so_apn (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor       TEXT NOT NULL,               -- nomor SO/APN
  tanggal     TEXT NOT NULL,               -- YYYY-MM-DD
  customer    TEXT DEFAULT '',
  keterangan  TEXT DEFAULT '',
  total       REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'open',-- open / diproses / selesai / batal
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_so_tanggal ON so_apn(tanggal);

-- ---------- ITEM SO / APN ----------
CREATE TABLE IF NOT EXISTS so_apn_item (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  so_id    INTEGER NOT NULL REFERENCES so_apn(id) ON DELETE CASCADE,
  produk   TEXT NOT NULL,
  qty      REAL NOT NULL DEFAULT 0,
  harga    REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_so_item_so ON so_apn_item(so_id);
