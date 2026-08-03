import { SHEET_URL, SO_SHEET_URL } from '../config';
import { parseDate, toKey, parseNum } from './utils';

async function fetchGviz(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  let txt = await res.text();
  const i = txt.indexOf("{"), j = txt.lastIndexOf("}");
  if (i < 0 || j < 0) throw new Error("Format data tidak dikenali");
  const data = JSON.parse(txt.slice(i, j + 1));
  if (data.status !== "ok") throw new Error(data.errors ? data.errors[0].detailed_message : "Status " + data.status);
  return (data.table && data.table.rows) || [];
}

export async function fetchSheet() {
  const rows = await fetchGviz(SHEET_URL);
  const out = [];
  for (const r of rows) {
    const c = r.c || [];
    const get = (k) => (c[k] && c[k].v !== undefined && c[k].v !== null) ? c[k].v : null;
    const tgl = parseDate(get(1));
    if (!tgl) continue;
    const omset = parseNum(get(2));
    const gross = parseNum(get(3));
    const petugas = String(get(4) || "").trim() || "—";
    const struk = String(get(5) || "").split(/[,\s]+/).map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));
    out.push({ date: tgl, key: toKey(tgl), omset, gross, petugas, struk });
  }
  out.sort((a, b) => a.date - b.date);
  return out;
}

/**
 * Baca spreadsheet SO (Stok Opname).
 * Kolom dideteksi dari baris header: "produk/nama", "grocery", "gudang", "on system/sistem".
 * Baris dengan produk kosong di-skip. Mengembalikan array { produk, grocery, gudang, system }.
 */
export async function fetchSoSheet() {
  if (!SO_SHEET_URL) return [];
  const rows = await fetchGviz(SO_SHEET_URL);
  const out = [];
  if (!rows.length) return out;

  // Header di baris pertama (respons form) — cari nama kolom
  const header = (rows[0].c || []).map(h => String((h && h.v) || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  const idx = (keys) => header.findIndex(h => keys.some(k => h.includes(k)));
  const iProduk = idx(["produk", "nama", "barang", "item"]);
  const iGrocery = idx(["grocery", "etalase", "toko"]);
  const iGudang = idx(["gudang", "warehouse"]);
  const iSystem = idx(["onsystem", "sistem", "system", "on"]);
  if (iProduk < 0 || (iGrocery < 0 && iGudang < 0 && iSystem < 0)) {
    // header tidak dikenal — fallback: urutan umum (tanggal, produk, grocery, gudang, system)
    const guess = (k) => k < (rows[0].c || []).length ? (rows[0].c[k] || {}).v : null;
    void guess;
    return out;
  }

  for (const r of rows) {
    const c = r.c || [];
    const get = (k) => (k >= 0 && c[k] && c[k].v !== undefined && c[k].v !== null) ? c[k].v : null;
    const produk = String(get(iProduk) || "").trim();
    if (!produk) continue;
    out.push({
      produk,
      grocery: parseNum(get(iGrocery)),
      gudang: parseNum(get(iGudang)),
      system: parseNum(get(iSystem)),
    });
  }
  return out;
}

export function dummyRows() {
  const mk = (d, m, o, g, p) => ({ date: new Date(2026, m - 1, d), key: toKey(new Date(2026, m - 1, d)), omset: o, gross: g, petugas: p, struk: [] });
  return [
    mk(1,7,174850,274850,"RISTA"), mk(2,7,116200,217000,"Vyrda"), mk(3,7,131500,232100,"Vyrda"),
    mk(4,7,157950,258100,"Vyrda"), mk(5,7,85850,185850,"DEDIK KURNIAWAN"), mk(6,7,19200,119200,"DEDIK KURNIAWAN"),
    mk(7,7,35100,135100,"ARISTA"), mk(8,7,193100,293100,"vyrda"), mk(9,7,54500,155500,"vyrda"),
    mk(10,7,176950,276950,"Pandu Setyawan"), mk(11,7,7700,107700,"Dedik dan Melinda"), mk(12,7,136700,236700,"DEDIK"),
    mk(13,7,127350,227500,"Melinda Nurul Hidayah"), mk(14,7,116550,216550,"pandu"), mk(15,7,46750,149000,"Melinda Nurul Hidayah"),
    mk(16,7,218050,319050,"Melinda Nurul Hidayah"), mk(17,7,316100,416450,"Dedik kurniawan"), mk(18,7,129800,229400,"vyrda"),
    mk(19,7,103450,205000,"vyrda"),
  ];
}
