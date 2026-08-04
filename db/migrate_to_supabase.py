#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KDKMP — MIGRASI DATA ke Supabase (PostgREST, service_role).
Sumber: SO Master Excel + Google Sheet Grocery Fresh + sheet gudang.

Persiapan:
  1. Pastikan schema sudah terpasang (SQL Editor / supabase db push).
  2. Jalankan:  py -3.11 db/migrate_to_supabase.py

Alur:
  - products      : dari SO Master (kode, nama) + opname (produk baru tanpa kode)
  - stock_system  : STOCK AKHIR dari SO Master per produk
  - gudang        : CONVERT PCS dari sheet gudang
  - stock_opname  : Qty Fisik opname per produk (tanggal=hari ini, minggu_ke, bulan)
  - petugas       : seed DEDIK/RISTA/PANDU/VYRDA (id UUID tetap agar opname bisa link)
"""
import json, os, re, sys, uuid, urllib.request
from datetime import date
from openpyxl import load_workbook

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = r"K:/Drive Saya/KOPDES PUNGPUNGAN/GERAI/AI/laporan/Update_SO_MASTER_dan_SO_Bulanan_Juli_2026_20260801_162255/SO_MASTER_UPDATED_ACUAN_JULI_2026_20260801_162255.xlsx"
SHEET_ID = "1V6dStO_eyyrfSw-a5686JS4SbabAAZih"

SB_URL = os.environ.get("SUPABASE_URL", "https://mjooqlmsswsykefaolih.supabase.co")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PETUGAS_DEFAULT = [
    ("VYRDA", uuid.UUID("11111111-1111-4111-8111-111111111111")),
    ("PANDU", uuid.UUID("22222222-2222-4222-8222-222222222222")),
    ("RISTA", uuid.UUID("33333333-3333-4333-8333-333333333333")),
    ("DEDIK", uuid.UUID("44444444-4444-4444-8444-444444444444")),
]
GONDOLA_PETUGAS = [(1,12,"VYRDA"),(13,24,"PANDU"),(25,36,"RISTA"),(37,48,"DEDIK")]

def num(v):
    if v is None: return 0
    if isinstance(v, (int, float)): return int(v)
    try: return int(float(str(v).replace(".", "").replace(",", ".")))
    except (ValueError, TypeError): return 0

def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())

def postgrest(path, payload=None, method="GET"):
    url = f"{SB_URL}/rest/v1/{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SB_KEY)
    req.add_header("Authorization", f"Bearer {SB_KEY}")
    if payload is not None:
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "return=representation")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(body) if body else [])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        return e.code, (json.loads(body) if body else {"error": str(e)})

def check_schema():
    st, _ = postgrest("products?select=id&limit=1")
    if st in (200, 206):
        return True
    print(f"❌ Tabel products belum ada (HTTP {st}). Pasang schema dulu:")
    print("   - Supabase Dashboard → SQL Editor → jalankan db/supabase_schema.sql")
    print("   atau: supabase db push")
    return False

def fetch_master():
    wb = load_workbook(MASTER, data_only=True)
    products, sistem_map, gudang_map = [], {}, {}
    ws = wb["JULI"]
    header = [str(c.value or "").strip() if c.value else "" for c in ws[1]]
    def hfind(*keys):
        for i, h in enumerate(header):
            hn = norm(h)
            if any(k in hn for k in keys): return i
        return None
    iNama, iKode, iSistem = hfind("namabarang","nama"), hfind("kode"), hfind("stockakhir","stockbulanterkhir","stock")
    for r in ws.iter_rows(min_row=2, values_only=True):
        nama = str(r[iNama] or "").strip() if iNama is not None and r[iNama] else ""
        if not nama: continue
        kode = str(r[iKode] or "").strip() if iKode is not None and r[iKode] else f"UNK-{uuid.uuid4().hex[:6].upper()}"
        sistem = num(r[iSistem]) if iSistem is not None else 0
        products.append({"kode": kode, "nama": nama})
        sistem_map[norm(nama)] = sistem
    if "gudang" in wb.sheetnames:
        ws = wb["gudang"]
        for r in ws.iter_rows(min_row=5, values_only=True):
            if not r or len(r) < 7: continue
            nama = str(r[2] or "").strip()
            if not nama: continue
            gudang_map[norm(nama)] = num(r[6])
    print(f"Master: {len(products)} produk, gudang {len(gudang_map)} item")
    return products, sistem_map, gudang_map

def fetch_opname():
    req = urllib.request.Request(f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json", headers={"User-Agent": "Mozilla/5.0"})
    txt = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    i, j = txt.find("{"), txt.rfind("}")
    data = json.loads(txt[i:j+1])
    rows = data.get("table", {}).get("rows", [])
    agg, cur_gond = {}, ""
    for r in rows:
        c = r.get("c") or []
        get = lambda k: (c[k] or {}).get("v") if k < len(c) and c[k] else None
        if get(1) is not None: cur_gond = str(get(1)).strip()
        produk = str(get(3) or "").strip()
        if not produk or produk == "-": continue
        qty = num(get(5))
        try: gond_num = int(float(cur_gond)) if cur_gond else 0
        except ValueError: gond_num = 0
        ptg = ""
        for a,b,n in GONDOLA_PETUGAS:
            if a <= gond_num <= b: ptg = n
        key = norm(produk)
        if key not in agg:
            agg[key] = {"nama": produk, "fisik": 0, "gondola": cur_gond, "petugas": ptg}
        agg[key]["fisik"] += qty
        if ptg: agg[key]["petugas"] = ptg
    print(f"Opname: {len(agg)} produk")
    return agg

def upsert(path, rows, batch=200):
    total = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i+batch]
        st, body = postgrest(path, chunk, method="POST")
        if st in (200, 201, 204):
            total += len(chunk)
        else:
            print(f"  ⚠️ {path} batch {i//batch}: HTTP {st} {str(body)[:120]}")
    print(f"  ✅ {path}: {total}/{len(rows)}")
    return total

def main():
    if not SB_KEY:
        print("❌ SUPABASE_SERVICE_ROLE_KEY belum diset. Ekspor dari profile .env dulu.")
        sys.exit(1)
    if not check_schema():
        sys.exit(1)

    products, sistem_map, gudang_map = fetch_master()
    opname = fetch_opname()

    # Gabung produk: master + opname (produk opname yang tidak ada di master tetap masuk)
    master_norm = {norm(p["nama"]): p for p in products}
    all_products = list(products)
    opname_keys_seen = set()
    for key, o in opname.items():
        if key not in master_norm:
            all_products.append({"kode": f"OPN-{uuid.uuid4().hex[:6].upper()}", "nama": o["nama"]})
        opname_keys_seen.add(key)
    print(f"Total produk gabungan: {len(all_products)}")

    # 1. Products
    st, existing = postgrest("products?select=kode,nama")
    existing_kode = {r["kode"] for r in existing} if st in (200,206) else set()
    new_products = [{"kode": p["kode"], "nama": p["nama"], "satuan": "PCS"} for p in all_products if p["kode"] not in existing_kode]
    if new_products:
        upsert("products", new_products)

    # Map nama -> produk_id
    st, prods = postgrest("products?select=id,kode,nama")
    id_by_norm = {norm(p["nama"]): p["id"] for p in prods}

    # 2. stock_system
    st, existing = postgrest("stock_system?select=produk_id")
    existing_ids = {r["produk_id"] for r in existing} if st in (200,206) else set()
    rows = []
    for key, sistem in sistem_map.items():
        pid = id_by_norm.get(key)
        if pid and pid not in existing_ids:
            rows.append({"produk_id": pid, "stok_akhir": sistem})
    if rows: upsert("stock_system", rows)

    # 3. gudang
    st, existing = postgrest("gudang?select=produk_id")
    existing_ids = {r["produk_id"] for r in existing} if st in (200,206) else set()
    rows = []
    for key, qty in gudang_map.items():
        pid = id_by_norm.get(key)
        if pid and pid not in existing_ids:
            rows.append({"produk_id": pid, "qty_pcs": qty, "tanggal_rekap": date.today().isoformat()})
    if rows: upsert("gudang", rows)

    # 4. stock_opname (sekali per produk; jangan duplikat di tanggal sama)
    today = date.today().isoformat()
    minggu_ke = min(4, (date.today().day - 1) // 7 + 1)
    bulan = date.today().strftime("%B %Y")
    st, existing = postgrest(f"stock_opname?select=produk_id&tanggal=eq.{today}")
    existing_ids = {r["produk_id"] for r in existing} if st in (200,206) else set()
    rows = []
    for key, o in opname.items():
        pid = id_by_norm.get(key)
        if not pid or pid in existing_ids: continue
        petugas_id = None
        for _, _, n in GONDOLA_PETUGAS:
            if o["petugas"] == n:
                petugas_id = str(dict(PETUGAS_DEFAULT)[n])
        rows.append({
            "produk_id": pid,
            "petugas_id": petugas_id,
            "gondola": num(o["gondola"]),
            "qty_fisik": o["fisik"],
            "tanggal": today,
            "minggu_ke": minggu_ke,
            "bulan": bulan,
        })
    if rows: upsert("stock_opname", rows)

    # 5. petugas seed (jika tabel kosong)
    st, existing = postgrest("petugas?select=id")
    if st in (200,206) and not existing:
        rows = [{"id": str(uid), "nama": nama, "pin_hash": "seed", "gondola_assigned": []} for nama, uid in PETUGAS_DEFAULT]
        upsert("petugas", rows)

    print("\n✅ Migrasi selesai!")
    print(f"   Products : {len(prods)} di DB")
    print(f"   Opname   : {len(rows)} baris (tanggal {today}, minggu {minggu_ke})")

if __name__ == "__main__":
    main()