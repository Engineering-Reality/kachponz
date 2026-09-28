// Ekstrak content/my-mind-palace/source.html -> book.json + gambar data-URI ke
// content/my-mind-palace/img/. Heuristik per struktur markup e-book ini; blok
// interaktif diambil id/judul/field/pertanyaannya (render penuh di fase d).
//   node scripts/extract-book.mjs
import { parse } from "node-html-parser";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const SLUG = "my-mind-palace";
const DIR = `content/${SLUG}`;
const IMGDIR = `${DIR}/img`;
if (!existsSync(IMGDIR)) mkdirSync(IMGDIR, { recursive: true });

const root = parse(readFileSync(`${DIR}/source.html`, "utf-8"), { comment: false });
const book = root.querySelector("#book");
if (!book) throw new Error("#book tidak ditemukan");

const stripEmoji = (s) =>
  (s || "").replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}️‍•✏️✅🐰💻🔨🧭🧠]/gu, "").replace(/\s+/g, " ").trim();
const txt = (el) => stripEmoji(el?.text || "");
const hasClass = (el, c) => el.classList?.contains(c);

let imgN = 0;
function saveDataUri(src) {
  const m = /^data:image\/(\w+);base64,(.+)$/s.exec(src || "");
  if (!m) return null;
  imgN++;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const name = `img-${String(imgN).padStart(3, "0")}.${ext}`;
  writeFileSync(`${IMGDIR}/${name}`, Buffer.from(m[2], "base64"));
  return `${SLUG}/img/${name}`;
}

const CALLOUT = { bunny: "note", dev: "developer", try: "tryNow", story: "story", howto: "note", disclaimer: "note" };
const SPECIAL = { "lk-cocd": "cocdBox", "lk-crazy8": "crazy8", c8: "crazy8", "lk-mindmap": "mindMap", "lk-fishbone": "fishbone", "lk-sertifikat": "certificate" };

function fieldsOf(el) {
  const fields = [];
  el.querySelectorAll("label.lbl").forEach((lab, i) => {
    // input/textarea/select setelah label (di parent yang sama atau sesudahnya)
    let ctrl = lab.parentNode?.querySelector("textarea,input,select") || null;
    const kind = ctrl?.tagName === "TEXTAREA" ? "textarea" : ctrl?.tagName === "SELECT" ? "select" : "text";
    fields.push({ id: `f${i}`, label: txt(lab), kind, lines: ctrl?.getAttribute?.("rows") ? Number(ctrl.getAttribute("rows")) : undefined });
  });
  // input/textarea tanpa label (grid isian bebas)
  if (fields.length === 0) {
    el.querySelectorAll("textarea.fill,input.fill").forEach((c, i) =>
      fields.push({ id: `f${i}`, label: c.getAttribute("placeholder") || `Isian ${i + 1}`, kind: c.tagName === "TEXTAREA" ? "textarea" : "text" })
    );
  }
  return fields;
}

function quizOf(el) {
  const cls = el.classList.value.join(" ");
  const variant = /scale/.test(cls) ? "scale" : /know/.test(cls) || el.querySelector("[data-correct]") ? "knowledge" : "type";
  const questions = [];
  el.querySelectorAll(".q").forEach((q, qi) => {
    const opts = [];
    q.querySelectorAll(".opts button, .scale-opts button, button[data-t], button[data-correct]").forEach((b, bi) =>
      opts.push({ id: `o${bi}`, label: txt(b), correct: b.getAttribute("data-correct") === "1" || undefined, dim: b.getAttribute("data-t") || b.getAttribute("data-dim") || undefined })
    );
    questions.push({ id: `q${qi}`, prompt: txt(q.querySelector(".q-text") || q), options: opts, explanation: txt(q.querySelector(".explain")) || undefined });
  });
  return { variant, title: txt(el.querySelector(".q-desc, h3, h4")) || "Kuis", questions };
}

