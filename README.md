# 📊 Dashboard Penjualan KDKMP Pungpungan — React + Vite + shadcn (SpaceX Edition)

Dashboard penjualan **mobile-first** untuk KDKMP Pungpungan, bergaya **SpaceX mission control** — dibangun dengan **React 18 + Vite + Framer Motion + shadcn/ui**.

## Teknologi
- ⚛️ **React 18** — komponen terstruktur (PIN Gate, Dashboard, FlagRaising, Starfield)
- ⚡ **Vite 5** — build cepat, production bundle 414KB (gzip 137KB)
- 🎬 **Framer Motion** — animasi sinematik: transisi PIN↔Dashboard, KPI count-up, stagger cards, spring physics
- 🧩 **shadcn/ui** — komponen modern (Button, Card, Input, Select, Badge, Progress, Label) + Tailwind CSS + Radix
- ✨ **Starfield canvas** — bintang berkelip + vignette kosmik di seluruh halaman
- 📊 Data realtime dari **Google Spreadsheet** via gviz/tq (refresh 5 menit)

## Fitur
- 🚀 **Gaya SpaceX** — dark space default, glass card, label uppercase letter-spacing, T-minus countdown, glow merah
- 🖼️ **Logo KDKMP PUNGPUNGAN** di PIN screen + header
- 🔴⚪ **Tema merah putih** + **dark mode** (tombol 🌙/☀️, ikut preferensi sistem, tersimpan di localStorage)
- 🇮🇩 **Countdown 17 Agustus 2026** gaya **T-minus** (H:M:S) + **pengibaran bendera live**: 0% 2/8 → 100% 17/8 jam 10:00 → berkibar di puncak
- 🔒 **PIN gate 6 digit** (SHA-256, auto-advance, bisa paste) + animasi hover/focus glow
- 📈 KPI dengan **angka count-up**, grafik batang animasi, kontribusi petugas
- 📅 Filter bulan + rentang tanggal + reset
- 📄 Preview struk (embed Google Drive) + **export Laporan PDF**

## Menjalankan

```bash
npm install
npm run dev        # development (Vite dev server)
npm run build      # production build ke dist/
```

Serve hasil build:
```bash
py -3.11 -m http.server 8890 --bind 0.0.0.0 --directory dist
```

## Struktur
```
src/
├── main.jsx           # entry React
├── App.jsx            # AnimatePresence PIN↔Dashboard + Starfield + theme
├── config.js          # SHEET_ID, PIN_HASH, FLAG_START/TARGET
├── styles.css         # tema SpaceX + shadcn CSS variables + Tailwind
├── lib/
│   ├── sha256.js      # SHA-256 pure JS
│   ├── sheet.js       # fetch gviz + parse + dummy
│   └── utils.js       # cn() + format rupiah, tanggal
└── components/
    ├── PinGate.jsx    # PIN 6 digit (Input shadcn) + T-minus + bendera
    ├── FlagRaising.jsx# scene pengibaran (Framer Motion + canvas wave)
    ├── FlagWaveCanvas.jsx # simulasi gelombang kain ala flagwaver
    ├── FlagIcon.jsx   # bendera SVG kecil
    ├── Starfield.jsx  # canvas bintang berkelip
    ├── Dashboard.jsx  # KPI count-up, chart, petugas, tabel, filter (shadcn)
    └── ui/            # komponen shadcn: button, card, input, select, badge, progress, label
```
