"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X, Save } from "lucide-react";

// State jawaban pembaca (localStorage per slug+order). Hasil kuis tipe/skala &
// editor textarea HP dirender sebagai panel/sheet DI LUAR halaman, supaya tinggi
// halaman tidak pernah bertambah setelah paginasi (§3 ebook.md).
type Answers = Record<string, unknown>;
export interface QuizDef { id: string; variant: "type" | "knowledge" | "scale"; title: string; questions: { id: string; prompt: string; options: { id: string; label: string; dim?: string; correct?: boolean }[] }[] }

interface Ctx {
  get: (id: string) => unknown;
  set: (id: string, v: unknown) => void;
  profile: "desktop" | "mobile";
  openQuiz: (q: QuizDef) => void;
  openEditor: (o: { id: string; label: string }) => void;
}
const C = createContext<Ctx>({ get: () => undefined, set: () => {}, profile: "desktop", openQuiz: () => {}, openEditor: () => {} });
export const useEbook = () => useContext(C);

export function EbookProvider({ storageKey, profile, children }: { storageKey: string; profile: "desktop" | "mobile"; children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [quiz, setQuiz] = useState<QuizDef | null>(null);
  const [editor, setEditor] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => { try { const s = localStorage.getItem(storageKey); if (s) setAnswers(JSON.parse(s)); } catch {} }, [storageKey]);
  const set = useCallback((id: string, v: unknown) => setAnswers((a) => { const n = { ...a, [id]: v }; try { localStorage.setItem(storageKey, JSON.stringify(n)); } catch {} return n; }), [storageKey]);
  const get = useCallback((id: string) => answers[id], [answers]);

  return (
    <C.Provider value={{ get, set, profile, openQuiz: setQuiz, openEditor: setEditor }}>
      {children}
      {quiz && <QuizResult quiz={quiz} answers={answers} profile={profile} onClose={() => setQuiz(null)} />}
      {editor && <FieldEditor label={editor.label} initial={String(answers[editor.id] ?? "")} profile={profile} onSave={(v) => { set(editor.id, v); setEditor(null); }} onClose={() => setEditor(null)} />}
    </C.Provider>
  );
}

// Hitung hasil kuis tipe/skala dari dimensi opsi terpilih.
function tally(quiz: QuizDef, answers: Answers): { dim: string; n: number }[] {
  const a = (answers[quiz.id] as Record<string, string>) || {};
  const counts: Record<string, number> = {};
  for (const q of quiz.questions) {
    const optId = a[q.id];
    const opt = q.options.find((o) => o.id === optId);
    if (opt?.dim) counts[opt.dim] = (counts[opt.dim] || 0) + 1;
  }
  return Object.entries(counts).map(([dim, n]) => ({ dim, n })).sort((x, y) => y.n - x.n);
}

function QuizResult({ quiz, answers, profile, onClose }: { quiz: QuizDef; answers: Answers; profile: "desktop" | "mobile"; onClose: () => void }) {
  const res = tally(quiz, answers);
  const total = res.reduce((s, r) => s + r.n, 0);
  const box = profile === "desktop"
    ? "fixed top-0 right-0 h-full w-80 max-w-[85vw]"
    : "fixed bottom-0 inset-x-0 max-h-[70vh] rounded-t-2xl";
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex" style={{ justifyContent: profile === "desktop" ? "flex-end" : "center", alignItems: profile === "desktop" ? "stretch" : "flex-end" }} onClick={onClose}>
      <div className={`${box} bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-5 overflow-auto`} style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom,0px))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Hasil: {quiz.title}</h3><button onClick={onClose} aria-label="Tutup"><X size={18} /></button></div>
        {total === 0 ? <p className="text-sm text-zinc-500">Jawab semua pertanyaan dulu untuk melihat hasil.</p> : (
          <ul className="space-y-2">
            {res.map((r) => (
              <li key={r.dim}>
                <div className="flex justify-between text-sm"><span className="font-medium">{r.dim}</span><span>{Math.round((r.n / total) * 100)}%</span></div>
                <div className="h-2 rounded bg-zinc-200 dark:bg-white/10"><div className="h-2 rounded bg-pink-500" style={{ width: `${(r.n / total) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldEditor({ label, initial, profile, onSave, onClose }: { label: string; initial: string; profile: "desktop" | "mobile"; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch" onClick={onClose}>
      <div className={`bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col ${profile === "desktop" ? "m-auto w-[560px] max-w-[90vw] h-[70vh] rounded-2xl" : "w-full h-full"}`} style={{ paddingTop: profile === "mobile" ? "env(safe-area-inset-top,0px)" : undefined }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-white/10">
          <span className="font-medium text-sm">{label}</span>
          <div className="flex gap-2">
            <button className="flex items-center gap-1 rounded-full bg-pink-500 text-white text-sm px-4 py-1.5" onClick={() => onSave(v)}><Save size={15} /> Simpan</button>
            <button onClick={onClose} aria-label="Tutup"><X size={18} /></button>
          </div>
        </div>
        <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} className="flex-1 w-full p-4 bg-transparent outline-none resize-none" placeholder="Tulis di sini…" />
      </div>
    </div>
  );
}
