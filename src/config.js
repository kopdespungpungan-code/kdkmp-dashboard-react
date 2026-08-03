export const CONFIG = {
  SHEET_ID: "1f3V7WHP0j6fl60qw81Tjz3wgBD_Lqjr1wAr8zimey5Q",
  // Spreadsheet RESPONS formulir closing shift (File → Responses → View in Sheets → link).
  // Isi ID-nya di sini supaya panel Review otomatis tampil. Kosong = panel menampilkan panduan.
  FORM_SHEET_ID: "",
  // Spreadsheet RESPONS formulir SO (Stok Opname): kolom Stock Grocery, Stock Gudang, Stock On System.
  // Isi ID-nya untuk mengaktifkan panel SO. Kosong = panel menampilkan panduan.
  SO_SHEET_ID: "",
  PIN_HASH: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
  REFRESH_MINUTES: 5,
  TITLE: "Dashboard Penjualan KDKMP",
};
// Tema otomatis mengikuti cuaca (ala iPhone). Lokasi: Pungpungan, Bojonegoro, Jawa Timur.
export const WEATHER = {
  LAT: -7.13312,
  LON: 111.80636,
  NAME: "Pungpungan, Bojonegoro",
  // Berapa menit sekali dicek ulang cuaca (default 30 menit)
  REFRESH_MINUTES: 30,
};
export const SHEET_URL = "https://docs.google.com/spreadsheets/d/" + CONFIG.SHEET_ID + "/gviz/tq?tqx=out:json";
export const SO_SHEET_ID = CONFIG.SO_SHEET_ID;
export const FORM_SHEET_URL = CONFIG.FORM_SHEET_ID
  ? "https://docs.google.com/spreadsheets/d/" + CONFIG.FORM_SHEET_ID + "/gviz/tq?tqx=out:json"
  : "";
export const SO_SHEET_URL = CONFIG.SO_SHEET_ID
  ? "https://docs.google.com/spreadsheets/d/" + CONFIG.SO_SHEET_ID + "/gviz/tq?tqx=out:json"
  : "";
export const FLAG_START = new Date(2026, 7, 2, 0, 0, 0);    // hari ini: 0%
export const FLAG_TARGET = new Date(2026, 7, 17, 10, 0, 0); // 17 Agt 10:00: 100%
export const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
export const PER_PAGE = 20;
