import { useEffect, useMemo, useState } from 'react';
import { fetchSoSheet } from '../lib/sheet';
import { SO_PETUGAS_GONDOLA } from '../config';

/* ===== Halaman Detail SO Item (route #/so-items) =====
   Menampilkan semua item stok opname per gondola, filter per petugas,
   ringkasan per petugas, dan status expired. */
export default function SoItemsPage({ onBack, soRows }) {
  const [rows, setRows] = useState(soRows || []);
  const [status, setStatus] = useState({ kind: "ok", txt: "● SO" });
  const [filterPetugas, setFilterPetugas] = useState("all");
  const [filterGondola, setFilterGondola] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { if (soRows && soRows.length) setRows(soRows); }, [soRows]);

  useEffect(() => {
    if (rows.length) return;
    let live = true;
    (async () => {
      try {
        const raw = await fetchSoSheet();
        if (!live) return;
        if (raw.length) { setRows(raw); setStatus({ kind: "ok", txt: "● SO" }); }
      } catch (e) {
        console.error(e);
        if (live) setStatus({ kind: "err", txt: "● SO gagal" });
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // petugas dari sheet, fallback mapping gondola
  const petugasOf = (r) => {
    if (r.petugas) return r.petugas;
    const g = parseInt(r.gondola, 10);
    if (!isNaN(g)) {
      for (const [a, b, n] of SO_PETUGAS_GONDOLA) if (g >= a && g <= b) return n;
    }
    return "—";
  };

  const petugasList = useMemo(() => {
    const s = new Set(rows.map(r => petugasOf(r)).filter(p => p && p !== "—"));
    return [...s].sort();
  }, [rows]);

  const gondolaList = useMemo(() => {
    const s = new Set(rows.map(r => r.gondola).filter(g => g !== ""));
    return [...s].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows.slice();
    if (filterPetugas !== "all") out = out.filter(r => petugasOf(r) === filterPetugas);
    if (filterGondola !== "all") out = out.filter(r => String(r.gondola) === filterGondola);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r => r.produk.toLowerCase().includes(q));
    }
    return out;
  }, [rows, filterPetugas, filterGondola, search]);

  const summary = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const p = petugasOf(r);
      map[p] = (map[p] || 0) + (r.grocery || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const totalQty = filtered.reduce((s, r) => s + (r.grocery || 0), 0);

  const fmtExp = (v) => {
    if (!v) return "—";
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return m[3] + "/" + m[2] + "/" + m[1];
    return String(v);
  };
  const isExpSoon = (v) => {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const t = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    if (isNaN(t)) return false;
    return t < Date.now() + 30 * 86400000;
  };

  return (
    <div className="so-page">
      <div className="so-page-head">
        <div>
          <div className="so-detail-kicker">Detail SO Item</div>
          <div className="so-page-title">📋 Semua Item Stok Opname</div>
        </div>
        <div className="so-page-actions">
          <button className="so-back" onClick={onBack}>← Kembali</button>
        </div>
      </div>

      <div className="so-page-filters">
        <select className="so-select" value={filterPetugas} onChange={e => setFilterPetugas(e.target.value)}>
          <option value="all">Semua Petugas</option>
          {petugasList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="so-select" value={filterGondola} onChange={e => setFilterGondola(e.target.value)}>
          <option value="all">Semua Gondola</option>
          {gondolaList.map(g => <option key={g} value={g}>Gondola {g}</option>)}
        </select>
        <input className="so-search" placeholder="🔍 cari produk…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="so-page-summary">
        <div className="so-sum-box">
          <div className="lbl">Item Tampil</div>
          <div className="val">{filtered.length}</div>
        </div>
        <div className="so-sum-box">
          <div className="lbl">Total Qty</div>
          <div className="val">{totalQty}</div>
        </div>
        <div className="so-sum-box">
          <div className="lbl">Petugas</div>
          <div className="val">{summary.length}</div>
        </div>
      </div>

      {summary.length > 0 && (
        <div className="so-summary-grid">
          {summary.map(([p, v]) => (
            <div key={p} className="so-sum-chip">
              <span className="so-sum-name">{p}</span>
              <span className="so-sum-val">{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="so-table-wrap">
        <table className="so-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Petugas</th>
              <th className="num">Gondola</th>
              <th className="num">Qty Fisik</th>
              <th>Satuan</th>
              <th>Expired</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr><td colSpan={6} className="so-empty-row">Belum ada data</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={i}>
                <td>{r.produk}</td>
                <td className="so-petugas">{petugasOf(r)}</td>
                <td className="num">{r.gondola || "—"}</td>
                <td className="num">{r.grocery}</td>
                <td>{r.satuan || "—"}</td>
                <td className={"num so-exp" + (isExpSoon(r.expired) ? " so-exp-warn" : "")}>{fmtExp(r.expired)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="so-page-foot">
        <BadgeLine status={status} />
      </div>
    </div>
  );
}

function BadgeLine({ status }) {
  return <span className="so-status">{status.txt}</span>;
}
