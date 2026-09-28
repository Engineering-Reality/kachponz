"use client";

import { useState } from "react";
import { PencilLine, Brain, Boxes, Timer, Network, GitFork, Award, Check, X, Info, ChevronRight, Printer } from "lucide-react";
import { useEbook, type QuizDef } from "./state";
import type { Block } from "./types";
import { FiveWhysStairs } from "./games/FiveWhysStairs";
import { ComplaintJars } from "./games/ComplaintJars";
import { CocdStickers } from "./games/CocdStickers";
import { Crazy8sTimer } from "./games/Crazy8sTimer";
import { FlippingFlashcards } from "./games/FlippingFlashcards";
import { ReleaseNotesApp } from "./games/ReleaseNotesApp";

// Buka route cetak untuk satu / semua lembar kerja (token dari URL sekarang).
export function printSheets(sheets: string) {
  const parts = window.location.pathname.split("/");
  const slug = parts[2] || "";
  const t = new URLSearchParams(window.location.search).get("t") || "";
  window.open(`/read/${slug}/print?t=${encodeURIComponent(t)}&sheets=${encodeURIComponent(sheets)}`, "_blank");
}

// Semua komponen ini BERTINGGI TETAP: perubahan state tidak menambah tinggi
// halaman (hasil kuis -> panel; edit textarea HP -> sheet; penjelasan -> tooltip).

function TextField({ id, label }: { id: string; label: string }) {
  const { get, set } = useEbook();
  return (
    <div>
      <label className="lbl block text-xs font-bold text-[var(--ink-soft)] mb-1 font-[family-name:var(--serif)]">{label}</label>
      <input className="field w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]" value={String(get(id) ?? "")} onChange={(e) => set(id, e.target.value)} />
    </div>
  );
}

