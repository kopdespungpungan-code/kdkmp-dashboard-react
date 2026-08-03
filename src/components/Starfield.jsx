import { useEffect, useRef } from 'react';
import { rafLoop } from '../lib/raf';

/**
 * Starfield WARPSPEED — bintang zoom radial dari pusat layar ke luar
 * (efek perjalanan luar angkasa / hyperspace). Bintang mempercepat radial,
 * meninggalkan streak cahaya, lalu reset ke tengah saat keluar layar.
 * Animasi otomatis jeda saat scroll biar smooth di HP.
 */
export default function Starfield({ density = 130 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, CX = 0, CY = 0;
    let stars = [];

    const spawn = () => ({
      ang: Math.random() * Math.PI * 2,
      dist: 12 + Math.random() * 70,         // sebar luas dari pusat (bukan titik pusat)
      speed: 0.4 + Math.random() * 1.2,
      r: Math.random() * 1.1 + 0.35,
    });

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      CX = W / 2; CY = H / 2;
      if (!stars.length) {
        stars = Array.from({ length: density }, spawn);
      }
      // Pertahankan bintang yang ada saat resize (URL bar mobile collapse) — layout tidak berubah
    };

    const step = () => {
      ctx.fillStyle = 'rgba(5,5,8,0.28)';     // trail motion blur halus
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        // percepatan radial (zoom)
        s.speed += s.speed * 0.012;
        s.dist += s.speed;
        const x = CX + Math.cos(s.ang) * s.dist;
        const y = CY + Math.sin(s.ang) * s.dist;
        const out = s.dist > Math.hypot(W, H) / 2 + 30;
        if (out || x < -30 || x > W + 30 || y < -30 || y > H + 30) {
          Object.assign(s, spawn());
          continue;
        }
        // streak: garis dari posisi sebelumnya (kecepatan) — halus & pendek
        const px = CX + Math.cos(s.ang) * (s.dist - s.speed * 1.8);
        const py = CY + Math.sin(s.ang) * (s.dist - s.speed * 1.8);
        const len = Math.min(8, s.speed * 2.0);
        const bright = Math.min(1, s.speed / 7);
        ctx.strokeStyle = `rgba(215,230,255,${(0.16 + bright * 0.4).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.5, s.r * 0.8);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        // core bintang
        ctx.beginPath();
        ctx.arc(x, y, s.r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(0.4 + bright * 0.5).toFixed(3)})`;
        ctx.fill();
      }
    };

    resize();
    const loop = rafLoop(step);
    const onResize = () => { resize(); loop.flush(); };
    window.addEventListener('resize', onResize);
    return () => {
      loop.stop();
      window.removeEventListener('resize', onResize);
    };
  }, [density]);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
