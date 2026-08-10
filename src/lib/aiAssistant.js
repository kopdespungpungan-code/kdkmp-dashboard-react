// AI Assistant KDKMP — model lokal bestgrafity (localhost:20128)
// Full Dynamic, Natural, & Analytical

export function getSoSummary(soRows = []) {
  const totalItems = soRows.length;
  let totalQtyFisik = 0;
  const expiredSoonList = [];
  const now = Date.now();
  const thirtyDays = 30 * 86400000;

  soRows.forEach(r => {
    totalQtyFisik += (Number(r.qty) || 0);
    if (r.expired) {
      const [y, m, d] = String(r.expired).split("-").map(Number);
      if (y && m && d) {
        const expTime = new Date(y, m - 1, d).getTime();
        if (expTime - now <= thirtyDays) {
          expiredSoonList.push({ produk: r.produk, expired: r.expired });
        }
      }
    }
  });

  return { totalItems, totalQtyFisik, expiredSoonCount: expiredSoonList.length, expiredSoonList: expiredSoonList.slice(0, 8) };
}

export function getKeuanganSummary(salesRows = []) {
  const totalOmset = salesRows.reduce((s, r) => s + (Number(r.omset) || 0), 0);
  const days = new Set(salesRows.map(r => r.key || r.date)).size;
  const avg = days ? totalOmset / days : 0;
  const lastSales = salesRows.length > 0 ? salesRows[salesRows.length - 1] : { omset: 0 };
  const lastOmset = Number(lastSales.omset) || 0;
  const trend = avg > 0 ? ((lastOmset - avg) / avg * 100).toFixed(1) : 0;

  return { totalOmset, days, avg, lastOmset, trend };
}

function buildContext(soRows = [], salesRows = []) {
  const so = getSoSummary(soRows);
  const keu = getKeuanganSummary(salesRows);
  const hour = new Date().getHours();
  const timeContext = hour < 10 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam";

  return `--- KONTEKS TOKO KDKMP PUNGPUNGAN ---
Waktu: ${timeContext}.
SO: ${so.totalItems} item (${so.totalQtyFisik} pcs fisik). Expired dekat: ${so.expiredSoonCount} item.
KEUANGAN: Total omset Rp${keu.totalOmset.toLocaleString('id-ID')} (${keu.days} hari). Rata-rata harian Rp${keu.avg.toLocaleString('id-ID')}. Tren omset terakhir: ${keu.trend}%.

--- ATURAN JAWABAN ---
1. Kamu adalah asisten cerdas, ramah, santai, dan interaktif (gaya anak toko/boss yang asik).
2. Jika disapa "halo", "hi", atau sapaan umum, JANGAN pakai template kaku. Langsung sapa balik dengan hangat, tanya kabar, dan tawarkan bantuan analisis data toko hari ini!
3. Gunakan data di atas secara natural dalam obrolan, jangan kaku.
`;
}

export async function askBestGrafityAI(query, soRows = [], salesRows = []) {
  const context = buildContext(soRows, salesRows);
  try {
    // Coba ke proxy lokal atau custom API endpoint jika dikonfigurasi, jika tidak langsung gunakan fallback pintar
    const endpoint = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:20128/v1/chat/completions"
      : null;

    if (!endpoint) {
      // Pada GitHub Pages (HTTPS), panggilan ke http://localhost diproteksi CORS/Mixed Content, 
      // jadi kita langsung gunakan Engine Fallback cerdas berbasis data riil toko.
      return fallbackNaturalAnswer(query, soRows, salesRows);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "bestgrafity",
        messages: [
          { role: "system", content: context },
          { role: "user", content: query }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }
    throw new Error("Invalid response");
  } catch (err) {
    console.error("AI fallback triggered:", err);
    return fallbackNaturalAnswer(query, soRows, salesRows);
  }
}

function fallbackNaturalAnswer(query, soRows = [], salesRows = []) {
  const q = query.toLowerCase();
  const so = getSoSummary(soRows);
  const keu = getKeuanganSummary(salesRows);

  if (q.includes("halo") || q.includes("hi") || q.includes("pagi") || q.includes("siang") || q.includes("malam")) {
    return `Halo juga, Boss! 👋🏪 Siap ditemenin mantengin toko KDKMP Pungpungan hari ini. Omset kita udah di angka **Rp${keu.totalOmset.toLocaleString('id-ID')}** nih. Mau dibantuin cek apa? Stok opname atau laporan keuangan? ✨`;
  }
  if (q.includes("rekap") || q.includes("ringkasan")) {
    return `📊 **Nih ringkasan santai toko kita:**\n• Total Omset: **Rp${keu.totalOmset.toLocaleString('id-ID')}** (${keu.days} hari)\n• Stok SO: **${so.totalItems} item** tercatat\n• Perhatian: ada **${so.expiredSoonCount} item** mau expired.\n\nAda yang mau dikulik lagi? ☕`;
  }
  if (q.includes("expired") || q.includes("kadaluarsa")) {
    if (!so.expiredSoonCount) return "🎉 Aman bos! Belum ada barang yang mau expired dalam 30 hari ke depan. Toko steril!";
    return `⚠️ Ada **${so.expiredSoonCount} item** yang mau expired nih:\n` + so.expiredSoonList.map(e => `• ${e.produk} (Exp: \`${e.expired}\`)`).join('\n') + `\n\nYuk segera diamankan promonya! 🏃‍♂️`;
  }
  if (q.includes("keuangan") || q.includes("omset")) {
    return `💰 Omset total sejauh ini **Rp${keu.totalOmset.toLocaleString('id-ID')}** dengan rata-rata Rp${keu.avg.toLocaleString('id-ID')} per hari. Performanya mantap, pertahankan terus ya! 🚀`;
  }
  return `☕ Menarik tuh! Berdasarkan data toko kita, omset udah capai Rp${keu.totalOmset.toLocaleString('id-ID')} dan ${so.totalItems} item SO aktif. Mau tanya seputar apa lagi nih, boss?`;
}
