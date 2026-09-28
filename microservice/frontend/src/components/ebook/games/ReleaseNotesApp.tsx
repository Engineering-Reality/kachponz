"use client";

import React, { useState } from "react";
import { Smartphone, Sparkles, ChevronUp, ChevronDown, CheckCircle2 } from "lucide-react";
import { useEbook } from "../state";

export function ReleaseNotesApp({
  id = "release-notes",
  title = "Release Notes Diriku: Pembaruan Sistem",
}: {
  id?: string;
  title?: string;
}) {
  const { get, set, profile, openEditor } = useEbook();
  const [major, setMajor] = useState(2);
  const [minor, setMinor] = useState(0);

  const features = String(get(`${id}.features`) ?? "");
  const bugFixes = String(get(`${id}.fixes`) ?? "");

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* App Header Bar */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            Pembaruan Versi v{major}.{minor}.0
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinor((m) => m + 1)}
            className="p-1 rounded-lg text-xs font-bold text-[var(--ink)] hover:bg-black/10 flex items-center gap-0.5"
            aria-label="Naikkan Minor Version"
          >
            <ChevronUp size={14} />
            <span className="text-[10px] font-mono">+v</span>
          </button>
        </div>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* Changelog Sections */}
      <div className="space-y-3 mb-2">
        {/* Fitur Baru */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-3 rounded-2xl">
          <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1.5 mb-1.5 font-[family-name:var(--serif)]">
            <Sparkles size={14} /> Fitur Baru Diriku (Mindset & Kebiasaan):
          </span>
          {profile === "mobile" ? (
            <button
              type="button"
              onClick={() => openEditor({ id: `${id}.features`, label: "Fitur Baru Diriku" })}
              className="w-full text-left text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] truncate"
            >
              {features || <span className="text-[var(--ink-soft)] italic">Tulis kebiasaan baru yang kamu rilis…</span>}
            </button>
          ) : (
            <textarea
              rows={2}
              value={features}
              onChange={(e) => set(`${id}.features`, e.target.value)}
              placeholder="Contoh: Menambahkan buffer 15 menit sebelum rapat, stop overthinking bug…"
              className="w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] outline-none resize-none"
            />
          )}
        </div>

        {/* Bug Fixes */}
        <div className="bg-[var(--paper)] border border-[var(--line)] p-3 rounded-2xl">
          <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5 mb-1.5 font-[family-name:var(--serif)]">
            <CheckCircle2 size={14} /> Bug yang Diperbaiki (Kebiasaan Buruk):
          </span>
          {profile === "mobile" ? (
            <button
              type="button"
              onClick={() => openEditor({ id: `${id}.fixes`, label: "Bug yang Diperbaiki" })}
              className="w-full text-left text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] truncate"
            >
              {bugFixes || <span className="text-[var(--ink-soft)] italic">Tulis kebiasaan buruk yang kamu hapus…</span>}
            </button>
          ) : (
            <textarea
              rows={2}
              value={bugFixes}
              onChange={(e) => set(`${id}.fixes`, e.target.value)}
              placeholder="Contoh: Memperbaiki crash panik saat deadline dekat…"
              className="w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] outline-none resize-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
