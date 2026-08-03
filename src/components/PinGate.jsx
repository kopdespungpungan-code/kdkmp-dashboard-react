import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CONFIG, FLAG_TARGET } from '../config';
import { sha256 } from '../lib/sha256';
import { cn } from '../lib/utils';
import FlagIcon from './FlagIcon';
import FlagRaising from './FlagRaising';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

function pad2(n) { return String(n).padStart(2, "0"); }

function useCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    const target = new Date(FLAG_TARGET);
    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) { setText(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor(diff % 86400000 / 3600000);
      const m = Math.floor(diff % 3600000 / 60000);
      const s = Math.floor(diff % 60000 / 1000);
      setText(d + "H : " + pad2(h) + "M : " + pad2(m) + "S : " + pad2(s));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return text;
}

export default function PinGate({ onUnlock }) {
  const [boxes, setBoxes] = useState(Array(6).fill(""));
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState(false);
  const refs = useRef([]);
  const cdText = useCountdown();

  const focusBox = (i) => {
    const el = refs.current[Math.max(0, Math.min(5, i))];
    if (el) el.focus();
  };

  const checkPin = (pin) => {
    if (pin.length !== 6) return;
    setChecking(true);
    setMsg("Memeriksa…");
    setTimeout(() => {
      if (sha256(pin) === CONFIG.PIN_HASH) {
        try { sessionStorage.setItem("kdkmp_pin_ok", "1"); } catch (e) {}
        onUnlock();
      } else {
        setMsg("PIN salah, coba lagi");
        setErr(true);
        setBoxes(Array(6).fill(""));
        setChecking(false);
        setTimeout(() => setErr(false), 500);
        focusBox(0);
      }
    }, 150);
  };

  const handleInput = (i, v) => {
    const digit = v.replace(/\D/g, "").slice(0, 1);
    const next = boxes.slice();
    next[i] = digit;
    setBoxes(next);
    setMsg("");
    if (digit) {
      if (i < 5) focusBox(i + 1);
      else checkPin(next.join(""));
    }
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace" && !boxes[i] && i > 0) focusBox(i - 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (txt.length) {
      const next = Array(6).fill("");
      [...txt].forEach((ch, j) => { next[j] = ch; });
      setBoxes(next);
      if (txt.length === 6) checkPin(txt); else focusBox(txt.length);
    }
  };

  return (
    <div id="pinScreen">
      {/* Label atas ala misi SpaceX */}
      <motion.div
        className="mission-tag"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Badge variant="outline" className="mission-badge">
          <span className="mission-dot" /> Misi Kemerdekaan · T-{cdText || "IGNITION"}
        </Badge>
      </motion.div>

      <motion.div
        className="countdown"
        role="status"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <FlagIcon w={28} h={19} />
        <span className="cd-label">MENUJU 17 AGUSTUS 2026</span>
        <span className="cd-digits">{cdText || "DIRGAHAYU 🎉"}</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
      >
        <FlagRaising />
      </motion.div>

      <motion.img
        className="pin-logo"
        src="/assets/logo-kopdes.jpg"
        alt="Logo KDKMP Pungpungan"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      />

      <motion.h1
        className="pin-title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
      >
        Dashboard Penjualan <span>KDKMP PUNGPUNGAN</span>
      </motion.h1>

      <motion.p
        className="pin-sub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        Masukkan PIN 6 digit untuk melanjutkan
      </motion.p>

      <motion.div
        className="pin-boxes"
        aria-label="Masukkan PIN 6 digit"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, staggerChildren: 0.05 }}
      >
        {boxes.map((val, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.05, duration: 0.35 }}
            whileHover={{ y: -3 }}
          >
            <Input
              ref={el => (refs.current[i] = el)}
              className={cn("pin-box", val && "filled", err && "err")}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              autoComplete="one-time-code"
              aria-label={"Digit " + (i + 1)}
              value={val}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
            />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="pin-msg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {msg}
      </motion.div>

      <div className="pin-hint">
        PIN hanya tersimpan sebagai hash di halaman ini.<br />Kontak pengurus jika lupa PIN.
      </div>
    </div>
  );
}
