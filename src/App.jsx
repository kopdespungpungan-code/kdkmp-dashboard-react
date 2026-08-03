import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PinGate from './components/PinGate';
import Dashboard from './components/Dashboard';
import Starfield from './components/Starfield';
import SkyClouds from './components/SkyClouds';
import WeatherFX from './components/WeatherFX';
import { readTheme, applyTheme } from './lib/theme';
import { themeForCond } from './lib/weather';
import { timeOfDay, isNightTod } from './lib/daytime';

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  // Tema pilihan MANUAL user (dipakai saat Auto Cuaca mati / cuaca gagal)
  const [manualTheme, setManualTheme] = useState('dark');
  const [weather, setWeather] = useState(null);
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [tod, setTod] = useState(() => timeOfDay());

  useEffect(() => {
    setManualTheme(readTheme());
    let ok = false;
    try { ok = sessionStorage.getItem("kdkmp_pin_ok") === "1"; } catch (e) {}
    setUnlocked(ok);
  }, []);

  // Update periode waktu tiap menit + set data-tod global (untuk CSS tema waktu)
  useEffect(() => {
    const tick = () => setTod(timeOfDay());
    tick();
    const t = setInterval(tick, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-tod", tod);
  }, [tod]);

  // Tema EFEKTIF saat Auto ON: waktu (malam/subuh/tengah malam => gelap) ATAU cuaca buruk (berawan/hujan/badai => gelap)
  const autoOn = weatherEnabled && !!weather;
  const theme = autoOn
    ? (isNightTod(tod) || themeForCond(weather.cond) === "dark" ? "dark" : "light")
    : manualTheme;

  // Terapkan + simpan tema efektif
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => {
    // Hanya manual; saat Auto Cuaca ON tombol dinonaktifkan di Dashboard
    setManualTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const unlock = () => setUnlocked(true);
  const lock = () => {
    try { sessionStorage.removeItem("kdkmp_pin_ok"); } catch (e) {}
    setUnlocked(false);
  };

  return (
    <>
      {/* Cuaca otomatis: set data-weather global + efek hujan/salju (bisa dimatikan via toggle) */}
      <WeatherFX onWeather={setWeather} enabled={weatherEnabled} />
      {theme === 'dark' ? <Starfield /> : <SkyClouds />}
      <div className="space-vignette" aria-hidden="true" />
      <AnimatePresence mode="wait">
        {unlocked ? (
          <motion.div
            key="dash"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Dashboard
              onLock={lock}
              theme={theme}
              onToggleTheme={toggleTheme}
              weather={weather}
              weatherEnabled={weatherEnabled}
              onToggleWeather={() => setWeatherEnabled(v => !v)}
              tod={tod}
            />
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
