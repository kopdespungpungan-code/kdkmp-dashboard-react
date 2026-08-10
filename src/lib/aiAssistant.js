// AI Assistant KDKMP — model lokal bestgrafity melalui proxy Vite same-origin.

const rupiah = (value) => `Rp${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
const rowQty = (row) => Number(row.qty ?? row.grocery ?? 0) + Number(row.gudang ?? 0);

export function getSoSummary(soRows = []) {
  const totalItems = soRows.length;
  const totalQtyFisik = soRows.reduce((sum, row) => sum + rowQty(row), 0);
  const now = Date.now();
  const thirtyDays = 30 * 86400000;
  const expiredSoonList = soRows
    .filter((row) => {
      const time = new Date(row.expired).getTime();
      return row.expired && Number.isFinite(time) && time >= now && time - now <= thirtyDays;
    })
    .map((row) => ({ produk: row.produk, expired: row.expired }));

  return {
    totalItems,
    totalQtyFisik,
    expiredSoonCount: expiredSoonList.length,
    expiredSoonList: expiredSoonList.slice(0, 12),
  };
}

export function getKeuanganSummary(salesRows = []) {
  const totalOmset = salesRows.reduce((sum, row) => sum + (Number(row.omset) || 0), 0);
  const days = new Set(salesRows.map((row) => row.key || row.date).filter(Boolean)).size;
  const avg = days ? totalOmset / days : 0;
  const latest = salesRows.at(-1) || {};
  return {
    totalOmset,
    days,
    avg,
    lastOmset: Number(latest.omset) || 0,
    lastDate: latest.key || '',
    lastPetugas: latest.petugas || '—',
  };
}

function buildContext(soRows = [], salesRows = []) {
  const so = getSoSummary(soRows);
  const keu = getKeuanganSummary(salesRows);
  const stockData = soRows.map((row) => ({
    produk: row.produk,
    qty_fisik: rowQty(row),
    expired: row.expired || null,
    gondola: row.gondola || null,
    petugas: row.petugas || null,
  }));
  const salesData = salesRows.slice(-31).map((row) => ({
    tanggal: row.key,
    omset: Number(row.omset) || 0,
    gross: Number(row.gross) || 0,
    petugas: row.petugas || null,
  }));

  return `Kamu adalah partner kerja KDKMP Pungpungan yang ngobrol alami dalam Bahasa Indonesia.

SUMBER FAKTA TOKO (snapshot aplikasi saat ini):
- Total produk SO: ${so.totalItems} item, jumlah fisik: ${so.totalQtyFisik} pcs.
- Produk mendekati kedaluwarsa: ${so.expiredSoonCount}.
- Total omset: ${rupiah(keu.totalOmset)} dari ${keu.days} hari; rata-rata ${rupiah(keu.avg)}/hari.
- Penjualan terbaru (${keu.lastDate || 'belum ada tanggal'}): ${rupiah(keu.lastOmset)}, petugas ${keu.lastPetugas}.
- DATA_STOK_JSON: ${JSON.stringify(stockData)}
- DATA_PENJUALAN_JSON: ${JSON.stringify(salesData)}

ATURAN:
1. Jawab seperti manusia: natural, hangat, langsung ke inti, dan menyesuaikan nada pengguna. Jangan memakai template berulang.
2. Dasarkan angka/nama produk pada snapshot di atas. Jangan mengarang data yang tidak tersedia.
3. Jika data tidak cukup, katakan terus terang lalu tawarkan analisis yang bisa dilakukan dari data tersedia.
4. Untuk pertanyaan produk, cari kecocokan nama secara longgar dari DATA_STOK_JSON.
5. Bedakan fakta dari saran. Jika memberi saran, jelaskan singkat dasar datanya.
6. Jangan selalu menyebut semua angka. Pakai hanya data yang relevan dengan pertanyaan.
7. Panggil pengguna "Mas Dedik" sesekali bila natural, bukan di setiap jawaban.`;
}

export function buildAiMessages(query, soRows = [], salesRows = [], history = []) {
  const recentHistory = history
    .filter((message) => message?.text && ['user', 'bot'].includes(message.sender))
    .slice(-8)
    .map((message) => ({
      role: message.sender === 'bot' ? 'assistant' : 'user',
      content: message.text,
    }));

  return [
    { role: 'system', content: buildContext(soRows, salesRows) },
    ...recentHistory,
    { role: 'user', content: query },
  ];
}

export async function askBestGrafityAI(query, soRows = [], salesRows = [], history = []) {
  const configuredUrl = typeof import.meta.env === 'object' ? import.meta.env.VITE_AI_API_URL : '';
  const response = await fetch(configuredUrl || '/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-KDKMP-AI': '1' },
    body: JSON.stringify({ messages: buildAiMessages(query, soRows, salesRows, history) }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.answer) {
    throw new Error(data.error || 'Model lokal belum dapat dihubungi');
  }
  return data.answer;
}
