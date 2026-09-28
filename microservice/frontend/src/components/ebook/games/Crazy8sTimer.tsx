"use client";

import React, { useState, useEffect } from "react";
import { Timer, Volume2, VolumeX, Play, Pause, RotateCcw } from "lucide-react";
import { useEbook } from "../state";

export function Crazy8sTimer({
  id = "crazy-8s",
  title = "Crazy 8s: 8 Menit, 8 Ide Segar",
}: {
  id?: string;
  title?: string;
}) {
  const { get, set, profile, openEditor } = useEbook();
  const [timeLeft, setTimeLeft] = useState(480); // 8 minutes = 480s
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [activeSlot, setActiveSlot] = useState(0);

  const slots = Array.from({ length: 8 }).map((_, i) => String(get(`${id}.slot_${i + 1}`) ?? ""));

  useEffect(() => {
    let timer: any = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (soundEnabled) {
              // Soft ding via Web Audio API synth
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1.2);
              } catch {}
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, soundEnabled]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeFormatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* Header with Hourglass Timer */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Timer size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            {timeFormatted}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="p-1 rounded-lg text-xs font-bold text-[var(--ink)] hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={isRunning ? "Jeda" : "Mulai"}
          >
            {isRunning ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRunning(false);
              setTimeLeft(480);
            }}
            className="p-1 rounded-lg text-xs text-[var(--ink-soft)] hover:bg-black/10"
            aria-label="Ulang"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded-lg text-xs text-[var(--ink-soft)] hover:bg-black/10"
            aria-label={soundEnabled ? "Matikan Suara" : "Nyalakan Suara"}
          >
            {soundEnabled ? <Volume2 size={14} className="text-amber-500" /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* 8 Grid Boxes */}
      <div className="grid grid-cols-4 gap-2 mb-1">
        {slots.map((val, idx) => {
          const isActive = activeSlot === idx;

          return (
            <div
              key={idx}
              onClick={() => setActiveSlot(idx)}
              className="p-2 rounded-xl border flex flex-col justify-between min-h-[64px] transition-all cursor-pointer"
              style={{
                borderColor: isActive ? "var(--blue)" : "var(--line)",
                background: isActive ? "var(--accent-soft)" : "var(--paper)",
                boxShadow: isActive ? "0 0 10px rgba(59, 130, 246, 0.3)" : "none",
              }}
            >
              <span className="text-[10px] font-bold font-mono text-[var(--num)]">
                0{idx + 1}
              </span>
              {profile === "mobile" ? (
                <button
                  type="button"
                  onClick={() => openEditor({ id: `${id}.slot_${idx + 1}`, label: `Ide ${idx + 1}` })}
                  className="w-full text-left text-[10px] truncate text-[var(--ink)]"
                >
                  {val || <span className="text-[var(--ink-soft)] italic">Ide {idx + 1}…</span>}
                </button>
              ) : (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => set(`${id}.slot_${idx + 1}`, e.target.value)}
                  placeholder={`Ide ${idx + 1}`}
                  className="w-full text-[10px] p-1 bg-transparent border-0 outline-none text-[var(--ink)] truncate font-medium"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
