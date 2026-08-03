// ===== Cuaca otomatis (tema ala iPhone) =====
// Sumber: Open-Meteo (gratis, tanpa API key, CORS terbuka)
import { WEATHER } from "../config";

// Kode WMO (World Meteorological Organization) → kondisi ringkas
// https://open-meteo.com/en/docs (weather_code)
export function condOf(code) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3 || code === 45 || code === 48) return "cloudy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 95 && code <= 99) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "cloudy";
}

export const COND_META = {
  clear:  { label: "Cerah",        icon: "☀️" },
  partly: { label: "Sebagian Cerah", icon: "🌤️" },
  cloudy: { label: "Berawan",      icon: "☁️" },
  rain:   { label: "Hujan",        icon: "🌧️" },
  storm:  { label: "Badai",        icon: "⛈️" },
  snow:   { label: "Salju",        icon: "🌨️" },
};

// Tema light/dark mengikuti cuaca (ala iPhone):
// cerah/sebagian cerah -> light; berawan/hujan/badai/salju -> dark
export function themeForCond(cond) {
  return cond === "clear" || cond === "partly" ? "light" : "dark";
}

// Label detail per kode WMO (dipakai untuk chip di header)
const WMO_LABEL = {
  0: "Cerah", 1: "Sebagian cerah", 2: "Berawan sebagian", 3: "Mendung",
  45: "Kabut", 48: "Kabut membeku",
  51: "Gerimis ringan", 53: "Gerimis", 55: "Gerimis deras",
  56: "Gerimis beku", 57: "Gerimis beku deras",
  61: "Hujan ringan", 63: "Hujan", 65: "Hujan deras",
  66: "Hujan beku", 67: "Hujan beku deras",
  71: "Salju ringan", 73: "Salju", 75: "Salju lebat", 77: "Butiran salju",
  80: "Hujan ringan", 81: "Hujan", 82: "Hujan deras",
  85: "Hujan salju ringan", 86: "Hujan salju lebat",
  95: "Badai petir", 96: "Badai + hujan es", 99: "Badai + hujan es deras",
};

export async function fetchWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" + WEATHER.LAT +
    "&longitude=" + WEATHER.LON +
    "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
    "&timezone=Asia%2FJakarta&forecast_days=3";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Cuaca HTTP " + res.status);
  const j = await res.json();
  const code = j.current.weather_code;
  const cond = condOf(code);
  const daily = (j.daily?.time || []).map((t, i) => ({
    date: t,
    code: (j.daily.weather_code || [])[i],
    tmax: (j.daily.temperature_2m_max || [])[i],
    tmin: (j.daily.temperature_2m_min || [])[i],
  }));
  return {
    cond,
    icon: COND_META[cond].icon,
    label: WMO_LABEL[code] || COND_META[cond].label,
    temp: Math.round(j.current.temperature_2m),
    humidity: j.current.relative_humidity_2m,
    wind: Math.round(j.current.wind_speed_10m),
    code,
    daily,
    location: WEATHER.NAME,
  };
}
