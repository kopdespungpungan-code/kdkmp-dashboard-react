#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KDKMP PENJUALAN DAN SO APN — init database SQLite.
Membuat file .db dari schema.sql (aman dijalankan ulang; tidak menghapus data).
Usage:
  py -3.11 db/init_db.py
"""
import sqlite3, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "db", "kdkmp_penjualan.db")
SCHEMA = os.path.join(ROOT, "db", "schema.sql")

def main():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(SCHEMA, "r", encoding="utf-8") as f:
        sql = f.read()
    con = sqlite3.connect(DB_PATH)
    con.executescript(sql)
    con.commit()
    # verifikasi tabel
    tabs = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    print("✅ DB siap:", DB_PATH)
    print("Tabel:", ", ".join(tabs))
    con.close()

if __name__ == "__main__":
    main()
