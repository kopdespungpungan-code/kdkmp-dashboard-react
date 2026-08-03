import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FLAG_START, FLAG_TARGET } from '../config';
import FlagIcon from './FlagIcon';
import FlagWaveCloth from './FlagWaveCloth';

function calcFlagPct() {
  const now = new Date();
  const total = FLAG_TARGET - FLAG_START;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (now - FLAG_START) / total));
}

export default function FlagRaising() {
  const [pct, setPct] = useState(calcFlagPct());
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (preview) return;
    const t = setInterval(() => setPct(calcFlagPct()), 1000);
    return () => clearInterval(t);
  }, [preview]);

  const effPct = preview ? 1 : pct;
  const p100 = Math.round(effPct * 100);
  const done = effPct >= 1;
  // travel: wrap 300 - flag 127 = 173 ruang; maks 163 -> flag top 10px (dekat finial)
  const bottom = 12 + 151 * effPct;
  // Tali dari katrol (y=6) ke cincin atas bendera (y = wrapH - bottom - flagH) — memendek saat naik
  const ropeHeight = Math.max(2, 300 - bottom - 127 - 6);
  // Posisi cincin pengait: di tepi atas bendera (top = wrapH - bottom - flagH + 4)
  const ringTop = 300 - bottom - 127 + 4;

  return (
    <div className="ceremony show">
      <div className="ceremony-title">
        <FlagIcon w={26} h={18} />
        {done ? " Dirgahayu Republik Indonesia! 🎉" : " Pengibaran Bendera"}
      </div>
      <div className="flagpole-wrap">
        <div className="pole"><div className="pole-finial" /></div>
        <div className="halyard" />
        <div className="pulley" />
        <div className="rope-link" style={{ height: ropeHeight }} />
        <div className="flag-ring" style={{ top: ringTop }} />
        <div className="pole-base" />
        <motion.div
          className={"flag-raise" + (done ? " waving" : "")}
          animate={{ bottom, rotate: done ? [0, 0.6, 1.2, 0.6, 0] : 0 }}
          transition={done
            ? { bottom: { type: "spring", stiffness: 50, damping: 16 }, rotate: { repeat: Infinity, duration: 4.2, ease: "easeInOut" } }
            : { bottom: { type: "spring", stiffness: 60, damping: 18 } }}
        >
          <FlagWaveCloth width={190} height={127} />
        </motion.div>
      </div>
      <div className="loadbar-wrap">
        <motion.div
          className="loadbar-fill"
          animate={{ width: p100 + "%" }}
          transition={{ type: "spring", stiffness: 50, damping: 14 }}
        />
      </div>
      <div className="loading-text">
        {done ? <>Bendera berkibar di puncak! 🎉</> : <><span className="lt-lbl">PROGRES PENGIBARAN</span> <b>{p100}%</b></>}
      </div>
      <button className="flag-preview-btn" onClick={() => setPreview(p => !p)}>
        {preview ? "↺ Kembali ke progres" : "👁 Lihat di puncak"}
      </button>
    </div>
  );
}
