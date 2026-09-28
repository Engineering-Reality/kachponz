// Gagal (exit 1) bila ada emoji di kode reader / konten. UI & konten harus pakai
// ikon lucide, bukan emoji (§6 ebook.md).  node scripts/lint-emoji.mjs
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app/read", "src/components/ebook"];
const CONTENT_GLOBS = ["content"]; // hanya book.json (generated); source.html = input mentah, dilewati
// Emoji PIKTOGRAFIK saja (bukan panah "→" / simbol matematika yang sah di teks).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]|️/u;

let hits = 0;
function scan(file) {
  const text = readFileSync(file, "utf-8");
  text.split("\n").forEach((line, i) => {
    const m = line.match(EMOJI);
    if (m) { hits++; console.log(`${file}:${i + 1}  emoji ${JSON.stringify(m[0])}  ${line.trim().slice(0, 70)}`); }
  });
}
function walk(dir, pred) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, pred);
    else if (pred(p)) scan(p);
  }
}

ROOTS.forEach((r) => walk(r, (p) => /\.(ts|tsx|css)$/.test(p)));
CONTENT_GLOBS.forEach((r) => walk(r, (p) => p.endsWith("book.json")));

if (hits > 0) { console.error(`\n✗ Ditemukan ${hits} emoji. Ganti dengan ikon lucide / hapus.`); process.exit(1); }
console.log("✓ Tidak ada emoji di reader/konten.");
