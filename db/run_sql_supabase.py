#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eksekusi SQL ke Supabase via Management API (butuh PAT sbp_...)."""
import json, os, sys, urllib.request

PAT = os.environ.get("SUPABASE_PAT", "")
REF = os.environ.get("SUPABASE_PROJECT_REF", "mjooqlmsswsykefaolih")
SQL_FILE = sys.argv[1] if len(sys.argv) > 1 else "db/supabase_schema.sql"

def run_query(sql):
    url = f"https://api.supabase.com/v1/projects/{REF}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {PAT}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")

def main():
    if not PAT:
        print("❌ SUPABASE_PAT belum diset")
        sys.exit(1)
    with open(SQL_FILE, encoding="utf-8") as f:
        sql = f.read()
    print(f"Menjalankan {len(sql)} chars dari {SQL_FILE} ...")
    st, body = run_query(sql)
    print(f"HTTP {st}")
    print(body[:800])
    if st == 200:
        print("\n✅ SCHEMA TERPASANG!")
    else:
        print("\n⚠️ Ada error — lihat pesan di atas.")

if __name__ == "__main__":
    main()