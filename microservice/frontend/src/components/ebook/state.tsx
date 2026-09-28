"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { X, Save, Sparkles } from "lucide-react";

type Answers = Record<string, unknown>;
export interface QuizDef {
  id: string;
  variant: "type" | "knowledge" | "scale";
  title: string;
  questions: { id: string; prompt: string; options: { id: string; label: string; dim?: string; correct?: boolean }[] }[];
}

export type StarType = "read" | "quiz" | "worksheet";

interface Ctx {
  get: (id: string) => unknown;
  set: (id: string, v: unknown) => void;
  profile: "desktop" | "mobile";
  openQuiz: (q: QuizDef) => void;
  openEditor: (o: { id: string; label: string }) => void;
  getStarCount: (roomId: string) => number;
  addStar: (roomId: string, star: StarType) => void;
  getBadgeUnlocked: (roomId: string) => boolean;
}

const C = createContext<Ctx>({
  get: () => undefined,
  set: () => {},
  profile: "desktop",
  openQuiz: () => {},
  openEditor: () => {},
  getStarCount: () => 0,
  addStar: () => {},
  getBadgeUnlocked: () => false,
});

export const useEbook = () => useContext(C);

export function EbookProvider({ storageKey, profile, children }: { storageKey: string; profile: "desktop" | "mobile"; children: ReactNode }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [quiz, setQuiz] = useState<QuizDef | null>(null);
  const [editor, setEditor] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(storageKey);
      if (s) setAnswers(JSON.parse(s));
    } catch {}
  }, [storageKey]);

  const set = useCallback(
    (id: string, v: unknown) =>
      setAnswers((a) => {
        const n = { ...a, [id]: v };
        try {
          localStorage.setItem(storageKey, JSON.stringify(n));
        } catch {}
        return n;
      }),
    [storageKey]
  );

  const get = useCallback((id: string) => answers[id], [answers]);

  const getStarCount = useCallback(
    (roomId: string) => {
      const stars = (answers[`stars:${roomId}`] as Record<StarType, boolean>) || {};
      let count = 0;
      if (stars.read) count++;
      if (stars.quiz) count++;
      if (stars.worksheet) count++;
      return count;
    },
    [answers]
  );

  const addStar = useCallback(
    (roomId: string, star: StarType) => {
      const current = (answers[`stars:${roomId}`] as Record<StarType, boolean>) || {};
      if (!current[star]) {
        set(`stars:${roomId}`, { ...current, [star]: true });
      }
    },
    [answers, set]
  );

  const getBadgeUnlocked = useCallback(
    (roomId: string) => {
      return getStarCount(roomId) >= 3;
    },
    [getStarCount]
  );

  return (
    <C.Provider
      value={{
        get,
        set,
        profile,
        openQuiz: setQuiz,
        openEditor: setEditor,
        getStarCount,
        addStar,
        getBadgeUnlocked,
      }}
    >
      {children}
      {quiz && <QuizResult quiz={quiz} answers={answers} profile={profile} onClose={() => setQuiz(null)} />}
      {editor && (
        <FieldEditor
          label={editor.label}
          initial={String(answers[editor.id] ?? "")}
          profile={profile}
          onSave={(v) => {
            set(editor.id, v);
            setEditor(null);
          }}
          onClose={() => setEditor(null)}
        />
      )}
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
  const box = profile === "desktop" ? "fixed top-0 right-0 h-full w-80 max-w-[85vw]" : "fixed bottom-0 inset-x-0 max-h-[70vh] rounded-t-2xl";
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex" style={{ justifyContent: profile === "desktop" ? "flex-end" : "center", alignItems: profile === "desktop" ? "stretch" : "flex-end" }} onClick={onClose}>
      <div className={`${box} bg-[var(--paper)] text-[var(--ink)] p-5 overflow-auto border-l border-[var(--line)] shadow-2xl`} style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom,0px))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 border-b border-[var(--line)] pb-3">
          <h3 className="font-bold font-[family-name:var(--serif)] text-base">{quiz.title}</h3>
          <button onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {total === 0 ? (
          <p className="text-xs text-[var(--ink-soft)]">Jawab semua pertanyaan dulu untuk melihat hasil.</p>
        ) : (
          <ul className="space-y-3">
            {res.map((r) => (
              <li key={r.dim}>
                <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-[var(--ink)]">{r.dim}</span><span className="font-mono text-[var(--accent)]">{Math.round((r.n / total) * 100)}%</span></div>
                <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-2 rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${(r.n / total) * 100}%` }} /></div>
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
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-stretch" onClick={onClose}>
      <div className={`bg-[var(--paper)] text-[var(--ink)] flex flex-col ${profile === "desktop" ? "m-auto w-[560px] max-w-[90vw] h-[70vh] rounded-3xl border border-[var(--line)] shadow-2xl overflow-hidden" : "w-full h-full"}`} style={{ paddingTop: profile === "mobile" ? "env(safe-area-inset-top,0px)" : undefined }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
          <span className="font-bold text-sm font-[family-name:var(--serif)]">{label}</span>
          <div className="flex gap-2">
            <button className="squish-btn flex items-center gap-1 rounded-full bg-[var(--blue)] text-white text-xs px-4 py-1.5" onClick={() => onSave(v)}>
              <Save size={14} /> Simpan
            </button>
            <button onClick={onClose} aria-label="Tutup" className="p-1 rounded-lg text-[var(--ink-soft)]"><X size={18} /></button>
          </div>
        </div>
        <textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} className="flex-1 w-full p-4 bg-transparent outline-none resize-none text-[var(--ink)] text-sm leading-relaxed" placeholder="Tulis di sini…" />
      </div>
    </div>
  );
}
