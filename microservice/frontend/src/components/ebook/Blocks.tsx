import React from "react";
import { Rabbit, Code2, Hammer, Compass } from "lucide-react";
import type { Block } from "./types";
import { WorksheetView, QuizView, CocdView, Crazy8View, MindMapView, FishboneView, CertificateView } from "./Interactive";

const CALLOUT_ICON = { note: Rabbit, developer: Code2, tryNow: Hammer, story: Compass } as const;
const CALLOUT_LABEL = { note: "Catatan Kelinci", developer: "Cara Developer", tryNow: "Coba Sekarang", story: "Kisah Nara" } as const;

export function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "heading": {
      const H = (`h${b.level}` as unknown) as React.ElementType;
      return <H>{b.text}</H>;
    }
    case "paragraph":
      return <p dangerouslySetInnerHTML={{ __html: b.html }} />;
    case "pullQuote":
      return <p className="pull">{b.text}{b.cite ? <span> — {b.cite}</span> : null}</p>;
    case "figure":
      return (
        <figure>
          {"svg" in b && (b as { svg?: string }).svg ? (
            <div dangerouslySetInnerHTML={{ __html: (b as { svg: string }).svg }} />
          ) : b.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(b.img as { url?: string }).url || ""} srcSet={(b.img as { url2x?: string }).url2x ? `${(b.img as { url?: string }).url} 1x, ${(b.img as { url2x?: string }).url2x} 2x` : undefined} alt={b.img.alt} />
          ) : null}
          {b.caption && <figcaption>{b.caption}</figcaption>}
        </figure>
      );
    case "callout": {
      const Icon = CALLOUT_ICON[b.variant];
      return (
        <div className="callout">
          <Icon className="ic" size={22} aria-hidden />
          <div>
            <h4>{b.title || CALLOUT_LABEL[b.variant]}</h4>
            {b.body.map((c, i) => <BlockView key={i} b={c} />)}
          </div>
        </div>
      );
    }
    case "table":
      return (
        <div style={{ overflowX: "auto" }} className="swipeable-table">
          <table>
            {b.head.length > 0 && <thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>}
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "code":
      return <pre className="card"><code>{b.source}</code></pre>;
    case "worksheet":
      return <WorksheetView b={b} />;
    case "quiz":
      return <QuizView b={b} />;
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
      if (b.kind === "toc")
        return (
          <div className="fp toc">
            <h2>{b.title || "Daftar Isi"}</h2>
            <ol>{(b.tocEntries || []).map((t, i) => <li key={i}><span className="tt">{t}</span></li>)}</ol>
          </div>
        );
      if (b.kind === "cover") {
        const light = (b.img as { url?: string })?.url;
        const dark = (b.imgDark as { url?: string })?.url || light;
        return (
          <div className="fp cover">
            {light ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-light" src={light} alt="Sampul" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-dark" src={dark} alt="Sampul" />
              </>
            ) : (
              <>{b.title && <h1>{b.title}</h1>}{b.subtitle && <p>{b.subtitle}</p>}</>
            )}
          </div>
        );
      }
      return (
        <div className="fp">
          {b.chapterNo != null && <div className="knum">{b.chapterNo}</div>}
          {b.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(b.img as { url?: string }).url || ""} alt={b.img.alt} />
          )}
          {b.title && <h1>{b.title}</h1>}
          {b.subtitle && <p>{b.subtitle}</p>}
        </div>
      );
    }
    default:
      return null;
  }
}
