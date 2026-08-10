import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PinGate from './components/PinGate';
import Dashboard from './components/Dashboard';
import SoPage from './components/SoPage';
import SoItemsPage from './components/SoItemsPage';
import SoInputPage from './components/SoInputPage';
import AiChatFloat from './components/AiChatFloat';
import Starfield from './components/Starfield';
import SkyClouds from './components/SkyClouds';
import WeatherFX from './components/WeatherFX';
import { applyTheme } from './lib/theme';
import { themeForCond } from './lib/weather';
import { timeOfDay, isNightTod } from './lib/daytime';
import { fetchSoSheet, fetchSheet } from './lib/sheet';
import { CONFIG } from './config';

// Route hash: #/ (beranda/rekap), #/so (SO), #/so-items (detail item), #/so-input (input per petugas)
function parseRoute() {
  const h = window.location.hash;
  if (h.startsWith("#/so-items")) return "so-items";
  if (h.startsWith("#/so-input")) return "so-input";
  if (h.startsWith("#/so")) return "so";
  return "home";
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [route, setRoute] = useState(() => parseRoute());
  const [weather, setWeather] = useState(null);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [tod, setTod] = useState(() => timeOfDay());
  const [soRows, setSoRows] = useState([]);
  const [soStatus, setSoStatus] = useState({ kind: "ok", txt: "● SO" });
  const [salesRows, setSalesRows] = useState([]);

  useEffect(() => {
    let ok = false;
    try { ok = sessionStorage.getItem("kdkmp_pin_ok") === "1"; } catch (e) {}
    setUnlocked(ok);
  }, []);

  // Router
  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (r) => {
    const hash = r === "home" ? "#" : "#/" + r;
    try { history.replaceState(null, "", hash); } catch (e) {}
    setRoute(r);
  };

  // Update periode waktu tiap menit + set data-tod global
  useEffect(() => {
    const tick = () => setTod(timeOfDay());
    tick();
    const t = setInterval(tick, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-tod", tod);
  }, [tod]);

  // Tema FULL otomatis: waktu (malam/subuh/tengah malam => gelap) ATAU cuaca buruk => gelap; selain itu light
  const theme = (isNightTod(tod) || (weather && themeForCond(weather.cond) === "dark"))
    ? "dark"
    : "light";

  useEffect(() => { applyTheme(theme); }, [theme]);

  // SO data: fetch + refresh 5 menit
  const loadSo = async () => {
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

  // Data keuangan (penjualan) untuk AI chat — fetch ringan, refresh 5 menit
  const loadSales = async () => {
    try {
      const raw = await fetchSheet();
      setSalesRows(raw);
    } catch (err) {
      console.error("sales fetch error:", err);
    }
  };
  useEffect(() => { loadSales(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setInterval(() => loadSales(), CONFIG.REFRESH_MINUTES * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const unlock = () => setUnlocked(true);
  const lock = () => {
    try { sessionStorage.removeItem("kdkmp_pin_ok"); } catch (e) {}
    setUnlocked(false);
  };

  const page = unlocked ? (
    route === "so" ? (
      <SoPage
        soRows={soRows}
        soStatus={soStatus}
        onBackHome={() => navigate("home")}
        onItems={() => navigate("so-items")}
        onInput={() => navigate("so-input")}
      />
    ) : route === "so-items" ? (
      <SoItemsPage onBack={() => navigate("so")} soRows={soRows} />
    ) : route === "so-input" ? (
      <SoInputPage onBack={() => navigate("so")} soRows={soRows} />
    ) : (
      <Dashboard
        onLock={lock}
        weather={weather}
        weatherEnabled={weatherEnabled}
        onToggleWeather={() => setWeatherEnabled(v => !v)}
        tod={tod}
        onOpenSo={() => navigate("so")}
        soRows={soRows}
      />
    )
  ) : null;

  return (
    <>
      {/* Cuaca otomatis: set data-weather global + efek hujan/salju (bisa dimatikan via toggle) */}
      <WeatherFX onWeather={setWeather} enabled={weatherEnabled} />
      {theme === 'dark' ? <Starfield /> : <SkyClouds />}
      <div className="space-vignette" aria-hidden="true" />
      {unlocked && <AiChatFloat soRows={soRows} salesRows={salesRows} />}
      <AnimatePresence mode="wait">
        {unlocked ? (
          <motion.div
            key={route}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {page}
          </motion.div>
        ) : (
          <motion.div
            key="pin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <PinGate onUnlock={unlock} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
