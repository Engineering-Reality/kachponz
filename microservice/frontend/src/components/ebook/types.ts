// Model konten e-book (discriminated union).
// Diekstrak dari source.html ke book.json lalu dipaginasi & dirender fixed-layout.

export interface ImgRef {
  path: string; // path di bucket privat 'ebooks', mis '<slug>/img/bab1.webp'
  path2x?: string; // varian 2x untuk srcset
  w: number;
  h: number;
  alt: string;
}

export type FieldKind = "text" | "textarea" | "select" | "scale" | "check";
export interface Field {
  id: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  lines?: number; // untuk textarea: jumlah baris tetap
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string; correct?: boolean; dim?: string }[];
  explanation?: string; // untuk 'knowledge': tampil di balik kartu / feedback kelinci
}

export interface MindNode {
  id: string;
  label: string;
  parent?: string;
  prefilled?: boolean;
}
export interface Bone {
  cause: string;
  items: string[];
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string; keepTogether: true }
  | { type: "paragraph"; html: string; keepTogether?: boolean }
  | { type: "pullQuote"; text: string; cite?: string; keepTogether: true }
  | { type: "figure"; img: ImgRef; caption?: string; keepTogether: true }
  | { type: "callout"; variant: "note" | "developer" | "tryNow" | "story"; title: string; body: Block[]; keepTogether: true }
  | { type: "table"; head: string[]; rows: string[][]; keepTogether: true }
  | { type: "code"; lang?: string; source: string; keepTogether: true }
  | { type: "worksheet"; id: string; title: string; fields: Field[]; splitAt?: number[]; keepTogether: true }
  | { type: "quiz"; id: string; variant: "type" | "knowledge" | "scale"; title: string; questions: QuizQuestion[]; keepTogether: true }
  | { type: "quest"; id: string; quizId: string; variant: "type" | "knowledge" | "scale"; questionIndex: number; totalQuestions: number; question: QuizQuestion; keepTogether: true }
  | { type: "characterCard"; id: string; title: string; keepTogether: true }
  | { type: "cocdBox"; id: string; title: string; keepTogether: true }
  | { type: "crazy8"; id: string; title: string; keepTogether: true }
  | { type: "mindMap"; id: string; title: string; nodes: MindNode[]; keepTogether: true }
  | { type: "fishbone"; id: string; title: string; spine: string; bones: Bone[]; keepTogether: true }
  | { type: "fiveWhys"; id: string; title: string; keepTogether: true }
  | { type: "complaintJars"; id: string; title: string; keepTogether: true }
  | { type: "releaseNotes"; id: string; title: string; keepTogether: true }
  | { type: "certificate"; title: string; fields: string[]; keepTogether: true }
  | { type: "fullPage"; kind: "cover" | "toc" | "palaceMap" | "chapterOpener" | "blank"; title?: string; subtitle?: string; img?: ImgRef; imgDark?: ImgRef; chapterNo?: number; tocEntries?: string[] };

export interface Chapter {
  id: string;
  title: string;
  isPreview?: boolean; // bab preview boleh publik (tanpa token)
  blocks: Block[];
}

export interface Book {
  slug: string;
  title: string;
  version: string; // untuk invalidasi cache paginasi
  chapters: Chapter[];
  preview?: boolean; // respons API: hanya bab preview
  watermark?: string; // respons API: order_ref pembeli
}

/** fullPage selalu menempati satu halaman penuh sendiri. */
export function isFullPage(b: Block): b is Extract<Block, { type: "fullPage" }> {
  return b.type === "fullPage";
}
