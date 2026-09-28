import React from "react";
import { Rabbit, Code2, Hammer, Compass, PencilLine, Brain, Award, Boxes, Timer, Network, GitFork } from "lucide-react";
import type { Block } from "./types";

const CALLOUT_ICON = { note: Rabbit, developer: Code2, tryNow: Hammer, story: Compass } as const;
const CALLOUT_LABEL = { note: "Catatan Kelinci", developer: "Cara Developer", tryNow: "Coba Sekarang", story: "Kisah Nara" } as const;

// Placeholder blok interaktif (ruang dicadangkan; interaktivitas penuh di fase d).
function Reserved({ icon: Icon, tag, title, note }: { icon: React.ElementType; tag: string; title: string; note?: string }) {
  return (
    <div className="card">
      <div className="card-head"><Icon size={16} aria-hidden /><span className="tag">{tag}</span></div>
      <h3>{title}</h3>
      {note && <p className="reserved">{note}</p>}
    </div>
  );
}

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
        <div style={{ overflowX: "auto" }}>
          <table>
            {b.head.length > 0 && <thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>}
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case "code":
      return <pre className="card"><code>{b.source}</code></pre>;
    case "worksheet":
      return (
        <div className="card">
          <div className="card-head"><PencilLine size={16} aria-hidden /><span className="tag">Lembar Kerja</span></div>
          <h3>{b.title}</h3>
          {b.fields.map((f) => (
            <div key={f.id}>
              <label className="lbl">{f.label}</label>
              {f.kind === "textarea" ? <textarea className="field" rows={f.lines || 3} readOnly /> : <input className="field" readOnly />}
            </div>
          ))}
        </div>
      );
    case "quiz":
      return (
        <div className="card">
          <div className="card-head"><Brain size={16} aria-hidden /><span className="tag">Kuis</span></div>
          <h3>{b.title}</h3>
          {b.questions.map((q) => (
            <div key={q.id}>
              <p><b>{q.prompt}</b></p>
              {q.options.map((o) => <p key={o.id} className="reserved" style={{ margin: "4px 0" }}>{o.label}</p>)}
            </div>
          ))}
        </div>
      );
    case "cocdBox":
      return <Reserved icon={Boxes} tag="COCD Box" title={b.title} note="Kuadran Now / How / Wow — interaktif (fase d)." />;
    case "crazy8":
      return <Reserved icon={Timer} tag="Crazy 8s" title={b.title} note="8 sketsa ide bertimer — interaktif (fase d)." />;
    case "mindMap":
      return <Reserved icon={Network} tag="Mind Map" title={b.title} note="Peta pikiran terisi otomatis — interaktif (fase d)." />;
    case "fishbone":
      return <Reserved icon={GitFork} tag="Diagram Tulang Ikan" title={b.title} note="Sebab-akibat — interaktif (fase d)." />;
    case "certificate":
      return <Reserved icon={Award} tag="Sertifikat" title={b.title} note="Isi & cetak — fase d." />;
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
