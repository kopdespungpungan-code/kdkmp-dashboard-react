import { useEffect, useMemo, useState } from 'react';
import { fetchSoSheet } from '../lib/sheet';
import { SO_PETUGAS_GONDOLA } from '../config';

const STORAGE_KEY = "kdkmp_so_input_v1";

/* ===== Halaman Input SO Item per Petugas (route #/so-input) =====
   Petugas pilih nama → lihat item di gondola tanggung jawabnya →
   input qty hasil opname → simpan (localStorage) → rekap per petugas. */
export default function SoInputPage({ onBack, soRows }) {
  const [rows, setRows] = useState(soRows || []);
  const [petugas, setPetugas] = useState("");
  const [inputs, setInputs] = useState({});   // key produk -> qty
  const [saved, setSaved] = useState({});     // localStorage: petugas -> {tanggal, data}
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (soRows && soRows.length) setRows(soRows); }, [soRows]);

  // load sheet (fallback kalau prop kosong)
  useEffect(() => {
    if (rows.length) return;
    let live = true;
    (async () => {
      try {
        const raw = await fetchSoSheet();
        if (live && raw.length) setRows(raw);
      } catch (e) { console.error(e); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load saved dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch (e) {}
  }, []);

  const petugasList = useMemo(() => {
    return SO_PETUGAS_GONDOLA.map(([a, b, n]) => n);
  }, []);

  const petugasOf = (r) => {
    if (r.petugas) return r.petugas;
    const g = parseInt(r.gondola, 10);
    if (!isNaN(g)) {
      for (const [a, b, n] of SO_PETUGAS_GONDOLA) if (g >= a && g <= b) return n;
    }
    return "—";
  };

  // item milik petugas terpilih
  const myItems = useMemo(() => {
    if (!petugas) return [];
    let out = rows.filter(r => petugasOf(r) === petugas);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r => r.produk.toLowerCase().includes(q));
    }
    return out;
  }, [rows, petugas, search]);

  const gondolaSet = useMemo(() => {
    const s = new Set(myItems.map(r => r.gondola));
    return [...s].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }, [myItems]);

  // mulai dari qty sheet sebagai default saat pilih petugas / data tiba
  useEffect(() => {
    if (!petugas || !rows.length) return;
    setInputs(prev => {
      const init = { ...prev };
      let changed = false;
      rows.forEach(r => {
        if (petugasOf(r) === petugas && !(r.produk in init)) {
          init[r.produk] = r.grocery || 0;
          changed = true;
        }
      });
      return changed ? init : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petugas, rows]);

  const setQty = (produk, v) => {
    const n = parseInt(v, 10);
    setInputs(prev => ({ ...prev, [produk]: isNaN(n) || n < 0 ? 0 : n }));
  };

  const totalQty = Object.values(inputs).reduce((s, v) => s + (v || 0), 0);
  const filledCount = Object.values(inputs).filter(v => v && v > 0).length;

  const save = () => {
    if (!petugas) return;
    const today = new Date().toISOString().slice(0, 10);
    const data = { tanggal: today, data: inputs };
    const next = { ...saved, [petugas]: data };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setMsg("✅ Tersimpan untuk " + petugas + " (" + today + ")");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      setMsg("❌ Gagal menyimpan: " + e.message);
    }
  };

  const copyResult = () => {
    const lines = myItems.map(r => {
      const q = inputs[r.produk] ?? r.grocery ?? 0;
      return `${r.produk}\t${q}\t${r.satuan || ""}`;
    });
    const txt = `SO ${petugas} ${new Date().toLocaleDateString("id-ID")}\n${lines.join("\n")}`;
    try {
      navigator.clipboard.writeText(txt).then(() => setMsg("✅ Tersalin ke clipboard")).catch(() => fallbackCopy(txt));
    } catch (e) { fallbackCopy(txt); }
    setTimeout(() => setMsg(""), 3000);
  };
  const fallbackCopy = (txt) => {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); setMsg("✅ Tersalin (fallback)"); } catch (e) {}
    document.body.removeChild(ta);
  };

  const lastSaved = saved[petugas];

  return (
    <div className="so-page">
      <div className="so-page-head">
        <div>
          <div className="so-detail-kicker">Input SO Item</div>
          <div className="so-page-title">✏️ Stok Opname per Petugas</div>
        </div>
        <div className="so-page-actions">
          <button className="so-back" onClick={onBack}>← Kembali</button>
        </div>
      </div>

      <div className="so-page-filters">
        <select className="so-select so-select-big" value={petugas} onChange={e => { setPetugas(e.target.value); setSearch(""); }}>
          <option value="">— Pilih Petugas —</option>
          {petugasList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="so-search" placeholder="🔍 cari produk…" value={search} onChange={e => setSearch(e.target.value)} disabled={!petugas} />
      </div>

      {msg && <div className="so-msg">{msg}</div>}

      {petugas ? (
        <>
          <div className="so-page-summary">
            <div className="so-sum-box"><div className="lbl">Item</div><div className="val">{myItems.length}</div></div>
            <div className="so-sum-box"><div className="lbl">Gondola</div><div className="val">{gondolaSet.length}</div></div>
            <div className="so-sum-box"><div className="lbl">Terisi</div><div className="val">{filledCount}</div></div>
            <div className="so-sum-box"><div className="lbl">Total Qty</div><div className="val">{totalQty}</div></div>
          </div>

          {lastSaved && (
            <div className="so-last-saved">
              💾 Terakhir disimpan: <b>{lastSaved.tanggal}</b> · {Object.keys(lastSaved.data).length} item
            </div>
          )}

          <div className="so-input-list">
            {!myItems.length ? (
              <div className="so-empty-row">Belum ada item untuk petugas ini</div>
            ) : myItems.map((r, i) => (
              <div className="so-input-row" key={i}>
                <div className="so-input-info">
                  <div className="so-input-produk">{r.produk}</div>
                  <div className="so-input-sub">
                    {r.gondola ? "Gondola " + r.gondola : ""}
                    {r.satuan ? " · " + r.satuan : ""}
                    {r.expired ? " · exp " + fmtExp(r.expired) : ""}
                  </div>
                </div>
                <div className="so-input-qty">
                  <button className="so-qty-btn" onClick={() => setQty(r.produk, (inputs[r.produk] ?? r.grocery ?? 0) - 1)}>−</button>
                  <input
                    className="so-qty-input"
                    type="number" min="0"
                    value={inputs[r.produk] ?? r.grocery ?? 0}
                    onChange={e => setQty(r.produk, e.target.value)}
                  />
                  <button className="so-qty-btn" onClick={() => setQty(r.produk, (inputs[r.produk] ?? r.grocery ?? 0) + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="so-page-actions so-save-bar">
            <button className="so-btn-primary" onClick={save}>💾 Simpan SO {petugas}</button>
            <button className="so-btn-ghost" onClick={copyResult}>📋 Salin Hasil</button>
          </div>
        </>
      ) : (
        <div className="so-empty-row">
          👆 Pilih nama petugas untuk mulai input stok opname.
          <br /><small>Item akan diambil dari gondola tanggung jawab petugas tersebut.</small>
        </div>
      )}
    </div>
  );
}

function fmtExp(v) {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  return String(v);
}
