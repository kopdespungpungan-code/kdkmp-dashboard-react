import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SO_SHEET_ID, SO_PETUGAS_GONDOLA } from '../config';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/* ===== Halaman SO — Stok Opname (route #/so) =====
   Panel lengkap: KPI + tabel per produk + detail produk.
   Tombol ke #/so-items (detail semua item) & #/so-input (input per petugas). */
export default function SoPage({ soRows, soStatus, onBackHome, onItems, onInput }) {
  const [soDetail, setSoDetail] = useState(null);
  const [filterPetugas, setFilterPetugas] = useState("all");
  const [filterGondola, setFilterGondola] = useState("all");
  const [search, setSearch] = useState("");

  // Ringkasan SO: total per lokasi + selisih + expired + petugas
  const soStats = useMemo(() => {
    const s = { grocery: 0, gudang: 0, system: 0, items: soRows.length, mode: soRows[0]?.mode || "classic" };
    const byProduct = {};
    soRows.forEach(r => {
      s.grocery += r.grocery;
      s.gudang += r.gudang;
      s.system += r.system;
      const k = r.produk.toUpperCase();
      const cur = byProduct[k];
      // Petugas: dari sheet kalau ada, kalau tidak dari mapping gondola
      let ptg = (r.petugas || "").trim();
      if (!ptg && r.gondola) {
        const g = parseInt(r.gondola, 10);
        if (!isNaN(g)) {
          for (const [a, b, n] of SO_PETUGAS_GONDOLA) {
            if (g >= a && g <= b) { ptg = n; break; }
          }
        }
      }
      if (cur) {
        cur.grocery += r.grocery; cur.gudang += r.gudang; cur.system += r.system;
        if (r.expired && (!cur.expired || r.expired < cur.expired)) cur.expired = r.expired; // terdekat
        if (ptg && !cur.petugas) cur.petugas = ptg;
        if (r.gondola && !cur.gondola) cur.gondola = r.gondola;
      } else {
        byProduct[k] = { produk: r.produk, grocery: r.grocery, gudang: r.gudang, system: r.system, expired: r.expired || "", petugas: ptg, gondola: r.gondola || "", satuan: r.satuan || "" };
      }
    });
    const fisik = s.grocery + s.gudang;
    s.fisik = fisik;
    s.selisih = fisik - s.system;
    s.list = Object.values(byProduct).map(p => ({ ...p, fisik: p.grocery + p.gudang, selisih: (p.grocery + p.gudang) - p.system }))
      .sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih));
    return s;
  }, [soRows]);

  const soDetailItem = useMemo(() => {
    if (!soDetail) return null;
    return soStats.list.find(p => p.produk === soDetail) || null;
  }, [soDetail, soStats]);

  // Daftar petugas & gondola untuk filter
  const petugasList = useMemo(() => {
    const s = new Set(soStats.list.map(p => p.petugas).filter(Boolean));
    return [...s].sort();
  }, [soStats]);

  const gondolaList = useMemo(() => {
    const s = new Set(soStats.list.map(p => p.gondola).filter(g => g !== "" && g !== undefined));
    return [...s].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [soStats]);

  // Filter + search
  const filteredList = useMemo(() => {
    let out = soStats.list.slice();
    if (filterPetugas !== "all") out = out.filter(p => p.petugas === filterPetugas);
    if (filterGondola !== "all") out = out.filter(p => String(p.gondola) === filterGondola);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(p => p.produk.toLowerCase().includes(q));
    }
    return out;
  }, [soStats, filterPetugas, filterGondola, search]);

  const openSoDetail = (produk) => setSoDetail(produk);
  const closeSoDetail = () => setSoDetail(null);

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="brand-logo" src="assets/logo-kopdes.jpg" alt="Logo KDKMP Pungpungan" />
          <div>
            <h1>SO — Stok Opname</h1>
            <span className="badge">Realtime</span>
          </div>
        </div>
        <div className="top-actions">
          {SO_SHEET_ID && (
            <Badge variant={soStatus.kind === "ok" ? "default" : "destructive"} className="chip-badge">{soStatus.txt}</Badge>
          )}
          <button className="so-nav-btn" onClick={onItems} title="Lihat detail semua item SO">📋 Detail Item</button>
          <button className="so-nav-btn" onClick={onInput} title="Input stok opname per petugas">✏️ Input SO</button>
          <button className="so-nav-btn" onClick={onBackHome} title="Kembali ke dashboard">🏠 Beranda</button>
        </div>
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.55, ease: "easeOut" }}
      >
        <Card className="scard">
          <CardHeader><CardTitle className="scard-title"><span className="dot" /> Ringkasan Stok</CardTitle></CardHeader>
          <CardContent>
            {!SO_SHEET_ID ? (
              <div className="empty-state so-empty">
                📋 <b>Panel SO (Stok Opname) siap.</b><br />
                Data stok diambil dari Google Form/Sheet SO.<br />
                <span className="so-hint">Setelah kamu kasih link/ID sheet SO, isi <code>SO_SHEET_ID</code> di <code>src/config.js</code> dan panel ini otomatis aktif.</span>
              </div>
            ) : !soRows.length ? (
              <div className="empty-state">Belum ada data stok opname</div>
            ) : (
              <>
                <div className="so-kpis">
                  <div className="so-kpi">
                    <div className="lbl">{soStats.mode === "gondola" ? "📦 Total Qty Fisik" : "🏪 Stock Grocery"}</div>
                    <div className="val">{soStats.grocery}</div>
                    <div className="sub">{soStats.mode === "gondola" ? "stok fisik dari sheet gondola" : "stok toko/etalase"}</div>
                  </div>
                  {soStats.mode === "gondola" ? (
                    <>
                      <div className="so-kpi">
                        <div className="lbl">🏬 Entri Gondola</div>
                        <div className="val">{soStats.items}</div>
                        <div className="sub">baris produk terisi</div>
                      </div>
                      <div className="so-kpi">
                        <div className="lbl">🧑‍🌾 Petugas</div>
                        <div className="val">{new Set(soStats.list.map(p => p.petugas).filter(Boolean)).size}</div>
                        <div className="sub">penanggung jawab gondola</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="so-kpi">
                        <div className="lbl">📦 Stock Gudang</div>
                        <div className="val">{soStats.gudang}</div>
                        <div className="sub">stok gudang</div>
                      </div>
                      <div className="so-kpi">
                        <div className="lbl">🖥️ Stock On System</div>
                        <div className="val">{soStats.system}</div>
                        <div className="sub">stok di sistem</div>
                      </div>
                    </>
                  )}
                  <div className={"so-kpi" + (soStats.mode === "gondola" ? "" : soStats.selisih === 0 ? "" : " so-mismatch")}>
                    <div className="lbl">{soStats.mode === "gondola" ? "⚡ Barang Terisi" : "⚖️ Selisih (Fisik − System)"}</div>
                    <div className="val">{soStats.mode === "gondola" ? soStats.list.length : (soStats.selisih > 0 ? "+" : "") + soStats.selisih}</div>
                    <div className="sub">{soStats.mode === "gondola" ? "produk unik" : "fisik " + soStats.fisik + " · " + soStats.items + " entri"}</div>
                  </div>
                </div>
                {/* Filter + search */}
                <div className="so-page-filters">
                  <select className="so-select" value={filterPetugas} onChange={e => { setFilterPetugas(e.target.value); setSoDetail(null); }}>
                    <option value="all">👤 Semua Petugas</option>
                    {petugasList.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select className="so-select" value={filterGondola} onChange={e => { setFilterGondola(e.target.value); setSoDetail(null); }}>
                    <option value="all">🏬 Semua Gondola</option>
                    {gondolaList.map(g => <option key={g} value={g}>Gondola {g}</option>)}
                  </select>
                  <input className="so-search" placeholder="🔍 cari produk…" value={search} onChange={e => setSearch(e.target.value)} />
                  {(filterPetugas !== "all" || filterGondola !== "all" || search) && (
                    <button className="so-filter-reset" onClick={() => { setFilterPetugas("all"); setFilterGondola("all"); setSearch(""); }}>
                      ✕ Reset
                    </button>
                  )}
                </div>
                <div className="so-result-info">Menampilkan <b>{filteredList.length}</b> dari {soStats.list.length} produk</div>

                {/* Card grid (mobile-first) */}
                <div className="so-cards">
                  {!filteredList.length ? (
                    <div className="so-empty-row">Tidak ada produk cocok dengan filter</div>
                  ) : filteredList.map((p, i) => (
                    <div className={"so-card" + (isExpiredSoon(p.expired) ? " so-card-warn" : "")} key={i} onClick={() => openSoDetail(p.produk)}>
                      <div className="so-card-head">
                        <div className="so-card-produk">{p.produk}</div>
                        <span className="so-card-qty">{p.grocery}</span>
                      </div>
                      <div className="so-card-meta">
                        {p.petugas && <span className="so-card-chip">👤 {p.petugas}</span>}
                        {p.gondola && <span className="so-card-chip">🏬 G.{p.gondola}</span>}
                        {soStats.mode === "gondola" && p.satuan && <span className="so-card-chip">📏 {p.satuan}</span>}
                      </div>
                      <div className="so-card-foot">
                        <span className={"so-card-exp" + (isExpiredSoon(p.expired) ? " so-exp-warn" : "")}>
                          {p.expired ? "⏳ " + fmtExpired(p.expired) : "⏳ —"}
                        </span>
                        {soStats.mode !== "gondola" && (
                          <span className={"so-card-sel" + (p.selisih > 0 ? " so-pos" : p.selisih < 0 ? " so-neg" : "")}>
                            {p.selisih > 0 ? "+" : ""}{p.selisih}
                          </span>
                        )}
                        <span className="so-card-open">Detail →</span>
                      </div>
                    </div>
                  ))}
                </div>
                {soDetailItem && (
                  <div className="so-detail">
                    <div className="so-detail-head">
                      <div>
                        <div className="so-detail-kicker">Detail SO</div>
                        <div className="so-detail-title">📦 {soDetailItem.produk}</div>
                      </div>
                      <button className="so-back" onClick={closeSoDetail}>← Tutup</button>
                    </div>
                    <div className="so-detail-grid">
                      <div className="so-detail-card">
                        <div className="lbl">{soStats.mode === "gondola" ? "📦 Qty Fisik" : "🏪 Stock Grocery"}</div>
                        <div className="val">{soDetailItem.grocery}</div>
                        <div className="sub">{soStats.mode === "gondola" ? "stok fisik" : "stok toko/etalase"}</div>
                      </div>
                      {soStats.mode === "gondola" ? (
                        <>
                          <div className="so-detail-card">
                            <div className="lbl">🏬 Gondola</div>
                            <div className="val">{soDetailItem.gondola || "—"}</div>
                            <div className="sub">lokasi rak</div>
                          </div>
                          <div className="so-detail-card">
                            <div className="lbl">📏 Satuan</div>
                            <div className="val">{soDetailItem.satuan || "—"}</div>
                            <div className="sub">unit</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="so-detail-card">
                            <div className="lbl">📦 Stock Gudang</div>
                            <div className="val">{soDetailItem.gudang}</div>
                            <div className="sub">stok gudang</div>
                          </div>
                          <div className="so-detail-card">
                            <div className="lbl">🖥️ Stock On System</div>
                            <div className="val">{soDetailItem.system}</div>
                            <div className="sub">stok di sistem</div>
                          </div>
                          <div className={"so-detail-card" + (soDetailItem.selisih === 0 ? "" : " so-mismatch")}>
                            <div className="lbl">⚖️ Selisih</div>
                            <div className="val">{soDetailItem.selisih > 0 ? "+" : ""}{soDetailItem.selisih}</div>
                            <div className="sub">fisik {soDetailItem.fisik} − system</div>
                          </div>
                        </>
                      )}
                      <div className={"so-detail-card" + (isExpiredSoon(soDetailItem.expired) ? " so-exp-warn" : "")}>
                        <div className="lbl">📅 Expired</div>
                        <div className="val">{soDetailItem.expired ? fmtExpired(soDetailItem.expired) : "—"}</div>
                        <div className="sub">{soDetailItem.expired ? (isExpiredSoon(soDetailItem.expired) ? "⚠️ dekat kadaluarsa / lewat" : "masih aman") : "tidak diisi"}</div>
                      </div>
                      <div className="so-detail-card">
                        <div className="lbl">🧑‍🌾 Petugas</div>
                        <div className="val so-petugas-val">{soDetailItem.petugas || "—"}</div>
                        <div className="sub">{soStats.mode === "gondola" ? "penanggung jawab gondola" : "petugas"}</div>
                      </div>
                    </div>
                    <div className="so-detail-note">
                      {soStats.mode === "gondola"
                        ? (soDetailItem.expired && isExpiredSoon(soDetailItem.expired)
                            ? "⚠️ Perhatian: expired dekat / sudah lewat — segera cek fisik barang."
                            : "✅ Catatan stok gondola: qty fisik + expired terpantau.")
                        : (soDetailItem.selisih === 0
                            ? "✅ Stok fisik sesuai sistem — tidak ada selisih."
                            : soDetailItem.selisih > 0
                              ? "⚠️ Stok fisik LEBIH BANYAK dari sistem (+" + soDetailItem.selisih + "). Periksa kemungkinan barang belum di-input / salah catat."
                              : "⚠️ Stok fisik KURANG dari sistem (" + soDetailItem.selisih + "). Periksa kemungkinan barang hilang / salah input / belum dicatat.")}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function fmtExpired(v) {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  return String(v);
}

function isExpiredSoon(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  if (isNaN(t)) return false;
  return t < Date.now() + 30 * 86400000;
}
