"use client";

import { useState } from "react";
import { PencilLine, Brain, Boxes, Timer, Network, GitFork, Award, Check, X, Info, ChevronRight } from "lucide-react";
import { useEbook, type QuizDef } from "./state";
import type { Block } from "./types";

// Semua komponen ini BERTINGGI TETAP: perubahan state tidak menambah tinggi
// halaman (hasil kuis → panel; edit textarea HP → sheet; penjelasan → tooltip).

function TextField({ id, label }: { id: string; label: string }) {
  const { get, set } = useEbook();
  return (<><label className="lbl">{label}</label><input className="field" value={String(get(id) ?? "")} onChange={(e) => set(id, e.target.value)} /></>);
}
function SelectField({ id, label, options }: { id: string; label: string; options: string[] }) {
  const { get, set } = useEbook();
  return (<><label className="lbl">{label}</label><select className="field" value={String(get(id) ?? "")} onChange={(e) => set(id, e.target.value)}><option value="">—</option>{options.map((o) => <option key={o}>{o}</option>)}</select></>);
}
function AreaField({ id, label, lines = 3 }: { id: string; label: string; lines?: number }) {
  const { get, set, profile, openEditor } = useEbook();
  const val = String(get(id) ?? "");
  if (profile === "mobile")
    return (<><label className="lbl">{label}</label><button type="button" className="field text-left" style={{ height: lines * 22 + 16, overflow: "hidden", whiteSpace: "pre-wrap" }} onClick={() => openEditor({ id, label })}>{val || <span className="text-[var(--ink-soft)]">Ketuk untuk menulis…</span>}</button></>);
  return (<><label className="lbl">{label}</label><textarea className="field" rows={lines} style={{ resize: "none" }} value={val} onChange={(e) => set(id, e.target.value)} /></>);
}

export function WorksheetView({ b }: { b: Extract<Block, { type: "worksheet" }> }) {
  return (
    <div className="card">
      <div className="card-head"><PencilLine size={16} aria-hidden /><span className="tag">Lembar Kerja</span></div>
      <h3>{b.title}</h3>
      {b.fields.map((f) => (
        <div key={f.id}>
          {f.kind === "textarea" ? <AreaField id={`${b.id}.${f.id}`} label={f.label} lines={f.lines} />
            : f.kind === "select" ? <SelectField id={`${b.id}.${f.id}`} label={f.label} options={f.options || []} />
            : <TextField id={`${b.id}.${f.id}`} label={f.label} />}
        </div>
      ))}
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
    <div className="card">
      <div className="card-head"><Brain size={16} aria-hidden /><span className="tag">Kuis</span></div>
      <h3>{b.title}</h3>
      {b.questions.map((q) => (
        <div key={q.id} style={{ position: "relative", marginBottom: 10 }}>
          <p style={{ display: "flex", gap: 6, alignItems: "start" }}>
            <b style={{ flex: 1 }}>{q.prompt}</b>
            {q.explanation && <span title={q.explanation} aria-label="Penjelasan"><Info size={15} /></span>}
          </p>
          <div style={{ display: "grid", gap: 4 }}>
            {q.options.map((o) => {
              const sel = ans[q.id] === o.id;
              const knowledge = b.variant === "knowledge";
              const state = knowledge && sel ? (o.correct ? "ok" : "no") : sel ? "sel" : "";
              const bg = state === "ok" ? "var(--ok)" : state === "no" ? "var(--red)" : state === "sel" ? "var(--accent)" : "transparent";
              const col = state ? "#fff" : "var(--ink)";
              return (
                <button key={o.id} type="button" onClick={() => pick(q.id, o.id)} data-no-swipe
                  style={{ textAlign: "left", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 10px", background: bg, color: col, font: "inherit", display: "flex", gap: 6, alignItems: "center" }}>
                  {knowledge && sel && (o.correct ? <Check size={14} /> : <X size={14} />)}
                  <span>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {(b.variant === "type" || b.variant === "scale") && (
        <button type="button" onClick={() => openQuiz(quizDef)} data-no-swipe
          className="mt-1" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", font: "inherit", background: "none", border: 0 }}>
          {answered >= b.questions.length ? "Lihat hasil" : `Jawab semua (${answered}/${b.questions.length})`} <ChevronRight size={15} />
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
        const cid = `${id}.${i}`; const val = String(get(cid) ?? "");
        return profile === "mobile"
          ? <button key={i} className="reserved" style={{ height: h, textAlign: "left", overflow: "hidden" }} onClick={() => openEditor({ id: cid, label: label(i) })}>{val || label(i)}</button>
          : <textarea key={i} className="field" style={{ height: h, resize: "none" }} placeholder={label(i)} value={val} onChange={(e) => set(cid, e.target.value)} />;
      })}
    </div>
  );
}

export function CocdView({ b }: { b: Extract<Block, { type: "cocdBox" }> }) {
  const quads = ["Now — mudah & berdampak", "How — sulit tapi berdampak", "Wow — ide liar"];
  return (<div className="card"><div className="card-head"><Boxes size={16} /><span className="tag">COCD Box</span></div><h3>{b.title}</h3>
    <Grid id={b.id} cells={quads} cols={3} h={120} label={(i) => quads[i]} /></div>);
}
export function Crazy8View({ b }: { b: Extract<Block, { type: "crazy8" }> }) {
  return (<div className="card"><div className="card-head"><Timer size={16} /><span className="tag">Crazy 8s</span></div><h3>{b.title}</h3>
    <Grid id={b.id} cells={Array(8).fill("")} cols={4} h={80} label={(i) => `Ide ${i + 1}`} /></div>);
}
export function MindMapView({ b }: { b: Extract<Block, { type: "mindMap" }> }) {
  return (<div className="card"><div className="card-head"><Network size={16} /><span className="tag">Mind Map</span></div><h3>{b.title}</h3>
    <TextField id={`${b.id}.center`} label="Topik pusat" />
    <Grid id={`${b.id}.br`} cells={Array(6).fill("")} cols={3} h={56} label={(i) => `Cabang ${i + 1}`} /></div>);
}
export function FishboneView({ b }: { b: Extract<Block, { type: "fishbone" }> }) {
  return (<div className="card"><div className="card-head"><GitFork size={16} /><span className="tag">Tulang Ikan</span></div><h3>{b.title}</h3>
    <TextField id={`${b.id}.head`} label="Masalah (kepala ikan)" />
    <Grid id={`${b.id}.cause`} cells={Array(4).fill("")} cols={2} h={64} label={(i) => `Sebab ${i + 1}`} /></div>);
}
export function CertificateView({ b }: { b: Extract<Block, { type: "certificate" }> }) {
  const [printed, setPrinted] = useState(false);
  return (
    <div className="card" style={{ textAlign: "center", borderWidth: 2 }}>
      <div className="card-head" style={{ justifyContent: "center" }}><Award size={16} /><span className="tag">Sertifikat</span></div>
      <h3>{b.title}</h3>
      <TextField id="certificate.name" label="Nama" />
      <p style={{ marginTop: 10, fontFamily: "var(--serif)" }}>Telah menuntaskan perjalanan My Mind Palace.</p>
      <button type="button" data-no-swipe onClick={() => { setPrinted(true); window.print(); }} style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 999, padding: "6px 14px", background: "none", color: "var(--ink)" }}>
        {printed ? "Tercetak" : "Cetak sertifikat"}
      </button>
    </div>
  );
}
