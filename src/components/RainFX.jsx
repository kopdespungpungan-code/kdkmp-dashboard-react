// ===== Efek hujan / badai / salju (canvas fullscreen) =====
// z-index 0 — di atas background, di bawah konten (z-index 1)
import { useEffect, useRef } from "react";
import { rafLoop } from "../lib/raf";

export default function RainFX({ cond }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0;
    let drops = [];

    const isSnow = cond === "snow";
    const isStorm = cond === "storm";
    // Kepadatan & kecepatan sesuai kondisi
    const density = isStorm ? 560 : isSnow ? 150 : 400;
    const baseSpeed = isStorm ? 14 : isSnow ? 2.2 : 10;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      if (!drops.length) {
        drops = Array.from({ length: density }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          len: isSnow ? 3 + Math.random() * 3 : 16 + Math.random() * 18,
          spd: (isSnow ? 0.6 : 1) + Math.random() * (baseSpeed * 0.8),
          op: isSnow ? 0.55 + Math.random() * 0.45 : 0.6 + Math.random() * 0.35,
        }));
      } else {
        // Pertahankan tetesan yang ada — hanya clamp yang di luar layar
        for (const d of drops) {
          if (d.x > w + 30) d.x = Math.random() * w;
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      if (isSnow) {
        ctx.fillStyle = "#ffffff";
        for (const d of drops) {
          ctx.globalAlpha = d.op;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.len * 0.55, 0, Math.PI * 2);
          ctx.fill();
          d.y += d.spd;
          d.x += Math.sin(d.y * 0.01 + d.x) * 0.3;
          if (d.y > h + 6) { d.y = -6; d.x = Math.random() * w; }
        }
      } else {
        // Hujan: garis miring tipis
        ctx.strokeStyle = isStorm ? "rgba(190,210,255,.95)" : "rgba(205,225,255,.85)";
        ctx.lineWidth = isStorm ? 1.7 : 1.5;
        ctx.lineCap = "round";
        for (const d of drops) {
          ctx.globalAlpha = d.op;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * 0.22, d.y + d.len);
          ctx.stroke();
          d.y += d.spd;
          d.x -= d.spd * 0.16;
          if (d.y > h + 20) { d.y = -20; d.x = Math.random() * (w + 60); }
        }
      }
      ctx.globalAlpha = 1;
    };

    resize();
    const loop = rafLoop(draw);
    const onResize = () => { resize(); loop.flush(); };
    window.addEventListener("resize", onResize);
    return () => {
      loop.stop();
      window.removeEventListener("resize", onResize);
    };
  }, [cond]);

  return <canvas ref={ref} className="weather-fx" aria-hidden="true" />;
}