function SelectField({ id, label, options }: { id: string; label: string; options: string[] }) {
  const { get, set } = useEbook();
  return (
    <div>
      <label className="lbl block text-xs font-bold text-[var(--ink-soft)] mb-1 font-[family-name:var(--serif)]">{label}</label>
      <select className="field w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]" value={String(get(id) ?? "")} onChange={(e) => set(id, e.target.value)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function AreaField({ id, label, lines = 2 }: { id: string; label: string; lines?: number }) {
  const { get, set, profile, openEditor } = useEbook();
  const val = String(get(id) ?? "");
  if (profile === "mobile")
    return (
      <div>
        <label className="lbl block text-xs font-bold text-[var(--ink-soft)] mb-1 font-[family-name:var(--serif)]">{label}</label>
        <button
          type="button"
          className="field w-full text-left text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
          style={{ height: lines * 22 + 16, overflow: "hidden", whiteSpace: "pre-wrap" }}
          onClick={() => openEditor({ id, label })}
        >
          {val || <span className="text-[var(--ink-soft)] italic">Ketuk untuk menulis…</span>}
        </button>
      </div>
    );
  return (
    <div>
      <label className="lbl block text-xs font-bold text-[var(--ink-soft)] mb-1 font-[family-name:var(--serif)]">{label}</label>
      <textarea className="field w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] outline-none resize-none" rows={lines} value={val} onChange={(e) => set(id, e.target.value)} />
    </div>
  );
}

export function WorksheetView({ b }: { b: Extract<Block, { type: "worksheet" }> }) {
  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-2 mb-3">
        <span className="flex items-center gap-2 text-xs font-bold text-[var(--accent)] font-mono uppercase tracking-wider">
          <PencilLine size={16} aria-hidden />
          <span>Lembar Kerja</span>
        </span>
        <button type="button" data-no-swipe onClick={() => printSheets(b.id)} aria-label="Cetak lembar ini" className="p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <Printer size={15} />
        </button>
      </div>
      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">{b.title}</h3>
      <div className="space-y-3">
        {b.fields.map((f) => (
          <div key={f.id}>
            {f.kind === "textarea" ? (
              <AreaField id={`${b.id}.${f.id}`} label={f.label} lines={f.lines || 2} />
            ) : f.kind === "select" ? (
              <SelectField id={`${b.id}.${f.id}`} label={f.label} options={f.options || []} />
            ) : (
              <TextField id={`${b.id}.${f.id}`} label={f.label} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuizView({ b }: { b: Extract<Block, { type: "quiz" }> }) {
  const { get, set, openQuiz } = useEbook();
  const ans = (get(b.id) as Record<string, string>) || {};
  const pick = (qId: string, optId: string) => set(b.id, { ...ans, [qId]: optId });
  const answered = Object.keys(ans).length;
  const quizDef: QuizDef = b;

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 mb-3">
        <Brain size={16} aria-hidden className="text-amber-500" />
        <span className="text-xs font-bold text-[var(--accent)] font-mono uppercase tracking-wider">Kuis</span>
      </div>
      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">{b.title}</h3>
      {b.questions.map((q) => (
        <div key={q.id} className="relative mb-3">
          <p className="flex items-start gap-2 text-xs font-bold text-[var(--ink)] mb-2 font-[family-name:var(--serif)]">
            <span className="flex-1">{q.prompt}</span>
            {q.explanation && <span title={q.explanation} aria-label="Penjelasan"><Info size={14} className="text-[var(--accent)]" /></span>}
          </p>
          <div className="grid gap-2">
            {q.options.map((o) => {
              const sel = ans[q.id] === o.id;
              const knowledge = b.variant === "knowledge";
              const state = knowledge && sel ? (o.correct ? "ok" : "no") : sel ? "sel" : "";
              const bg = state === "ok" ? "var(--ok-soft)" : state === "no" ? "var(--red-soft)" : state === "sel" ? "var(--accent-soft)" : "var(--paper)";
              const border = state === "ok" ? "var(--ok)" : state === "no" ? "var(--red)" : state === "sel" ? "var(--accent)" : "var(--line)";
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(q.id, o.id)}
                  data-no-swipe
                  className="squish-btn text-left p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all"
                  style={{ background: bg, borderColor: border, color: "var(--ink)" }}
                >
                  {knowledge && sel && (o.correct ? <Check size={14} className="text-green-600" /> : <X size={14} className="text-red-600" />)}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {(b.variant === "type" || b.variant === "scale") && (
        <button
          type="button"
          onClick={() => openQuiz(quizDef)}
          data-no-swipe
          className="squish-btn mt-2 flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] bg-transparent border-0 p-1"
        >
          <span>{answered >= b.questions.length ? "Lihat hasil lengkap" : `Jawab semua (${answered}/${b.questions.length})`}</span>
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function Grid({ id, cells, cols, h, label }: { id: string; cells: string[]; cols: number; h: number; label: (i: number) => string }) {
  const { get, set, profile, openEditor } = useEbook();
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 8 }}>
      {cells.map((_, i) => {
        const cid = `${id}.${i}`;
        const val = String(get(cid) ?? "");
        return profile === "mobile" ? (
          <button key={i} className="reserved rounded-xl text-xs p-2 text-left" style={{ height: h, overflow: "hidden" }} onClick={() => openEditor({ id: cid, label: label(i) })}>
            {val || <span className="text-[var(--ink-soft)] italic">{label(i)}</span>}
          </button>
        ) : (
          <textarea key={i} className="field rounded-xl text-xs p-2 bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] outline-none" style={{ height: h, resize: "none" }} placeholder={label(i)} value={val} onChange={(e) => set(cid, e.target.value)} />
        );
      })}
    </div>
  );
}

export function CocdView({ b }: { b: Extract<Block, { type: "cocdBox" }> }) {
  return <CocdStickers id={b.id} title={b.title} />;
}

export function Crazy8View({ b }: { b: Extract<Block, { type: "crazy8" }> }) {
  return <Crazy8sTimer id={b.id} title={b.title} />;
}

export function MindMapView({ b }: { b: Extract<Block, { type: "mindMap" }> }) {
  return (
    <div className="story-card w-full p-4 flex flex-col justify-between">
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 mb-2">
        <Network size={16} className="text-amber-500" />
        <span className="text-xs font-bold text-[var(--accent)] font-mono uppercase tracking-wider">Mind Map</span>
      </div>
      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-2">{b.title}</h3>
      <TextField id={`${b.id}.center`} label="Topik pusat" />
      <div className="mt-2">
        <Grid id={`${b.id}.br`} cells={Array(6).fill("")} cols={3} h={48} label={(i) => `Cabang ${i + 1}`} />
      </div>
    </div>
  );
}

export function FishboneView({ b }: { b: Extract<Block, { type: "fishbone" }> }) {
  return (
    <div className="story-card w-full p-4 flex flex-col justify-between">
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 mb-2">
        <GitFork size={16} className="text-amber-500" />
        <span className="text-xs font-bold text-[var(--accent)] font-mono uppercase tracking-wider">Tulang Ikan</span>
      </div>
      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-2">{b.title}</h3>
      <TextField id={`${b.id}.head`} label="Masalah (kepala ikan)" />
      <div className="mt-2">
        <Grid id={`${b.id}.cause`} cells={Array(4).fill("")} cols={2} h={56} label={(i) => `Sebab ${i + 1}`} />
      </div>
    </div>
  );
}

export function CertificateView({ b }: { b: Extract<Block, { type: "certificate" }> }) {
  const [printed, setPrinted] = useState(false);
  return (
    <div className="story-card w-full p-6 text-center border-2 border-[var(--gold)] flex flex-col items-center justify-between">
      <div className="flex items-center gap-2 text-amber-500 mb-2">
        <Award size={20} />
        <span className="text-xs font-bold uppercase tracking-wider font-mono">Sertifikat Kelulusan</span>
      </div>
      <h3 className="text-xl font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-2">{b.title}</h3>
      <div className="w-full max-w-xs my-2">
        <TextField id="certificate.name" label="Nama Penjelajah" />
      </div>
      <p className="text-xs text-[var(--ink-soft)] font-[family-name:var(--serif)] italic my-2">
        Telah berhasil menuntaskan penjelajahan enam ruangan di My Mind Palace.
      </p>
      <button
        type="button"
        data-no-swipe
        onClick={() => {
          setPrinted(true);
          window.print();
        }}
        className="squish-btn bg-[var(--blue)] text-white text-xs px-5 py-2.5 rounded-full shadow-md mt-2"
      >
        {printed ? "Tercetak" : "Cetak Sertifikat"}
      </button>
    </div>
  );
}
