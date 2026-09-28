import React from "react";
import { Rabbit, Code2, Hammer, Compass } from "lucide-react";
import type { Block } from "./types";
import { WorksheetView, QuizView, CocdView, Crazy8View, MindMapView, FishboneView, CertificateView } from "./Interactive";
import { QuestCard } from "./QuestCard";
import { CharacterCard } from "./CharacterCard";
import { SketchBorder } from "./SketchBorder";
import { RibbonDivider } from "./ornaments/RibbonWave";
import { BunnyBuddy } from "./BunnyBuddy";

const CALLOUT_ICON = { note: Rabbit, developer: Code2, tryNow: Hammer, story: Compass } as const;
const CALLOUT_LABEL = { note: "Catatan Kelinci", developer: "Cara Developer", tryNow: "Coba Sekarang", story: "Kisah Nara" } as const;

export function BlockView({ b, onNextPage }: { b: Block; onNextPage?: () => void }) {
  switch (b.type) {
    case "heading": {
      const H = (`h${b.level}` as unknown) as React.ElementType;
      return <H className="font-bold font-[family-name:var(--serif)] text-[var(--ink)] leading-tight">{b.text}</H>;
    }
    case "paragraph":
      return <p className="leading-relaxed text-[var(--ink)]" dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "pullQuote":
      return (
        <p className="pull">
          {b.text}
          {b.cite ? <span className="block text-xs font-normal not-italic text-[var(--ink-soft)] mt-1"> — {b.cite}</span> : null}
        </p>
      );
    case "figure":
      return (
        <figure className="my-1">
          <SketchBorder padding="p-1" rounded="rounded-2xl">
            {"svg" in b && (b as { svg?: string }).svg ? (
              <div dangerouslySetInnerHTML={{ __html: (b as { svg: string }).svg }} />
            ) : b.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(b.img as { url?: string }).url || ""}
                srcSet={(b.img as { url2x?: string }).url2x ? `${(b.img as { url?: string }).url} 1x, ${(b.img as { url2x?: string }).url2x} 2x` : undefined}
                alt={b.img.alt}
                className="w-full rounded-xl object-contain max-h-[220px]"
              />
            ) : null}
          </SketchBorder>
          {b.caption && <figcaption className="text-xs text-center text-[var(--ink-soft)] mt-1.5 font-medium">{b.caption}</figcaption>}
        </figure>
      );
    case "callout": {
      const Icon = CALLOUT_ICON[b.variant];
      return (
        <div className="callout my-1">
          <Icon className="ic" size={20} aria-hidden />
          <div className="flex-1">
            <h4 className="font-bold text-sm text-[var(--ink)] mb-1 font-[family-name:var(--serif)]">
              {b.title || CALLOUT_LABEL[b.variant]}
            </h4>
            <div className="space-y-1 text-sm">{b.body.map((c, i) => <BlockView key={i} b={c} onNextPage={onNextPage} />)}</div>
          </div>
        </div>
      );
    }
    case "table":
      return (
        <div style={{ overflowX: "auto" }} className="swipeable-table my-1">
          <table className="w-full border-collapse text-xs rounded-xl overflow-hidden border border-[var(--line)]">
            {b.head.length > 0 && (
              <thead>
                <tr className="bg-[var(--accent-soft)]">
                  {b.head.map((h, i) => (
                    <th key={i} className="p-2 text-left font-bold text-[var(--ink)] border-b border-[var(--line)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-b border-[var(--line)] last:border-0 hover:bg-black/5 dark:hover:bg-white/5">
                  {r.map((c, j) => (
                    <td key={j} className="p-2 text-[var(--ink)]">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre className="story-card font-mono text-xs overflow-x-auto my-1 p-3 bg-[var(--paper)]">
          <code>{b.source}</code>
        </pre>
      );
    case "worksheet":
      return <WorksheetView b={b} />;
    case "quiz":
      return <QuizView b={b} />;
    case "quest":
      return (
        <QuestCard
          id={b.id}
          questionIndex={b.questionIndex}
          totalQuestions={b.totalQuestions}
          prompt={b.question.prompt}
          options={b.question.options}
          explanation={b.question.explanation}
          variant={b.variant}
          onNext={onNextPage}
          hasNext={true}
        />
      );
    case "characterCard":
      return <CharacterCard />;
    case "cocdBox":
      return <CocdView b={b} />;
    case "crazy8":
      return <Crazy8View b={b} />;
    case "mindMap":
      return <MindMapView b={b} />;
    case "fishbone":
      return <FishboneView b={b} />;
    case "certificate":
      return <CertificateView b={b} />;
    case "fullPage": {
      if (b.kind === "toc" || b.kind === "cover") {
        // Satu gambar full-bleed (halamandepan / daftar isi) — bukan tumpukan.
        const img = (b.img as { url?: string })?.url || (b.imgDark as { url?: string })?.url;
        if (img)
          return (
            <div className="fp relative w-full h-full p-0 overflow-hidden flex items-center justify-center" style={{ background: "var(--opener-bg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="w-full h-full object-contain" src={img} alt={b.kind === "cover" ? "Sampul" : "Daftar Isi"} />
            </div>
          );
        if (b.kind === "toc")
          return (
            <div className="fp toc text-left">
              <h2 className="text-2xl font-bold font-[family-name:var(--serif)] text-center mb-4 text-[var(--ink)]">{b.title || "Daftar Isi"}</h2>
              <ol className="space-y-2 w-full">
                {(b.tocEntries || []).map((t, i) => (
                  <li key={i} className="flex items-center justify-between p-2 rounded-xl bg-[var(--sheet)] border border-[var(--line)] text-sm font-semibold">
                    <span className="text-[var(--num)] font-bold mr-2">0{i + 1}.</span>
                    <span className="flex-1 text-[var(--ink)]">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          );
        return (
          <div className="fp cover relative w-full h-full p-0 flex flex-col items-center justify-center text-center">
            {b.title && <h1 className="text-3xl font-bold font-[family-name:var(--serif)]">{b.title}</h1>}
            {b.subtitle && <p className="text-sm text-[var(--ink-soft)] mt-2">{b.subtitle}</p>}
          </div>
        );
      }
      return (
        <div className="fp flex flex-col items-center justify-center text-center p-6 h-full">
          {b.img ? (
            <SketchBorder hasRainbowShimmer padding="p-2" rounded="rounded-3xl" className="shadow-lg mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={(b.img as { url?: string }).url || ""} alt={b.img.alt} className="max-h-[220px] rounded-2xl object-contain" />
            </SketchBorder>
          ) : (
            <div className="mb-4">
              <SketchBorder hasRainbowShimmer padding="p-3" rounded="rounded-3xl">
                <div className="w-36 h-36 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center border border-[var(--line)]">
                  <BunnyBuddy mood="idle" size={90} />
                </div>
              </SketchBorder>
            </div>
          )}
          {b.chapterNo != null && (
            <div className="text-4xl font-extrabold text-[var(--num)] font-[family-name:var(--serif)] mb-1">
              0{b.chapterNo}
            </div>
          )}
          {b.title && (
            <h1 className="text-2xl font-bold font-[family-name:var(--serif)] text-[var(--ink)] leading-tight mb-2">
              {b.title}
            </h1>
          )}
          {b.subtitle && <p className="text-sm text-[var(--ink-soft)] max-w-xs">{b.subtitle}</p>}
          <RibbonDivider />
        </div>
      );
    }
    default:
      return null;
  }
}
