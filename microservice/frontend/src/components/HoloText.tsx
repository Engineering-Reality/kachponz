"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * Holographic type.
 *
 * Three things happen per glyph, all driven from one rAF loop rather than
 * per-letter CSS animations (hundreds of those would thrash the compositor):
 *
 *  1. Entrance — each glyph lifts out of the page on a 3D hinge, staggered.
 *  2. Refraction sweep — a band of light travels across the line on a slow
 *     cycle. A glyph inside the band brightens and separates into its
 *     colour channels, the way foil does when the light angle crosses it.
 *  3. Pointer parallax — glyphs lean toward the cursor, so the line feels
 *     like a physical surface catching light rather than flat text.
 *
 * `variant="foil"` fills the glyph with the moving spectrum; `variant="wire"`
 * keeps it the page's ink colour and only picks up the sweep.
 */

interface Props {
  children: string;
  variant?: "wire" | "foil";
  /** Seconds of delay before this line's glyphs begin arriving. */
  delay?: number;
  className?: string;
}

export function HoloText({ children, variant = "wire", delay = 0, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  // Render plain text on the server and for the first paint, then upgrade.
  // Splitting into glyphs during SSR would ship a wall of spans and break
  // text selection for anyone who never gets the JS. useSyncExternalStore
  // gives us "is this the client?" without a setState inside an effect.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;
    const glyphs = Array.from(el.querySelectorAll<HTMLElement>("[data-glyph]"));
    if (!glyphs.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      glyphs.forEach((g) => {
        g.style.opacity = "1";
        g.style.transform = "none";
      });
      return;
    }

    const n = glyphs.length;
    const start = performance.now() + delay * 1000;
    let raf = 0;
    let visible = true;

    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    // Cache each glyph's screen centre instead of calling getBoundingClientRect
    // every frame — that forced a synchronous layout per glyph per frame, the
    // main source of scroll jank. Re-measure only when layout can have changed.
    let centers: { cx: number; cy: number }[] = [];
    const measure = () => {
      centers = glyphs.map((g) => {
        const r = g.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      });
    };
    let needMeasure = true;
    const markDirty = () => { needMeasure = true; };
    window.addEventListener("resize", markDirty, { passive: true });
    window.addEventListener("scroll", markDirty, { passive: true });

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      if (needMeasure) { measure(); needMeasure = false; }
      const t = (now - start) / 1000;

      // Pointer position relative to this line, in [-1, 1].
      const pxRaw = Number(document.documentElement.style.getPropertyValue("--holo-x") || 0.5);
      const pyRaw = Number(document.documentElement.style.getPropertyValue("--holo-y") || 0.5);
      const pointerX = pxRaw * window.innerWidth;
      const pointerY = pyRaw * window.innerHeight;

      // The sweep travels left→right across the line every 6s.
      const sweep = ((t * 0.17) % 1) * 1.5 - 0.25;

      for (let i = 0; i < n; i++) {
        const g = glyphs[i];
        const f = n === 1 ? 0.5 : i / (n - 1);

        // 1. entrance
        const local = Math.max(0, t - i * 0.028);
        const p = local <= 0 ? 0 : Math.min(1, 1 - Math.pow(1 - Math.min(1, local / 0.85), 3));

        // 2. refraction sweep — gaussian falloff around the band centre
        const d = Math.abs(f - sweep);
        const lit = Math.exp(-(d * d) / 0.012);

        // 3. pointer parallax (uses cached centre — no per-frame layout read)
        const c = centers[i] || { cx: 0, cy: 0 };
        const dx = (pointerX - c.cx) / 400;
        const dy = (pointerY - c.cy) / 400;
        const lean = Math.max(-1, Math.min(1, dx));
        const leanY = Math.max(-1, Math.min(1, dy));

        const lift = (1 - p) * 28;
        const rotX = (1 - p) * -72 + leanY * 5 * p;
        const rotY = lean * 7 * p + lit * 6;

        g.style.opacity = String(p);
        g.style.transform = `translate3d(0,${lift}px,${lit * 16}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        g.style.setProperty("--lit", lit.toFixed(3));
        // Each glyph samples a different slice of the spectrum, and the
        // sweep nudges that slice — this is what reads as iridescence.
        g.style.setProperty("--slice", `${(f * 55 + sweep * 30 + t * 3) % 100}%`);
      }

      if (t > 3 && document.hidden) return;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", markDirty);
      window.removeEventListener("scroll", markDirty);
    };
  }, [mounted, delay, children]);

  if (!mounted) {
    return <span className={`${variant === "foil" ? "holo-text" : "wire-text"} ${className}`}>{children}</span>;
  }

  const chars = Array.from(children);

  return (
    <span
      ref={ref}
      className={`holo-line ${variant === "foil" ? "holo-line-foil" : "holo-line-wire"} ${className}`}
      // The visible glyphs are aria-hidden; this carries the real text.
      aria-label={children}
    >
      {chars.map((ch, i) =>
        ch === " " ? (
          <span key={i} aria-hidden="true">
            &nbsp;
          </span>
        ) : (
          <span key={i} data-glyph aria-hidden="true" className="holo-glyph">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
