// node --test src/components/ebook/Paginator.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { paginate, findOverflows, type PageAtom } from "./Paginator.ts";
import { splitBlocks } from "./BlockSplitter.ts";
import type { Block } from "./types.ts";

const DESKTOP_H = 710; // 790 - 40*2
const MOBILE_H = 632;  // 680 - 24*2

const heights: Record<string, number> = {};
const atom = (id: string, h: number, extra: Partial<PageAtom> = {}): PageAtom => {
  heights[id] = h;
  return { id, height: h, ...extra };
};

test("tidak ada halaman yang overflow (Desktop 710px)", () => {
  const atoms = [atom("a", 280), atom("b", 300), atom("c", 200), atom("d", 350)];
  const pages = paginate(atoms, DESKTOP_H, { strict: true });
  assert.equal(findOverflows(pages, (id) => heights[id], DESKTOP_H).length, 0);
  // 280+300 = 580 <= 710, +200 = 780 > 710 -> split
  assert.deepEqual(pages.map((p) => p.atoms), [["a", "b"], ["c", "d"]]);
  assert.equal(pages[0].used <= DESKTOP_H, true);
  assert.equal(pages[1].used <= DESKTOP_H, true);
});

test("tidak ada halaman yang overflow (Mobile 632px)", () => {
  const atoms = [atom("m1", 250), atom("m2", 300), atom("m3", 250), atom("m4", 250)];
  const pages = paginate(atoms, MOBILE_H, { strict: true });
  assert.equal(findOverflows(pages, (id) => heights[id], MOBILE_H).length, 0);
  // 250+300 = 550 <= 632, +250 = 800 > 632 -> split
  assert.deepEqual(pages.map((p) => p.atoms), [["m1", "m2"], ["m3", "m4"]]);
  pages.forEach((p) => assert.equal(p.used <= MOBILE_H, true));
});

test("fullPage selalu sendiri di satu halaman", () => {
  const atoms = [atom("x", 100), atom("cover", DESKTOP_H, { fullPage: true }), atom("y", 100)];
  const pages = paginate(atoms, DESKTOP_H, { strict: true });
  assert.deepEqual(pages.map((p) => p.atoms), [["x"], ["cover"], ["y"]]);
});

test("alignOpeners: opener jatuh di halaman kanan (indeks ganjil), sisip blank", () => {
  const atoms = [
    atom("p1", DESKTOP_H, { fullPage: true }),
    atom("p2", DESKTOP_H, { fullPage: true }),
    atom("op", DESKTOP_H, { fullPage: true, alignRight: true }),
  ];
  const pages = paginate(atoms, DESKTOP_H, { alignOpeners: true, strict: true });
  assert.equal(pages[2].blank, true);
  assert.deepEqual(pages[3].atoms, ["op"]);
  assert.equal(3 % 2, 1); // Indeks ganjil = halaman kanan
});

test("atom non-fullPage melebihi tinggi halaman wajib melempar error saat strict/dev", () => {
  const oversizedAtoms = [atom("oversized_block", 1200)];
  assert.throws(
    () => paginate(oversizedAtoms, DESKTOP_H, { strict: true }),
    /melebihi tinggi halaman/
  );
});

test("BlockSplitter: memecah quiz menjadi 1 pertanyaan per quest atom", () => {
  const rawQuiz: Block = {
    type: "quiz",
    id: "quiz-bab1",
    variant: "knowledge",
    title: "Kuis Bab 1",
    questions: [
      { id: "q1", prompt: "Soal 1", options: [{ id: "o1", label: "A" }] },
      { id: "q2", prompt: "Soal 2", options: [{ id: "o2", label: "B" }] },
      { id: "q3", prompt: "Soal 3", options: [{ id: "o3", label: "C" }] },
    ],
    keepTogether: true,
  };

  const splitted = splitBlocks([rawQuiz]);
  assert.equal(splitted.length, 3);
  assert.equal(splitted[0].type, "quest");
  assert.equal(splitted[1].type, "quest");
  assert.equal(splitted[2].type, "quest");
});

test("BlockSplitter: memecah worksheet berlebih dan menambahkan judul lanjutan", () => {
  const rawWorksheet: Block = {
    type: "worksheet",
    id: "ws-cocd",
    title: "Lembar Eksplorasi Ide",
    fields: [
      { id: "f1", label: "Ide 1", kind: "textarea", lines: 3 },
      { id: "f2", label: "Ide 2", kind: "textarea", lines: 3 },
      { id: "f3", label: "Ide 3", kind: "textarea", lines: 3 },
      { id: "f4", label: "Ide 4", kind: "textarea", lines: 3 },
    ],
    keepTogether: true,
  };

  const splitted = splitBlocks([rawWorksheet]);
  assert.equal(splitted.length, 2);
  assert.equal(splitted[0].type, "worksheet");
  assert.equal((splitted[0] as any).title, "Lembar Eksplorasi Ide");
  assert.equal((splitted[1] as any).title, "Lembar Eksplorasi Ide (Lanjutan)");
});

test("BlockSplitter: memecah tabel dengan banyak baris", () => {
  const rawTable: Block = {
    type: "table",
    head: ["No", "Topik", "Catatan"],
    rows: [
      ["1", "A", "Catatan A"],
      ["2", "B", "Catatan B"],
      ["3", "C", "Catatan C"],
      ["4", "D", "Catatan D"],
      ["5", "E", "Catatan E"],
      ["6", "F", "Catatan F"],
      ["7", "G", "Catatan G"],
    ],
    keepTogether: true,
  };

  const splitted = splitBlocks([rawTable]);
  assert.equal(splitted.length, 2);
  assert.equal(splitted[0].type, "table");
  assert.equal((splitted[0] as any).rows.length, 4);
  assert.equal((splitted[1] as any).rows.length, 3);
});

test("deterministik: input sama -> output sama", () => {
  const build = () => [atom("a", 250), atom("b", 250), atom("c", 250), atom("d", 250)];
  assert.deepEqual(paginate(build(), DESKTOP_H, { strict: true }), paginate(build(), DESKTOP_H, { strict: true }));
});
