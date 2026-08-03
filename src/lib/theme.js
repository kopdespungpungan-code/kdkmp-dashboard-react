export function readTheme() {
  let t = null;
  try { t = localStorage.getItem('kdkmp_theme'); } catch (e) {}
  if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
  return t === 'dark' ? 'dark' : 'light';
}

export function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  try { localStorage.setItem('kdkmp_theme', t === 'dark' ? 'dark' : 'light'); } catch (e) {}
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute('content', t === 'dark' ? '#050508' : '#5ea8ef');
}
