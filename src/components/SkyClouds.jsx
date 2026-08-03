import { useEffect, useRef } from 'react';
import { rafLoop } from '../lib/raf';

/**
 * SkyClouds — langit biru cerah dengan awan dinamis (light mode).
 * Awan digambar radial-gradient (HALUS, tanpa shadowBlur yang bikin
 * patah-patah/resolusi rendah), melayang horizontal, wrap saat keluar.
 * Animasi otomatis jeda saat scroll biar smooth di HP.
 */
export default function SkyClouds({ count = 7 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let clouds = [];

    const spawn = (anywhere) => ({
      x: anywhere ? Math.random() * W : -180,
      y: 20 + Math.random() * (H * 0.55),
      w: 90 + Math.random() * 130,
      spd: 0.12 + Math.random() * 0.28,
      alpha: 0.5 + Math.random() * 0.35,
      puffs: 3 + Math.floor(Math.random() * 3),
    });

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      if (!clouds.length) {
        clouds = Array.from({ length: count }, (_, i) => spawn(i % 2 === 0));
      } else {
        // Pertahankan awan yang ada — hanya geser yang keluar layar (biar layout tidak berubah saat URL bar mobile collapse)
        for (const c of clouds) {
          if (c.x > W + 60) c.x = -c.w;
        }
      }
    };

    const drawCloud = (c) => {
      const n = c.puffs;
      for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * (c.w / (n * 0.72));
        const oy = Math.sin(i * 1.7) * 6;
        const rw = c.w / n + c.w * 0.16;
        const rh = rw * (0.5 + 0.12 * Math.sin(i));
        // Radial gradient: lembut & murah, tidak patah (pengganti shadowBlur)
        const g = ctx.createRadialGradient(c.x + ox, c.y + oy, 0, c.x + ox, c.y + oy, rw);
        g.addColorStop(0, `rgba(255,255,255,${(0.85 * c.alpha).toFixed(3)})`);
        g.addColorStop(0.75, `rgba(255,255,255,${(0.35 * c.alpha).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(c.x + ox, c.y + oy, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // dasar awan rata — gradient lembut
      const g2 = ctx.createRadialGradient(c.x, c.y + 8, 0, c.x, c.y + 8, c.w * 0.62);
      g2.addColorStop(0, `rgba(255,255,255,${(0.5 * c.alpha).toFixed(3)})`);
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 8, c.w * 0.62, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const step = () => {
      ctx.clearRect(0, 0, W, H);
      for (const c of clouds) {
        c.x += c.spd;
        if (c.x - c.w > W + 40) { Object.assign(c, spawn(false)); }
        drawCloud(c);
      }
    };

    resize();
    // Awan TIDAK di-pause saat scroll (7 awan = murah) — mencegah canvas
    // kosong/hilang saat URL bar mobile collapse (resize meng-clear canvas)
    const loop = rafLoop(step, { skipWhileScroll: false });
    window.addEventListener('resize', resize);
    return () => {
      loop.stop();
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return <canvas ref={ref} className="skyclouds" aria-hidden="true" />;
}
