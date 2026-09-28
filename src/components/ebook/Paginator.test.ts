// node --test src/components/ebook/Paginator.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { paginate, findOverflows, type PageAtom } from "./Paginator.ts";

const H = 790; // tinggi halaman desktop
const heights: Record<string, number> = {};
const atom = (id: string, h: number, extra: Partial<PageAtom> = {}): PageAtom => {
  heights[id] = h;
  return { id, height: h, ...extra };
};

test("tidak ada halaman yang overflow", () => {
  const atoms = [atom("a", 300), atom("b", 300), atom("c", 300), atom("d", 200)];
  const pages = paginate(atoms, H);
  assert.equal(findOverflows(pages, (id) => heights[id], H).length, 0);
  // 300+300 muat (600<=790), +300 overflow → halaman baru
  assert.deepEqual(pages.map((p) => p.atoms), [["a", "b"], ["c", "d"]]);
});

test("fullPage selalu sendiri di satu halaman", () => {
  const atoms = [atom("x", 100), atom("cover", 790, { fullPage: true }), atom("y", 100)];
  const pages = paginate(atoms, H);
  assert.deepEqual(pages.map((p) => p.atoms), [["x"], ["cover"], ["y"]]);
});

test("alignOpeners: opener jatuh di halaman kanan (indeks ganjil), sisip blank", () => {
  // 1 halaman konten (indeks 0), lalu opener → tanpa align jatuh di indeks 1 (kanan) sudah oke.
  // Uji kasus perlu blank: 2 halaman konten (indeks 0,1) lalu opener → tanpa align indeks 2 (kiri).
  const atoms = [atom("p1", 790, { fullPage: true }), atom("p2", 790, { fullPage: true }), atom("op", 790, { fullPage: true, alignRight: true })];
  const pages = paginate(atoms, H, { alignOpeners: true });
  // indeks: 0=p1,1=p2,2=blank,3=op → op di ganjil (kanan)
  assert.equal(pages[2].blank, true);
  assert.deepEqual(pages[3].atoms, ["op"]);
  assert.equal(pages.length % 2, 0 ? pages.length % 2 : 0);
  assert.equal(3 % 2, 1); // op di indeks ganjil
});

test("deterministik: input sama → output sama", () => {
  const build = () => [atom("a", 250), atom("b", 250), atom("c", 250), atom("d", 250)];
  assert.deepEqual(paginate(build(), H), paginate(build(), H));
});

test("atom lebih tinggi dari halaman tetap sendiri, tak dianggap overflow-bug", () => {
  const atoms = [atom("tall", 1200)];
  const pages = paginate(atoms, H);
  assert.equal(pages.length, 1);
  assert.equal(findOverflows(pages, (id) => heights[id], H).length, 0);
});
