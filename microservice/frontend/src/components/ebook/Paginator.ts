// Inti paginasi: MURNI & deterministik. Bekerja pada "atom" yang tingginya sudah
// diukur browser pada lebar halaman profil.

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
  /** Throw error jika atom non-fullPage melebihi tinggi halaman */
  strict?: boolean;
  /** Jarak seragam (gap) antarblok dalam satu halaman (default 12px) */
  gap?: number;
}

export const EPS = 0.5; // toleransi sub-piksel

export function paginate(atoms: PageAtom[], pageHeight: number, opts: PaginateOptions = {}): LaidPage[] {
  const pages: LaidPage[] = [];
  let cur: LaidPage | null = null;
  const isDev = process.env.NODE_ENV !== "production";
  const strict = opts.strict ?? isDev;
  const gap = opts.gap ?? 12;

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
      // Opener harus di halaman kanan (indeks ganjil) -> sisipkan blank bila perlu.
      if (opts.alignOpeners && a.alignRight) {
        flush();
        if (pages.length % 2 === 0) {
          pages.push({ atoms: [], used: 0, blank: true });
        }
      }
      pushWhole({ atoms: [a.id], used: a.height });
      continue;
    }

    // Validasi: Atom non-fullPage tidak boleh melebihi pageHeight
    if (a.height > pageHeight + EPS) {
      const errorMsg = `[Paginator Error] Atom '${a.id}' memiliki tinggi (${Math.round(a.height)}px) yang melebihi tinggi halaman (${pageHeight}px). Blok ini wajib dipecah sebelum dipaginasi.`;
      if (strict) {
        throw new Error(errorMsg);
      } else {
        console.error(errorMsg);
      }
    }

    if (!cur) {
      cur = { atoms: [], used: 0 };
    }

    const needed = cur.atoms.length > 0 ? cur.used + gap + a.height : a.height;

    // Jika atom tidak muat di halaman saat ini, flush dan buat halaman baru
    if (cur.atoms.length > 0 && needed > pageHeight + EPS) {
      flush();
      cur = { atoms: [], used: 0 };
    }

    const newUsed = cur.atoms.length > 0 ? cur.used + gap + a.height : a.height;
    cur.atoms.push(a.id);
    cur.used = newUsed;
  }

  flush();
  return pages;
}

/**
 * Verifikasi invarian: tidak ada halaman yang used > pageHeight.
 * Mengembalikan indeks halaman yang mengalami overflow.
 */
export function findOverflows(pages: LaidPage[], atomHeight: (id: string) => number, pageHeight: number): number[] {
  const bad: number[] = [];
  pages.forEach((p, i) => {
    if (p.used > pageHeight + EPS) {
      bad.push(i);
    }
  });
  return bad;
}
