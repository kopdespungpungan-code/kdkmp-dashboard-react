import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BULAN_ID } from '../config';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const pad2 = n => String(n).padStart(2, "0");

export function fmtRp(n) {
  if (n === null || n === undefined || isNaN(n)) return "Rp0";
  return "Rp" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function parseDate(v) {
  if (typeof v !== "string") return null;
  const m = v.match(/Date\((\d+),(\d+),(\d+)/);
  if (!m) return null;
  return new Date(+m[1], +m[2], +m[3]);
}

export function toKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
export function toMonthKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }

export function fmtDate(d) {
  if (!d) return "—";
  return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
}

export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return BULAN_ID[m - 1] + " " + y;
}

export function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export function parseNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function nowLabel() {
  return new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
