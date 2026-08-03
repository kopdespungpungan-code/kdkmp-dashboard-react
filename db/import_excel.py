#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KDKMP PENJUALAN DAN SO APN — import data dari file EXCEL ke database SQLite.

Kolom yang didukung (baris header otomatis dideteksi dari nama kolom):
  Tanggal / Tgl / Date   -> tanggal (dd/mm/yyyy atau yyyy-mm-dd)
  Omset                  -> omset
  Gross / Pend Kotor     -> gross
  Petugas / Nama         -> petugas
  Struk / Link / URL     -> URL struk (boleh lebih dari 1, dipisah koma/spasi)

Usage:
  py -3.11 db/import_excel.py "C:/path/file.xlsx"
  py -3.11 db/import_excel.py "C:/path/file.xlsx" --sheet "NamaSheet"
"""
import re, sqlite3, os, sys, argparse
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "kdkmp_penjualan.db")

try:
    import openpyxl
except ImportError:
    sys.exit("❌ openpyxl belum terinstall. Jalankan: py -3.11 -m pip install openpyxl")

def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())

def parse_date(v):
    if v is None: return None
    if isinstance(v, datetime): return v.strftime("%Y-%m-%d")
    if hasattr(v, "year") and hasattr(v, "month") and hasattr(v, "day"):
        return f"{v.year:04d}-{v.month:02d}-{v.day:02d}"
    s = str(v).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: pass
    return None

def parse_num(v):
    if v is None: return 0
    if isinstance(v, (int, float)): return int(v)
    try: return int(float(str(v).replace(".", "").replace(",", ".")))
    except ValueError: return 0

def find_cols(header):
    cols = {}
    for i, h in enumerate(header):
        n = norm(h)
        if "tanggal" in n or n == "tgl" or "date" in n: cols["tanggal"] = i
        elif "omset" in n: cols["omset"] = i
        elif "gross" in n or "pendapatan" in n or "kotor" in n: cols["gross"] = i
        elif "petugas" in n or "nama" in n: cols["petugas"] = i
        elif "struk" in n or "link" in n or "url" in n: cols["struk"] = i
    return cols

def main():
    ap = argparse.ArgumentParser(description="Import Excel -> SQLite KDKMP")
    ap.add_argument("file", help="Path file .xlsx")
    ap.add_argument("--sheet", default=None, help="Nama sheet (default: sheet pertama)")
    args = ap.parse_args()
    if not os.path.exists(args.file):
        sys.exit(f"❌ File tidak ditemukan: {args.file}")

    wb = openpyxl.load_workbook(args.file, data_only=True)
    ws = wb[args.sheet] if args.sheet else wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        sys.exit("❌ Sheet kosong")
    header = [str(c) if c is not None else "" for c in rows[0]]
    cols = find_cols(header)
    if "tanggal" not in cols or "omset" not in cols:
        sys.exit(f"❌ Kolom tidak dikenali. Header: {header}\nButuh minimal kolom 'Tanggal' dan 'Omset'.")
    print(f"📄 Sheet: {ws.title} | Baris data: {len(rows)-1}")
    print(f"Kolom terdeteksi: {cols}")

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS penjualan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL, omset INTEGER NOT NULL DEFAULT 0,
      gross INTEGER NOT NULL DEFAULT 0, petugas TEXT NOT NULL DEFAULT '',
      sumber TEXT NOT NULL DEFAULT 'excel', catatan TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_penjualan_tanggal_petugas ON penjualan(tanggal, petugas);
    CREATE TABLE IF NOT EXISTS struk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      penjualan_id INTEGER NOT NULL REFERENCES penjualan(id) ON DELETE CASCADE,
      url TEXT NOT NULL, urutan INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_struk_penjualan ON struk(penjualan_id);
    """)

    added = skipped = struk_added = 0
    for r in rows[1:]:
        if not any(c is not None and str(c).strip() for c in r): continue
        get = lambda k: r[k] if k < len(r) else None
        tgl = parse_date(get(cols["tanggal"]))
        if not tgl: continue
        omset = parse_num(get(cols["omset"]))
        gross = parse_num(get(cols.get("gross"))) if "gross" in cols else omset
        petugas = str(get(cols.get("petugas", 0)) or "").strip() if "petugas" in cols else "—"
        petugas = petugas or "—"
        urls = []
        if "struk" in cols:
            urls = [u.strip() for u in re.split(r"[,\s]+", str(get(cols["struk"]) or "")) if re.match(r"^https?://", u.strip())]

        cur = con.execute("SELECT id FROM penjualan WHERE tanggal=? AND petugas=?", (tgl, petugas))
        row = cur.fetchone()
        if row:
            pid = row[0]
            con.execute("UPDATE penjualan SET omset=?, gross=?, sumber='excel', updated_at=datetime('now','localtime') WHERE id=?", (omset, gross, pid))
            skipped += 1
        else:
            cur = con.execute("INSERT INTO penjualan (tanggal, omset, gross, petugas, sumber) VALUES (?,?,?,?, 'excel')", (tgl, omset, gross, petugas))
            pid = cur.lastrowid
            added += 1

        for u in urls:
            exists = con.execute("SELECT 1 FROM struk WHERE penjualan_id=? AND url=?", (pid, u)).fetchone()
            if not exists:
                nxt = con.execute("SELECT COALESCE(MAX(urutan),0)+1 FROM struk WHERE penjualan_id=?", (pid,)).fetchone()[0]
                con.execute("INSERT INTO struk (penjualan_id, url, urutan) VALUES (?,?,?)", (pid, u, nxt))
                struk_added += 1

    con.commit()
    tot_p = con.execute("SELECT COUNT(*) FROM penjualan").fetchone()[0]
    tot_s = con.execute("SELECT COUNT(*) FROM struk").fetchone()[0]
    print(f"✅ Import selesai — baru {added}, update {skipped}, struk baru {struk_added}")
    print(f"Total di DB: penjualan {tot_p}, struk {tot_s}")
    con.close()

if __name__ == "__main__":
    main()
