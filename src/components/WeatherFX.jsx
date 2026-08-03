// ===== Cuaca otomatis → tema & efek (ala iPhone) =====
// Fetch Open-Meteo tiap X menit, set document.documentElement[data-weather],
// render efek hujan/salju, dan kasih data cuaca ke parent (untuk chip header).
import { useEffect, useState } from "react";
import { fetchWeather } from "../lib/weather";
import { WEATHER } from "../config";
import RainFX from "./RainFX";

export default function WeatherFX({ onWeather, enabled = true }) {
  const [cond, setCond] = useState(null);

  useEffect(() => {
    if (!enabled) {
      // Toggle off → hapus tema cuaca, kembali ke tema manual (light/dark)
      setCond(null);
      document.documentElement.removeAttribute("data-weather");
      onWeather && onWeather(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const w = await fetchWeather();
        if (!alive) return;
        setCond(w.cond);
        onWeather && onWeather(w);
        document.documentElement.setAttribute("data-weather", w.cond);
      } catch (e) {
        // Cuaca gagal → tidak apa-apa, tema default tetap jalan
        if (alive) document.documentElement.removeAttribute("data-weather");
      }
    };
    load();
    const t = setInterval(load, WEATHER.REFRESH_MINUTES * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled, onWeather]);

  const hasFX = cond === "rain" || cond === "storm" || cond === "snow";

  return (
    <>
      {hasFX && <RainFX cond={cond} />}
      {cond === "clear" && <div className="sun-glow" aria-hidden="true" />}
    </>
  );
}
