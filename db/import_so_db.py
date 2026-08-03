#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KDKMP SO — import Google Sheet (Grocery Fresh / gondola) ke SQLite.
Membuat db/kdkmp_so.db dengan tabel:
  so_item      : data gondola/rak/produk/qty/expired/petugas (sumber live Google Sheet)
  so_input     : hasil input SO per petugas (qty hasil opname)
Usage:
  py -3.11 db/import_so_db.py
"""
import json, re, sqlite3, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "kdkmp_so.db")
SHEET_ID = "1V6dStO_eyyrfSw-a5686JS4SbabAAZih"
SHEET_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json"

PETUGAS = [  # [gondola_awal, gondola_akhir, nama]
    (1, 12, "VYRDA"),
    (13, 24, "PANDU"),
    (25, 36, "RISTA"),
    (37, 48, "DEDIK"),
]

def petugas_for(g):
    for a, b, n in PETUGAS:
        if a <= g <= b:
            return n
    return ""

def parse_num(v):
    if v is None: return 0
    try: return int(float(str(v).replace(".", "").replace(",", ".")))
    except ValueError: return 0

def parse_exp(v):
    if v is None: return ""
    s = str(v).strip()
    if not s or s == "-": return ""
    s = re.sub(r"^exp\s*", "", s, flags=re.I).strip()
    parts = re.split(r"[/\-.]", s)
    if len(parts) == 3:
        d, mo, y = parts
        try:
            d, mo, y = int(d), int(mo), int(y)
            if y < 100: y += 2000
            return f"{y:04d}-{mo:02d}-{d:02d}"
        except ValueError: pass
    # bulan indonesia
    bln = {"jan":1,"feb":2,"mar":3,"apr":4,"mei":5,"jun":6,"jul":7,"agu":8,"sep":9,"okt":10,"nov":11,"des":12}
    m = re.match(r"(?:^|\s)(\d{1,2})?\s*([a-zA-Z]+)\s*(\d{4})", s)
    if m:
        mo = bln.get(m.group(2).lower()[:3])
        if mo:
            d = int(m.group(1)) if m.group(1) else 1
            return f"{m.group(3)}-{mo:02d}-{d:02d}"
    return s

def main():
    print("⬇️  Mengambil Google Sheet SO...")
    req = urllib.request.Request(SHEET_URL, headers={"User-Agent": "Mozilla/5.0"})
    txt = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    i, j = txt.find("{"), txt.rfind("}")
    data = json.loads(txt[i:j + 1])
    rows = data.get("table", {}).get("rows", [])
    print(f"Baris: {len(rows)}")

    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
    DROP TABLE IF EXISTS so_item;
    CREATE TABLE so_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gondola INTEGER, tingkat INTEGER, produk TEXT, satuan TEXT,
      qty INTEGER DEFAULT 0, expired TEXT DEFAULT '',
      petugas TEXT DEFAULT '', sumber TEXT DEFAULT 'sheet',
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_so_item_gondola ON so_item(gondola);
    CREATE INDEX IF NOT EXISTS idx_so_item_petugas ON so_item(petugas);
    CREATE TABLE IF NOT EXISTS so_input (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      petugas TEXT NOT NULL, gondola INTEGER,
      produk TEXT NOT NULL, qty_input INTEGER NOT NULL DEFAULT 0,
      tanggal TEXT DEFAULT (date('now','localtime')),
      catatan TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    """)
    cur_gond = None; cur_ting = None
    n = 0
    for r in rows:
        c = r.get("c") or []
        get = lambda k: (c[k] or {}).get("v") if k < len(c) and c[k] else None
        if get(1) is not None:
            cur_gond = int(get(1))
            cur_ting = int(get(2)) if get(2) is not None else 1
        produk = str(get(3) or "").strip()
        if not produk or produk == "-":
            continue
        qty = parse_num(get(5))
        satuan = str(get(4) or "").strip()
        exp = parse_exp(get(6))
        g = cur_gond if cur_gond is not None else 0
        con.execute(
            "INSERT INTO so_item (gondola, tingkat, produk, satuan, qty, expired, petugas, sumber) VALUES (?,?,?,?,?,?,?, 'sheet')",
            (g, cur_ting or 1, produk, satuan, qty, exp, petugas_for(g)))
        n += 1
    con.commit()
    tot = con.execute("SELECT COUNT(*) FROM so_item").fetchone()[0]
    by_petugas = con.execute("SELECT petugas, COUNT(*) FROM so_item GROUP BY petugas ORDER BY petugas").fetchall()
    print(f"✅ DB siap: {DB_PATH}")
    print(f"so_item: {tot} baris | {by_petugas}")
    con.close()

if __name__ == "__main__":
    main()
