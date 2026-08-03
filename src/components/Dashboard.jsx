import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CONFIG, PER_PAGE, SO_SHEET_ID, SO_PETUGAS_GONDOLA } from '../config';
import { fetchSheet, fetchSoSheet, dummyRows } from '../lib/sheet';
import { fmtRp, fmtDate, toMonthKey, monthLabel, pad2, isToday, nowLabel } from '../lib/utils';
import { TOD_META } from '../lib/daytime';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import SoItemsPage from './SoItemsPage';
import SoInputPage from './SoInputPage';

export default function Dashboard({ onLock, theme, onToggleTheme, weather, weatherEnabled, onToggleWeather, tod }) {
  const [rows, setRows] = useState([]);      // semua
  const [soRows, setSoRows] = useState([]);  // stok opname
  const [soStatus, setSoStatus] = useState({ kind: "ok", txt: "● SO" });
  const [soDetail, setSoDetail] = useState(null); // produk yang dibuka detailnya
  const [soPage, setSoPage] = useState(null);      // "items" | "input" (route tambahan)
  // Default filter: bulan SAAT INI (bulan berjalan)
  const [month, setMonth] = useState(() => toMonthKey(new Date()));
  const [dStart, setDStart] = useState("");
  const [dEnd, setDEnd] = useState("");
  const [status, setStatus] = useState({ kind: "ok", txt: "● Terhubung" });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(nowLabel());
  const [page, setPage] = useState(0);

  // Filter otomatis dari rows + pilihan bulan/rentang tanggal
  const filtered = useMemo(() => {
    let out = month === "all" ? rows.slice() : rows.filter(r => toMonthKey(r.date) === month);
    if (dStart) out = out.filter(r => r.date >= new Date(dStart));
    if (dEnd) {
      const e = new Date(dEnd); e.setHours(23, 59, 59, 999);
      out = out.filter(r => r.date <= e);
    }
    return out;
  }, [rows, month, dStart, dEnd]);

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const raw = await fetchSheet();
      setRows(raw);
      setStatus({ kind: "ok", txt: "● Terhubung" });
      setAlert(null);
      setUpdated(nowLabel());
    } catch (err) {
      console.error(err);
      setStatus({ kind: "err", txt: "● Gagal" });
      if (!rows.length) {
        setRows(dummyRows());
        setStatus({ kind: "warn", txt: "● Data contoh" });
        setAlert({ kind: "warn", msg: "Gagal memuat data dari spreadsheet. Menampilkan data contoh.<br>Pastikan spreadsheet di-publish: <b>File → Share → Publish to web</b>." });
      } else {
        setAlert({ kind: "err", msg: "Gagal memuat data terbaru. Menampilkan data sebelumnya." });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);
  // Jika bulan default (saat ini) tidak ada di data, fallback ke Semua Periode
  useEffect(() => {
    if (rows.length) {
      const ks = new Set(rows.map(r => toMonthKey(r.date)));
      setMonth(prev => (ks.has(prev) ? prev : "all"));
    }
  }, [rows]);
  useEffect(() => {
    const t = setInterval(() => load(true), CONFIG.REFRESH_MINUTES * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ---- SO (Stok Opname) ----
  const loadSo = async () => {
    if (!SO_SHEET_ID) { setSoRows([]); return; }
    try {
      const raw = await fetchSoSheet();
      setSoRows(raw);
      setSoStatus({ kind: "ok", txt: "● SO" });
    } catch (err) {
      console.error(err);
      setSoStatus({ kind: "err", txt: "● SO gagal" });
    }
  };
  useEffect(() => { loadSo(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setInterval(() => loadSo(), CONFIG.REFRESH_MINUTES * 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
        byProduct[k] = { produk: r.produk, grocery: r.grocery, gudang: r.gudang, system: r.system, expired: r.expired || "", petugas: ptg, gondola: r.gondola || "" };
      }
    });
    const fisik = s.grocery + s.gudang;
    s.fisik = fisik;
    s.selisih = fisik - s.system;
    s.list = Object.values(byProduct).map(p => ({ ...p, fisik: p.grocery + p.gudang, selisih: (p.grocery + p.gudang) - p.system }))
      .sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih));
    return s;
  }, [soRows]);

  // ---- Route detail SO (hash #/so/<produk>) ----
  const openSoDetail = (produk) => {
    setSoDetail(produk);
    try { history.replaceState(null, "", "#/so/" + encodeURIComponent(produk)); } catch (e) {}
  };
  const closeSoDetail = () => {
    setSoDetail(null);
    try { history.replaceState(null, "", "#"); } catch (e) {}
  };
  const goSoItems = () => {
    setSoPage("items");
    try { history.replaceState(null, "", "#/so-items"); } catch (e) {}
  };
  const goSoInput = () => {
    setSoPage("input");
    try { history.replaceState(null, "", "#/so-input"); } catch (e) {}
  };
  const closeSoPage = () => {
    setSoPage(null);
    try { history.replaceState(null, "", "#"); } catch (e) {}
  };
  useEffect(() => {
    const onHash = () => {
      const m = window.location.hash.match(/^#\/so\/(.+)$/);
      if (m) { try { setSoDetail(decodeURIComponent(m[1])); setSoPage(null); } catch (e) {} }
      else if (window.location.hash.startsWith("#/so-items")) { setSoDetail(null); setSoPage("items"); }
      else if (window.location.hash.startsWith("#/so-input")) { setSoDetail(null); setSoPage("input"); }
    };
    window.addEventListener("hashchange", onHash);
    onHash(); // baca hash awal (mis. buka langsung dari URL)
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Produk detail yang sedang dibuka (dari soStats.list)
  const soDetailItem = useMemo(() => {
    if (!soDetail) return null;
    return soStats.list.find(p => p.produk === soDetail) || null;
  }, [soDetail, soStats]);

  const months = useMemo(() => [...new Set(rows.map(r => toMonthKey(r.date)))].sort().reverse(), [rows]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.omset, 0);
    const gross = filtered.reduce((s, r) => s + r.gross, 0);
    const days = new Set(filtered.map(r => r.key)).size;
    const avg = days ? total / days : 0;
    const byDay = {};
    filtered.forEach(r => { byDay[r.key] = (byDay[r.key] || 0) + r.omset; });
    let best = null;
    for (const k in byDay) if (!best || byDay[k] > best.v) best = { k, v: byDay[k] };
    return { total, gross, days, avg, best };
  }, [filtered]);

  const chart = useMemo(() => {
    const byDay = {};
    filtered.forEach(r => { byDay[r.key] = (byDay[r.key] || 0) + r.omset; });
    const keys = Object.keys(byDay).sort();
    const max = Math.max(...Object.values(byDay));
    const todayStr = (() => { const t = new Date(); return t.getFullYear() + "-" + pad2(t.getMonth() + 1) + "-" + pad2(t.getDate()); })();
    return { keys, max, todayStr };
  }, [filtered]);

  const petugas = useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      const k = r.petugas.toUpperCase();
      const cur = map.get(k);
      if (cur) { cur.v += r.omset; if (r.petugas.length > cur.name.length) cur.name = r.petugas; }
      else map.set(k, { name: r.petugas, v: r.omset });
    });
    return [...map.values()].sort((a, b) => b.v - a.v);
  }, [filtered]);

  const paged = useMemo(() => {
    const all = filtered.slice().reverse();
    const tp = Math.max(1, Math.ceil(all.length / PER_PAGE));
    const p = Math.min(page, tp - 1);
    return { rows: all.slice(p * PER_PAGE, (p + 1) * PER_PAGE), totalPages: tp, page: p };
  }, [filtered, page]);

  const strukLinks = (r) => {
    if (!r.struk || !r.struk.length) return <span className="no-struk">—</span>;
    return r.struk.map((u, i) => (
      <a key={i} className="link-struk" href={u} target="_blank" rel="noopener"
         onClick={(e) => { e.preventDefault(); openStrukPreview(u); }}>
        📄 Struk {i + 1}
      </a>
    ));
  };

  const exportPDF = () => {
    if (!filtered.length) { setAlert("err", "Belum ada data untuk periode ini."); return; }
    const periode = month === "all" ? "Semua Periode" : monthLabel(month);
    const byDay = {};
    filtered.forEach(r => { byDay[r.key] = (byDay[r.key] || 0) + r.omset; });
    let best = null;
    for (const k in byDay) if (!best || byDay[k] > best.v) best = { k, v: byDay[k] };
    const sorted = filtered.slice().reverse();
    const rowHtml = sorted.map(r =>
      "<tr><td>" + fmtDate(r.date) + "</td><td>" + escapeHtml(r.petugas) + "</td>" +
      '<td class="num">' + fmtRp(r.omset) + '</td><td class="num">' + fmtRp(r.gross) + "</td>" +
      '<td class="num">' + (r.struk ? r.struk.length : 0) + "</td></tr>"
    ).join("");
    const petHtml = petugas.map(p => "<tr><td>" + escapeHtml(p.name) + '</td><td class="num">' + fmtRp(p.v) + "</td></tr>").join("");
    const now = new Date().toLocaleString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const w = window.open("", "_blank");
    if (!w) { setAlert("err", "Popup diblokir browser. Izinkan popup lalu coba lagi."); return; }
    w.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Penjualan KDKMP</title>' +
      '<style>@page{size:A4;margin:16mm 12mm}*{box-sizing:border-box}body{font-family:Segoe UI,sans-serif;color:#111827;margin:0;padding:24px;font-size:12px}' +
      'h1{font-size:20px;margin:0 0 2px}.sub{color:#6b7280;margin-bottom:16px}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #111827;padding-bottom:4px}' +
      'table{width:100%;border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;font-size:11.5px}th{background:#f3f4f6;text-transform:uppercase}' +
      '.num{text-align:right}.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}.kpi .box{border:1px solid #d1d5db;border-radius:8px;padding:10px 12px}' +
      '.kpi .lbl{font-size:10px;color:#6b7280;text-transform:uppercase}.kpi .val{font-size:16px;font-weight:700;margin-top:4px}.kpi .subl{font-size:10.5px;color:#6b7280}' +
      '.footer{margin-top:24px;color:#6b7280;font-size:10.5px;text-align:center;border-top:1px solid #e5e7eb;padding-top:10px}' +
      '@media print{body{padding:0}.kpi .box{page-break-inside:avoid}tr{page-break-inside:avoid}}</style></head><body>' +
      '<h1>📊 Laporan Penjualan KDKMP Pungpungan</h1><div class="sub">Periode: <b>' + escapeHtml(periode) + '</b> · Dicetak: ' + escapeHtml(now) + '</div>' +
      '<h2>Ringkasan</h2><div class="kpi">' +
      '<div class="box"><div class="lbl">Total Omset</div><div class="val">' + fmtRp(stats.total) + '</div><div class="subl">' + stats.days + ' hari</div></div>' +
      '<div class="box"><div class="lbl">Pendapatan Kotor</div><div class="val">' + fmtRp(stats.gross) + '</div><div class="subl">omset + modal</div></div>' +
      '<div class="box"><div class="lbl">Rata-rata / Hari</div><div class="val">' + fmtRp(stats.avg) + '</div><div class="subl">' + stats.days + ' hari</div></div>' +
      '<div class="box"><div class="lbl">Tertinggi / Hari</div><div class="val">' + fmtRp(best ? best.v : 0) + '</div><div class="subl">' + (best ? best.k.split("-").reverse().join("/") : "—") + '</div></div>' +
      '</div><h2>Kontribusi Petugas</h2><table><thead><tr><th>Petugas</th><th class="num">Total Omset</th></tr></thead><tbody>' + petHtml + '</tbody></table>' +
      '<h2>Rincian Harian</h2><table><thead><tr><th>Tanggal</th><th>Petugas</th><th class="num">Omset</th><th class="num">Pendapatan Kotor</th><th class="num">Struk</th></tr></thead><tbody>' + rowHtml + '</tbody></table>' +
      '<div class="footer">Data bersumber dari Google Spreadsheet · Dashboard Penjualan KDKMP</div></body></html>');
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 800);
  };

  return (
    <div id="dash" className="wrap">
      <div className="top">
        <div className="brand">
          <img className="brand-logo" src="/assets/logo-kopdes.jpg" alt="Logo KDKMP Pungpungan" />
          <div>
            <h1>Dashboard Penjualan KDKMP PUNGPUNGAN</h1>
            <span className="badge">Realtime</span>
          </div>
        </div>
        <div className="top-actions">
          <Badge variant={status.kind === "ok" ? "default" : status.kind === "warn" ? "secondary" : "destructive"} className="chip-badge">
            {status.txt}
          </Badge>
          <Badge variant="outline" className="chip-badge">🕒 {updated}</Badge>
          {tod && TOD_META[tod] && (
            <Badge variant="outline" className="chip-badge tod-chip" title={"Periode " + TOD_META[tod].label}>
              {TOD_META[tod].icon} {TOD_META[tod].label}
            </Badge>
          )}
          {weather && (
            <Badge variant="outline" className={"chip-badge weather-chip" + (weather.cond === "rain" || weather.cond === "storm" ? " weather-wet" : "")} title={"Cuaca " + weather.location}>
              {weather.icon} {weather.temp}°C · {weather.label}
            </Badge>
          )}
          <button
            className={"weather-toggle" + (weatherEnabled ? " on" : "")}
            onClick={onToggleWeather}
            title="Tema otomatis ikut cuaca (on/off)"
            aria-pressed={weatherEnabled}
          >
            <span className="wt-track"><span className="wt-thumb" /></span>
            <span className="wt-label">{weatherEnabled ? "Auto Cuaca" : "Manual"}</span>
          </button>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => load(false)}>{loading ? "Memuat…" : "⟳ Refresh"}</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}>🖨️ Laporan PDF</Button>
          <Button variant="outline" size="sm" id="themeBtn" onClick={onToggleTheme} disabled={weatherEnabled && !!weather} title={weatherEnabled && weather ? "Terang/Gelap otomatis ikut cuaca — matikan Auto Cuaca untuk ganti manual" : "Ganti tema terang/gelap"}>
            {weatherEnabled && weather ? "🌦️ Auto" : theme === "dark" ? "☀️ Terang" : "🌙 Gelap"}
          </Button>
          <Button variant="destructive" size="sm" onClick={onLock}>🔒 Kunci</Button>
        </div>
      </div>

      {alert && <div className={"alert " + alert.kind + " show"} dangerouslySetInnerHTML={{ __html: alert.msg }} />}

      <div className="filters">
        <Select value={month} onValueChange={(v) => { setMonth(v); setPage(0); }}>
          <SelectTrigger className="filter-select"><SelectValue placeholder="Semua Periode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Periode</SelectItem>
            {months.map(k => <SelectItem key={k} value={k}>{monthLabel(k)}</SelectItem>)}
          </SelectContent>
        </Select>
        <input type="date" className="filter-date" value={dStart} title="Cari dari tanggal"
          onChange={(e) => { setDStart(e.target.value); setPage(0); }} />
        <span className="filter-sep">s/d</span>
        <input type="date" className="filter-date" value={dEnd} title="Cari sampai tanggal"
          onChange={(e) => { setDEnd(e.target.value); setPage(0); }} />
        <Button variant="outline" size="sm" onClick={() => { setDStart(""); setDEnd(""); setPage(0); }} title="Hapus filter tanggal">✕ Reset</Button>
      </div>
      {(dStart || dEnd) && (
        <div className="filter-info show">
          🔍 Rentang {dStart ? fmtDate(new Date(dStart)) : "awal"} – {dEnd ? fmtDate(new Date(dEnd)) : "akhir"} → {filtered.length} baris ({new Set(filtered.map(r => r.key)).size} hari)
        </div>
      )}

      <div className="stats">
        {[
          { lbl: "Total Omset", val: stats.total, sub: stats.days + " hari" },
          { lbl: "Pendapatan Kotor", val: stats.gross, sub: "omset + modal" },
          { lbl: "Hari Input", val: stats.days, sub: filtered.length + " baris", raw: true },
          { lbl: "Rata-rata / Hari", val: stats.avg, sub: "dari " + stats.days + " hari" },
          { lbl: "Tertinggi / Hari", val: stats.best ? stats.best.v : 0, sub: stats.best ? stats.best.k.split("-").reverse().join("/") : "—" },
        ].map((c, idx) => (
          <motion.div
            className="stat"
            key={c.lbl}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + idx * 0.07, duration: 0.5, ease: "easeOut" }}
            whileHover={{ y: -4, boxShadow: "0 14px 34px rgba(0,0,0,.45)" }}
          >
            <div className="lbl">{c.lbl}</div>
            <div className="val">
              {c.raw ? c.val : <CountUp value={c.val} />}
            </div>
            <div className="sub">{c.sub}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.55, ease: "easeOut" }}
      >
        <Card className="scard">
          <CardHeader>
            <CardTitle className="scard-title">
              <span className="dot" /> SO — Stok Opname
              {SO_SHEET_ID && (
                <Badge variant={soStatus.kind === "ok" ? "default" : "destructive"} className="chip-badge">{soStatus.txt}</Badge>
              )}
              {SO_SHEET_ID && (
                <span className="so-nav-btns">
                  <button className="so-nav-btn" onClick={goSoItems} title="Lihat detail semua item SO">📋 Detail Item</button>
                  <button className="so-nav-btn" onClick={goSoInput} title="Input stok opname per petugas">✏️ Input SO</button>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {soPage === "items" ? (
              <SoItemsPage onBack={closeSoPage} soRows={soRows} />
            ) : soPage === "input" ? (
              <SoInputPage onBack={closeSoPage} soRows={soRows} />
            ) : !SO_SHEET_ID ? (
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
                <div className="so-table-wrap">
                  <table className="so-table">
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>Petugas</th>
                        <th className="num">Gondola</th>
                        <th className="num">{soStats.mode === "gondola" ? "Qty Fisik" : "Grocery"}</th>
                        {soStats.mode !== "gondola" && <th className="num">Gudang</th>}
                        {soStats.mode !== "gondola" && <th className="num">Fisik</th>}
                        <th className="num">{soStats.mode === "gondola" ? "Satuan" : "System"}</th>
                        <th className="num">Expired</th>
                        {soStats.mode !== "gondola" && <th className="num">Selisih</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {soStats.list.map((p, i) => (
                        <tr key={i} className={p.selisih === 0 ? "" : "so-row-mismatch"}>
                          <td>
                            <button className="so-prod-link" onClick={() => openSoDetail(p.produk)} title={"Buka detail " + p.produk}>
                              {p.produk} →
                            </button>
                          </td>
                          <td className="so-petugas">{p.petugas || "—"}</td>
                          <td className="num">{p.gondola || "—"}</td>
                          <td className="num">{p.grocery}</td>
                          {soStats.mode !== "gondola" && <td className="num">{p.gudang}</td>}
                          {soStats.mode !== "gondola" && <td className="num">{p.fisik}</td>}
                          <td className="num">{soStats.mode === "gondola" ? (p.satuan || "—") : p.system}</td>
                          <td className={"num so-exp" + (isExpiredSoon(p.expired) ? " so-exp-warn" : "")}>
                            {p.expired ? fmtExpired(p.expired) : "—"}
                          </td>
                          {soStats.mode !== "gondola" && (
                            <td className={"num so-sel" + (p.selisih > 0 ? " so-pos" : p.selisih < 0 ? " so-neg" : "")}>
                              {p.selisih > 0 ? "+" : ""}{p.selisih}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {soDetailItem && (
                  <div className="so-detail">
                    <div className="so-detail-head">
                      <div>
                        <div className="so-detail-kicker">Detail SO</div>
                        <div className="so-detail-title">📦 {soDetailItem.produk}</div>
                      </div>
                      <button className="so-back" onClick={closeSoDetail}>← Kembali ke SO</button>
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

      <motion.div
              className="card"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.55, ease: "easeOut" }}
            >
              <Card className="scard">
                <CardHeader><CardTitle className="scard-title"><span className="dot" /> Omset per Tanggal</CardTitle></CardHeader>
                <CardContent>
                <div className="chart-scroll">
                <div className="chart">
                  {!chart.keys.length ? <div className="chart-empty">Belum ada data periode ini</div> : chart.keys.map((k, i) => {
                    const v = (() => { let s = 0; filtered.forEach(r => { if (r.key === k) s += r.omset; }); return s; })();
                    const h = Math.max(3, Math.round((v / chart.max) * 100));
                    const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
                    const high = v === chart.max;
                    const today = k === chart.todayStr;
                    return (
                      <div className="bar-col" key={k} title={fmtDate(d) + " — " + fmtRp(v)}>
                        <span className="bar-val">{fmtRp(v)}</span>
                        <motion.div
                          className={"bar" + (high ? " high" : "")}
                          initial={{ height: 0 }}
                          animate={{ height: h + "%" }}
                          transition={{ delay: 0.35 + i * 0.02, duration: 0.5, ease: "easeOut" }}
                          whileHover={{ opacity: 0.85 }}
                        />
                        <span className="bar-label" style={today ? { color: "var(--green)", fontWeight: 700 } : undefined}>{pad2(d.getDate())}</span>
                      </div>
                    );
                  })}
                </div>
                </div>
                </CardContent>
              </Card>
            </motion.div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.55, ease: "easeOut" }}
      >
        <Card className="scard">
          <CardHeader><CardTitle className="scard-title"><span className="dot" /> Kontribusi Petugas</CardTitle></CardHeader>
          <CardContent>
          <div className="petugas">
          {!petugas.length ? <div className="empty-state">Belum ada data</div> : petugas.map((p, idx) => (
            <motion.div
              className="pet-row"
              key={p.name}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + idx * 0.06, duration: 0.4 }}
            >
              <div className="pet-name" title={p.name}>{p.name}</div>
              <div className="pet-track">
                <motion.div
                  className="pet-fill"
                  initial={{ width: 0 }}
                  animate={{ width: Math.max(4, Math.round(p.v / petugas[0].v * 100)) + "%" }}
                  transition={{ delay: 0.5 + idx * 0.06, duration: 0.6, ease: "easeOut" }}
                />
              </div>
              <div className="pet-val">{fmtRp(p.v)}</div>
            </motion.div>
          ))}
        </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.55, ease: "easeOut" }}
      >
        <Card className="scard">
          <CardHeader><CardTitle className="scard-title"><span className="dot" /> Rincian Harian</CardTitle></CardHeader>
          <CardContent>
          <div className="table-view">
          {!paged.rows.length ? <div className="empty-state">Belum ada data periode ini</div> : (
            <table className="data">
              <thead><tr><th>Tanggal</th><th>Petugas</th><th className="num">Omset</th><th className="num">Pend. Kotor</th><th>Struk</th></tr></thead>
              <tbody>
                {paged.rows.map((r, i) => (
                  <tr key={r.key + i}>
                    <td className={isToday(r.date) ? "today" : ""}>{fmtDate(r.date)}</td>
                    <td>{r.petugas}</td>
                    <td className="num">{fmtRp(r.omset)}</td>
                    <td className="num dim">{fmtRp(r.gross)}</td>
                    <td>{strukLinks(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card-view">
          {!paged.rows.length ? null : paged.rows.map((r, i) => (
            <div className="day-card" key={r.key + i}>
              <div className="dc-top">
                <span className="dc-date" style={isToday(r.date) ? { color: "var(--green)" } : undefined}>{fmtDate(r.date)}</span>
                <span className="dc-pet">{r.petugas}</span>
              </div>
              <div className="dc-nums">
                <div><div className="dc-lbl">Omset</div><div className="dc-val">{fmtRp(r.omset)}</div></div>
                <div><div className="dc-lbl">Pend. Kotor</div><div className="dc-val">{fmtRp(r.gross)}</div></div>
              </div>
              {r.struk && r.struk.length ? <div className="dc-struk">{strukLinks(r)}</div> : null}
            </div>
          ))}
        </div>
        {paged.totalPages > 1 && (
          <div className="pager">
            <Button variant="outline" size="sm" disabled={paged.page === 0} onClick={() => setPage(paged.page - 1)}>‹ Sebelumnya</Button>
            <span className="pager-info">Hal {paged.page + 1} / {paged.totalPages}</span>
            <Button variant="outline" size="sm" disabled={paged.page >= paged.totalPages - 1} onClick={() => setPage(paged.page + 1)}>Berikutnya ›</Button>
          </div>
        )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="footer">
        Data bersumber dari Google Spreadsheet · Auto-refresh setiap {CONFIG.REFRESH_MINUTES} menit · Terakhir diperbarui: {updated}
      </div>
      <div className="footer credit">
        Created by <b>SNP (Sumber Niaga Prima)</b> / Dedik Kurniawan
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* Format tanggal expired "YYYY-MM-DD" -> "dd/mm/yyyy" (atau apa adanya) */
function fmtExpired(v) {
  if (!v) return "";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  return String(v);
}

/* Apakah expired dalam <= 30 hari ke depan (atau sudah lewat) */
function isExpiredSoon(v) {
  if (!v) return false;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  if (isNaN(t)) return false;
  const now = Date.now();
  const day = 86400000;
  return t < now + 30 * day; // sudah lewat atau dalam 30 hari
}

/* Animasi angka count-up ala SpaceX telemetry */
function CountUp({ value, duration = 1.1 }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = value || 0;
    const step = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{fmtRp(disp)}</>;
}

function openStrukPreview(url) {
  const id = (url.match(/[?&]id=([^&]+)/) || url.match(/\/d\/([^/]+)/) || [null, null])[1];
  const driveUrl = id ? "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/view" : url;
  const previewUrl = id ? "https://drive.google.com/file/d/" + encodeURIComponent(id) + "/preview" : url;
  const w = window.open("", "_blank");
  if (!w) { window.open(driveUrl, "_blank"); return; }
  w.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview Struk — KDKMP</title>' +
    '<style>html,body{margin:0;height:100%}body{background:#0b1120;color:#e2e8f0;font-family:Segoe UI,sans-serif;display:flex;flex-direction:column}' +
    '.top{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#111827;border-bottom:1px solid #1e2d45;flex-shrink:0}' +
    '.top h1{font-size:14px;margin:0;color:#8899b4;font-weight:600}.top a{color:#fca5a5;font-size:13px;text-decoration:none;padding:6px 12px;border:1px solid #3f1d1d;border-radius:8px}' +
    '.stage{flex:1;position:relative}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f87171;font-size:13px;text-align:center;padding:40px;line-height:1.7}.err a{color:#fca5a5}' +
    '</style></head><body><div class="top"><h1>📄 Preview Struk</h1><a href="' + escapeHtml(driveUrl) + '" target="_blank">Buka di Google Drive ↗</a></div>' +
    '<div class="stage"><iframe src="' + escapeHtml(previewUrl) + '" allowfullscreen loading="lazy"></iframe></div></body></html>');
  w.document.close();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
}
function applyTheme(t) {
  const root = document.documentElement;
  if (t === "dark") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  try { localStorage.setItem("kdkmp_theme", t); } catch (e) {}
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute("content", t === "dark" ? "#221a19" : "#b91c1c");
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = t === "dark" ? "☀️ Terang" : "🌙 Gelap";
}
