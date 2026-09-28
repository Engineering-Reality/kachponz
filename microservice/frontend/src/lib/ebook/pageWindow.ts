/**
 * Rentang halaman yang di-sign sekaligus di sekitar halaman aktif. Reader tidak
 * men-sign semua halaman (bisa ratusan); ia minta jendela ±radius lalu ambil
 * jendela berikutnya saat mendekati tepi. Dipakai client (kapan minta batch) dan
 * server (halaman mana yang di-sign), jadi keduanya tak bisa melenceng.
 */
export interface PageWindow {
  from: number;
  to: number;
}

export function pageWindow(active: number, pageCount: number, radius = 10): PageWindow {
  const a = Math.min(Math.max(active, 1), Math.max(pageCount, 1));
  return {
    from: Math.max(1, a - radius),
    to: Math.min(pageCount, a + radius),
  };
}

/** Perlu ambil batch baru? true kalau ada halaman di jendela yang belum ter-load. */
export function needsFetch(active: number, loaded: Set<number>, pageCount: number, radius = 10): boolean {
  const { from, to } = pageWindow(active, pageCount, radius);
  for (let p = from; p <= to; p++) if (!loaded.has(p)) return true;
  return false;
}