// Klasifikasi satu elemen jadi blok (null = bukan blok, telusuri anaknya).
function classify(el) {
  const tag = el.tagName;
  if (!tag) return null;
  if (hasClass(el, "fullpage")) {
    if (hasClass(el, "opener")) {
      const img = el.querySelector("figure.ill img");
      const src = img ? saveDataUri(img.getAttribute("src")) : null;
      return { type: "fullPage", kind: "chapterOpener", title: txt(el.querySelector(".op-text, h1, h2")) || undefined, subtitle: txt(el.querySelector(".room")) || undefined,
        img: src ? { path: src, w: 924, h: 1152, alt: txt(el.querySelector("figcaption")) || "Ilustrasi bab" } : undefined };
    }
    return { type: "fullPage", kind: /toc/i.test(el.id) ? "toc" : "cover", title: txt(el.querySelector("h1,h2")) || undefined };
  }
  if (hasClass(el, "sheet")) {
    const special = SPECIAL[el.id];
    const title = txt(el.querySelector(".sheet-head h3, h3")) || el.id;
    if (special === "cocdBox") return { type: "cocdBox", id: el.id, title, keepTogether: true };
    if (special === "crazy8") return { type: "crazy8", id: el.id, title, keepTogether: true };
    if (special === "mindMap") return { type: "mindMap", id: el.id, title, nodes: [], keepTogether: true };
    if (special === "fishbone") return { type: "fishbone", id: el.id, title, spine: title, bones: [], keepTogether: true };
    if (special === "certificate") return { type: "certificate", title, fields: fieldsOf(el).map((f) => f.label), keepTogether: true };
    return { type: "worksheet", id: el.id, title, fields: fieldsOf(el), keepTogether: true };
  }
  if (hasClass(el, "quiz")) return { type: "quiz", id: el.getAttribute("data-quiz") || el.id || "quiz", ...quizOf(el), keepTogether: true };
  for (const c of Object.keys(CALLOUT)) if (hasClass(el, c)) {
    return { type: "callout", variant: CALLOUT[c], title: txt(el.querySelector("h4")) || "", body: [{ type: "paragraph", html: (el.querySelector("p")?.innerHTML || "").trim() }], keepTogether: true };
  }
  if (tag === "FIGURE" && hasClass(el, "fig")) {
    const svg = el.querySelector("svg");
    if (svg) return { type: "figure", svg: svg.outerHTML, caption: txt(el.querySelector("figcaption")) || undefined, keepTogether: true };
  }
  if (tag === "FIGURE" && hasClass(el, "ill")) {
    const src = saveDataUri(el.querySelector("img")?.getAttribute("src"));
    if (src) return { type: "figure", img: { path: src, w: 924, h: 1152, alt: txt(el.querySelector("figcaption")) || "Ilustrasi" }, caption: txt(el.querySelector("figcaption")) || undefined, keepTogether: true };
  }
  if (tag === "TABLE" || hasClass(el, "tablewrap")) {
    const table = tag === "TABLE" ? el : el.querySelector("table");
    if (table) {
      const head = table.querySelectorAll("thead th, tr:first-child th").map(txt);
      const rows = table.querySelectorAll("tbody tr").map((tr) => tr.querySelectorAll("td").map(txt)).filter((r) => r.length);
      return { type: "table", head, rows, keepTogether: true };
    }
  }
  if (tag === "P" && hasClass(el, "pull")) return { type: "pullQuote", text: txt(el), keepTogether: true };
  if (tag === "P") { const h = el.innerHTML.trim(); return h ? { type: "paragraph", html: h } : null; }
  if (/^H[1-4]$/.test(tag)) { const t = txt(el); return t ? { type: "heading", level: Math.min(3, Number(tag[1])) , text: t, keepTogether: true } : null; }
  return null;
}

// Telusuri: emit blok bila cocok; kalau tidak & elemen container → masuk anaknya.
function walk(el, out) {
  for (const child of el.childNodes) {
    if (!child.tagName) continue;
    const block = classify(child);
    if (block) out.push(block);
    else walk(child, out);
  }
}

const SECTIONS = [
  ["pengantar", "Surat Pembuka"], ["kuis-ruang", "Kuis Pembuka"],
  ["bab1", "Paradoks Ilmu Pengetahuan"], ["bab2", "Kebijaksanaan & Rasa Ingin Tahu"],
  ["bab3", "Metakognisi"], ["bab4", "Berpikir Seperti Manusia Renaisans"],
  ["bab5", "Strategi & Kreativitas"], ["bab6", "Against All Odds"], ["lampiran", "Lampiran"],
];

const chapters = [];
// Bab isi dulu (untuk daftar isi), cover & TOC diprepend belakangan.
for (const [id, title] of SECTIONS) {
  const sec = book.querySelector(`#${id}`);
  if (!sec) { console.warn("lewati section:", id); continue; }
  const blocks = [];
  walk(sec, blocks);
  chapters.push({ id, title, isPreview: id === "pengantar", blocks });
}

// COVER: ambil gambar sampul terang & gelap (data-URI) → 2 varian per tema.
const coverImg = (sel) => {
  const el = book.querySelector(sel);
  const src = el ? saveDataUri(el.querySelector("img")?.getAttribute("src") || el.getAttribute("src")) : null;
  return src ? { path: src, w: 1024, h: 1280, alt: "Sampul" } : undefined;
};
const coverLight = coverImg(".cover-light") || coverImg(".cover:not(.cover-dark)");
const coverDark = coverImg(".cover-dark");
const coverBlock = { type: "fullPage", kind: "cover", title: coverLight || coverDark ? undefined : "My Mind Palace Vol. I",
  subtitle: coverLight || coverDark ? undefined : "Engineering Reality", img: coverLight || coverDark, imgDark: coverDark || coverLight };

// DAFTAR ISI: dibangkitkan dari judul bab (adaptif tema, rapi).
const tocEntries = chapters.filter((c) => !["kuis-ruang"].includes(c.id)).map((c) => c.title);
const tocBlock = { type: "fullPage", kind: "toc", title: "Daftar Isi", tocEntries };

chapters.unshift({ id: "daftar-isi", title: "Daftar Isi", blocks: [tocBlock] });
chapters.unshift({ id: "cover", title: "Sampul", blocks: [coverBlock] });

const out = { slug: SLUG, title: "My Mind Palace Vol. I: Engineering Reality", version: "1", chapters };
writeFileSync(`${DIR}/book.json`, JSON.stringify(out, null, 2));
const counts = {};
chapters.forEach((c) => c.blocks.forEach((b) => (counts[b.type] = (counts[b.type] || 0) + 1)));
console.log("bab:", chapters.length, "| gambar:", imgN, "| blok:", JSON.stringify(counts));
