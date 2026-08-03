#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KDKMP PENJUALAN DAN SO APN — import data dari Google Sheet (gviz JSON)
ke database SQLite. Memakai SHEET_ID yang sama dengan dashboard React.
Struktur kolom Google Sheet (sesuai src/lib/sheet.js):
  kolom 0: (timestamp form)  | 1: tanggal  | 2: omset  | 3: gross  | 4: petugas  | 5: struk (URL dipisah koma)
Usage:
  py -3.11 db/import_sheet.py
"""
import json, re, sqlite3, os, sys, urllib.request
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "kdkmp_penjualan.db")
SHEET_ID = "1f3V7WHP0j6fl60qw81Tjz3wgBD_Lqjr1wAr8zimey5Q"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json"

def parse_date(v):
    """Terima Date(2026,6,31) dari gviz, atau string dd/mm/yyyy / yyyy-mm-dd."""
    if v is None: return None
    s = str(v).strip()
    m = re.match(r"Date\((\d+),(\d+),(\d+)", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)) + 1, int(m.group(3))
        return f"{y:04d}-{mo:02d}-{d:02d}"
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try: return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError: pass
    return None

def parse_num(v):
    if v is None: return 0
    try: return int(float(str(v).replace(".", "").replace(",", ".")))
    except ValueError: return 0

def main():
    print("⬇️  Mengambil data dari Google Sheet...")
    req = urllib.request.Request(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"})
    txt = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    i, j = txt.find("{"), txt.rfind("}")
    if i < 0 or j < 0:
        sys.exit("❌ Format data tidak dikenali")
    data = json.loads(txt[i:j + 1])
    if data.get("status") != "ok":
        sys.exit("❌ " + str(data.get("errors")))
    rows = data.get("table", {}).get("rows", [])
    print(f"Baris dari sheet: {len(rows)}")

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS penjualan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL, omset INTEGER NOT NULL DEFAULT 0,
      gross INTEGER NOT NULL DEFAULT 0, petugas TEXT NOT NULL DEFAULT '',
      sumber TEXT NOT NULL DEFAULT 'sheet', catatan TEXT DEFAULT '',
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
    for r in rows:
        c = r.get("c") or []
        get = lambda k: (c[k] or {}).get("v") if k < len(c) and c[k] else None
        tgl = parse_date(get(1))
        if not tgl: continue
        omset = parse_num(get(2))
        gross = parse_num(get(3))
        petugas = str(get(4) or "").strip() or "—"
        struk_raw = str(get(5) or "")
        urls = [u.strip() for u in re.split(r"[,\s]+", struk_raw) if re.match(r"^https?://", u.strip())]

        # Upsert (hindari duplikat per tanggal+petugas)
        cur = con.execute("SELECT id FROM penjualan WHERE tanggal=? AND petugas=?", (tgl, petugas))
        row = cur.fetchone()
        if row:
            pid = row[0]
            con.execute("UPDATE penjualan SET omset=?, gross=?, sumber='sheet', updated_at=datetime('now','localtime') WHERE id=?", (omset, gross, pid))
            skipped += 1
        else:
            cur = con.execute("INSERT INTO penjualan (tanggal, omset, gross, petugas, sumber) VALUES (?,?,?,?, 'sheet')", (tgl, omset, gross, petugas))
            pid = cur.lastrowid
            added += 1

        # Struk: insert yang belum ada
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
