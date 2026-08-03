// ===== Waktu hari (ala iPhone dynamic wallpaper) =====
// 6 periode: Tengah Malam, Subuh, Pagi, Siang, Sore, Malam
// Batas jam (loose — bisa disesuaikan):
//   tengahmalam 22:00–03:00 | subuh 03:00–05:00 | pagi 05:00–10:00
//   siang 10:00–15:00 | sore 15:00–18:00 | malam 18:00–22:00

export const TOD_META = {
  tengahmalam: { label: "Tengah Malam", icon: "🌙" },
  subuh:       { label: "Subuh",        icon: "🌌" },
  pagi:        { label: "Pagi",         icon: "🌅" },
  siang:       { label: "Siang",        icon: "☀️" },
  sore:        { label: "Sore",         icon: "🌇" },
  malam:       { label: "Malam",        icon: "🌆" },
};

export function timeOfDay(d = new Date()) {
  const h = d.getHours();
  if (h >= 22 || h < 3) return "tengahmalam";
  if (h < 5) return "subuh";
  if (h < 10) return "pagi";
  if (h < 15) return "siang";
  if (h < 18) return "sore";
  return "malam";
}

// Periode gelap alami (layar gelap otomatis)
export function isNightTod(tod) {
  return tod === "tengahmalam" || tod === "subuh" || tod === "malam";
}
