"use client";

import { useEffect, useRef } from "react";

/**
 * The brutalist bezel: a hairline frame around the viewport with crop-mark
 * corners and notched tabs carrying live readouts — pointer coordinates,
 * the section you're in, and scroll depth. Every label is real data, not
 * decoration; values update through refs so nothing re-renders per frame.
 */
export function BrutalFrame() {
  const coordRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLSpanElement>(null);
  const depthRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastLabel = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = document.documentElement;
      const x = Number(root.style.getPropertyValue("--holo-x") || 0.5);
      const y = Number(root.style.getPropertyValue("--holo-y") || 0.5);
      if (coordRef.current) {
        coordRef.current.textContent = `X ${x.toFixed(4).slice(1)} // Y ${y.toFixed(4).slice(1)}`;
      }
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const pct = Math.round((window.scrollY / max) * 100);
      if (depthRef.current) depthRef.current.textContent = `${String(pct).padStart(3, "0")}%`;

      // Section label: the last anchor whose top has crossed the midline.
      const mid = window.innerHeight * 0.5;
      const els = document.querySelectorAll<HTMLElement>("[data-holo-label]");
      let label = "";
      let idx = 0;
      els.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= mid) {
          label = el.dataset.holoLabel || "";
          idx = i;
        }
      });
      if (label !== lastLabel && sectionRef.current) {
        lastLabel = label;
        sectionRef.current.textContent = `${String(idx + 1).padStart(2, "0")} ${label}`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden="true" className="brutal-frame pointer-events-none fixed inset-0 z-40">
      <span className="bf-corner bf-tl" />
      <span className="bf-corner bf-tr" />
      <span className="bf-corner bf-bl" />
      <span className="bf-corner bf-br" />

      <div className="bf-tab bf-tab-bottom">
        <span ref={sectionRef} className="bf-cell bf-section">01 Hero</span>
        <span className="bf-sep" />
        <span ref={coordRef} className="bf-cell">X .5000 // Y .5000</span>
        <span className="bf-sep bf-hide-sm" />
        <span ref={depthRef} className="bf-cell bf-hide-sm">000%</span>
      </div>
    </div>
  );
}
