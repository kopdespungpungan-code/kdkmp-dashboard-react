// ===== RAF loop yang otomatis jeda saat user scroll =====
// Masalah: canvas animasi 60fps yang berjalan terus membuat scroll di HP
// janky (kompetisi render tiap frame). Solusi: deteksi scroll (passive),
// skip menggambar selama scroll, lanjut lagi 130ms setelah berhenti.
//
// skipWhileScroll=false: canvas selalu digambar (cocok utk animasi ringan
// seperti awan — mencegah canvas kosong saat resize/URL bar mobile collapse).
export function rafLoop(draw, opts = {}) {
  const { skipWhileScroll = true } = opts;
  let raf = 0;
  let paused = false;
  let timer = 0;

  const onScroll = () => {
    paused = skipWhileScroll;
    clearTimeout(timer);
    timer = setTimeout(() => { paused = false; }, 130);
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const step = () => {
    if (!paused) draw();
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);

  const stop = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
  };
  // Gambar 1 frame SEKARANG (dipakai setelah resize mengosongkan canvas)
  const flush = () => { paused = false; draw(); };

  return { stop, flush };
}
