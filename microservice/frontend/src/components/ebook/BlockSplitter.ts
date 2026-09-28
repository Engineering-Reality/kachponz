import type { Block, Chapter, QuizQuestion, Field } from "./types";

/**
 * Memecah blok-blok yang berpotensi melebihi tinggi halaman:
 * 1. quiz -> 1 quest per pertanyaan (1 halaman = 1 QuestCard).
 * 2. worksheet -> dipecah berdasarkan splitAt atau chunk field (max 2-3 fields), judul diulang dengan '(Lanjutan)'.
 * 3. table -> dipecah jika baris > 4, header tabel diulang.
 * 4. paragraph -> dipecah per kalimat jika teks sangat panjang.
 */
export function splitBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];

  for (const b of blocks) {
    if (b.type === "quiz") {
      // Pecah 1 quiz menjadi N quest card
      const total = b.questions.length;
      b.questions.forEach((q, idx) => {
        result.push({
          type: "quest",
          id: `${b.id}.q${idx}`,
          quizId: b.id,
          variant: b.variant,
          questionIndex: idx,
          totalQuestions: total,
          question: q,
          keepTogether: true,
        });
      });
      // Untuk kuis tipe, tambahkan kartu karakter hasil setelah pertanyaan terakhir
      if (b.variant === "type") {
        result.push({
          type: "characterCard",
          id: `${b.id}.result`,
          title: "Hasil Kartu Karakter",
          keepTogether: true,
        });
      }
    } else if (b.type === "worksheet") {
      if (b.splitAt && b.splitAt.length > 0) {
        // Pecah sesuai batas splitAt yang didefinisikan
        const indices = [0, ...b.splitAt, b.fields.length];
        for (let i = 0; i < indices.length - 1; i++) {
          const start = indices[i];
          const end = indices[i + 1];
          const chunk = b.fields.slice(start, end);
          if (chunk.length > 0) {
            result.push({
              type: "worksheet",
              id: i === 0 ? b.id : `${b.id}_part_${i + 1}`,
              title: i === 0 ? b.title : `${b.title} (Lanjutan)`,
              fields: chunk,
              keepTogether: true,
            });
          }
        }
      } else if (b.fields.length > 3) {
        // Otomatis pecah setiap 2-3 field agar tidak overflow
        const chunkSize = 2;
        for (let i = 0; i < b.fields.length; i += chunkSize) {
          const chunk = b.fields.slice(i, i + chunkSize);
          const partIdx = Math.floor(i / chunkSize);
          result.push({
            type: "worksheet",
            id: partIdx === 0 ? b.id : `${b.id}_part_${partIdx + 1}`,
            title: partIdx === 0 ? b.title : `${b.title} (Lanjutan)`,
            fields: chunk,
            keepTogether: true,
          });
        }
      } else {
        result.push(b);
      }
    } else if (b.type === "table" && b.rows.length > 5) {
      // Pecah tabel panjang per 4 baris
      const chunkSize = 4;
      for (let i = 0; i < b.rows.length; i += chunkSize) {
        const chunkRows = b.rows.slice(i, i + chunkSize);
        result.push({
          type: "table",
          head: b.head,
          rows: chunkRows,
          keepTogether: true,
        });
      }
    } else if (b.type === "paragraph" && b.html.length > 600) {
      // Pecah paragraf super panjang per kalimat jika diperlukan
      const clean = b.html;
      const sentences = clean.split(/(?<=[.?!])\s+(?=[A-Z0-9<])/g);
      if (sentences.length > 3) {
        let currentChunk = "";
        for (const s of sentences) {
          if (currentChunk.length + s.length > 400 && currentChunk.length > 0) {
            result.push({ type: "paragraph", html: currentChunk.trim(), keepTogether: false });
            currentChunk = s;
          } else {
            currentChunk += (currentChunk ? " " : "") + s;
          }
        }
        if (currentChunk) {
          result.push({ type: "paragraph", html: currentChunk.trim(), keepTogether: false });
        }
      } else {
        result.push(b);
      }
    } else {
      result.push(b);
    }
  }

  return result;
}

export function prepareChapters(chapters: Chapter[]): { id: string; block: Block; ci: number }[] {
  const out: { id: string; block: Block; ci: number }[] = [];
  chapters.forEach((c, ci) => {
    const splitted = splitBlocks(c.blocks);
    splitted.forEach((b, bi) => {
      out.push({
        id: "id" in b && b.id ? `${ci}.${b.id}` : `${ci}.${bi}`,
        block: b,
        ci,
      });
    });
  });
  return out;
}
