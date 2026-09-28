// Inti paginasi: MURNI & deterministik. Bekerja pada "atom" yang tingginya sudah
// diukur browser pada lebar halaman profil (bukan ukuran layar asli). ReaderV2
// yang mengukur DOM lalu memanggil paginate(); di sini tak ada DOM sama sekali,
// supaya bisa diunit-test dan hasilnya stabil per (slug, profil, versi, font).

export interface PageAtom {
  id: string;
  height: number;
  /** fullPage menempati satu halaman sendiri. */
  fullPage?: boolean;
  /** chapterOpener yang (di desktop) harus jatuh di halaman kanan (indeks ganjil). */
  alignRight?: boolean;
}

export interface LaidPage {
  atoms: string[];
  used: number;
  /** halaman kosong berornamen yang disisipkan agar opener jatuh di kanan. */
  blank?: boolean;
}

export interface PaginateOptions {
  /** desktop: sisipkan blank agar chapterOpener jatuh di halaman kanan. */
  alignOpeners?: boolean;
}

const EPS = 0.5; // toleransi sub-piksel

export function paginate(atoms: PageAtom[], pageHeight: number, opts: PaginateOptions = {}): LaidPage[] {
  const pages: LaidPage[] = [];
  let cur: LaidPage | null = null;

  const flush = () => {
    if (cur) {
      pages.push(cur);
      cur = null;
    }
  };
  const pushWhole = (p: LaidPage) => {
    flush();
    pages.push(p);
  };

  for (const a of atoms) {
    if (a.fullPage) {
      // Opener harus di halaman kanan (indeks ganjil) → sisipkan blank bila perlu.
      if (opts.alignOpeners && a.alignRight) {
        flush();
        if (pages.length % 2 === 0) pages.push({ atoms: [], used: 0, blank: true });
      }
      pushWhole({ atoms: [a.id], used: a.height });
      continue;
    }
    if (!cur) cur = { atoms: [], used: 0 };
    if (cur.atoms.length > 0 && cur.used + a.height > pageHeight + EPS) {
      flush();
      cur = { atoms: [], used: 0 };
    }
    cur.atoms.push(a.id);
    cur.used += a.height;
  }
  flush();
  return pages;
}

/** Verifikasi invarian (dipakai test & bisa dipanggil dev): tidak ada overflow
 *  kecuali satu atom yang memang lebih tinggi dari halaman. */
export function findOverflows(pages: LaidPage[], atomHeight: (id: string) => number, pageHeight: number): number[] {
  const bad: number[] = [];
  pages.forEach((p, i) => {
    if (p.used > pageHeight + EPS && !(p.atoms.length === 1 && atomHeight(p.atoms[0]) > pageHeight)) {
      bad.push(i);
    }
  });
  return bad;
}
