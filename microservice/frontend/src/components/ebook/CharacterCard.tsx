"use client";

import React, { useRef, useState } from "react";
import { Download, Sparkles, Trophy, Compass, ShieldAlert, Laptop } from "lucide-react";
import { BunnyBuddy } from "./BunnyBuddy";

export interface CharacterCardData {
  typeName: string;
  subtitle: string;
  developerRole: string;
  strengths: string[];
  challenge: string;
  quote: string;
}

export function CharacterCard({
  data = {
    typeName: "Penjelajah Sistem",
    subtitle: "Pencari Akar Masalah & Pola Tersembunyi",
    developerRole: "Systems Architect / Root-Cause Investigator",
    strengths: [
      "Melihat gambaran besar sebelum terburu-buru coding",
      "Kuat membongkar asumsi awal sampai ke akar",
      "Tenang menghadapi bug yang membingungkan",
    ],
    challenge: "Kadang terlalu lama menganalisis sebelum mulai membuat purwarupa pertama.",
    quote: "Solusi terbaik sering kali bukan kode paling rumit, melainkan pertanyaan yang paling tepat.",
  },
}: {
  data?: CharacterCardData;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Export 1080x1920 PNG via HTML5 Canvas
  const handleExportStory = () => {
    setExporting(true);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setExporting(false);
      return;
    }

    // Background Dark Indigo Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
    bgGrad.addColorStop(0, "#131034");
    bgGrad.addColorStop(0.5, "#1C1848");
    bgGrad.addColorStop(1, "#0B0A1F");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative Aurora Glow
    const glowGrad = ctx.createRadialGradient(540, 400, 50, 540, 400, 450);
    glowGrad.addColorStop(0, "rgba(34, 211, 238, 0.25)");
    glowGrad.addColorStop(0.6, "rgba(217, 70, 239, 0.15)");
    glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Draw Card Frame
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(80, 120, 920, 1680, 40);
    ctx.stroke();

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px serif";
    ctx.textAlign = "center";
    ctx.fillText(data.typeName, 540, 360);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "34px sans-serif";
    ctx.fillText(data.subtitle, 540, 430);

    // Role
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(`Peran: ${data.developerRole}`, 540, 530);

    // Strengths
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 38px serif";
    ctx.textAlign = "left";
    ctx.fillText("3 Kekuatan Utamamu:", 140, 680);

    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#e2e8f0";
    data.strengths.forEach((s, i) => {
      ctx.fillText(`✦  ${s}`, 140, 750 + i * 70);
    });

    // Challenge
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 38px serif";
    ctx.fillText("Tantangan & Pengingat:", 140, 1020);

    ctx.font = "32px sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(data.challenge, 140, 1080);

    // Quote Box
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.beginPath();
    ctx.roundRect(140, 1220, 800, 260, 24);
    ctx.fill();

    ctx.fillStyle = "#fde047";
    ctx.font = "italic 36px serif";
    ctx.textAlign = "center";
    ctx.fillText(`"${data.quote}"`, 540, 1360);

    // Footer
    ctx.fillStyle = "#94a3b8";
    ctx.font = "28px sans-serif";
    ctx.fillText("My Mind Palace Vol. I — kachponz.com", 540, 1720);

    // Download PNG
    const link = document.createElement("a");
    link.download = `kartu-karakter-${data.typeName.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExporting(false);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-2">
      {/* Holographic Spinning Rainbow Frame */}
      <div
        ref={cardRef}
        className="relative w-full max-w-sm rounded-3xl p-[3px] shadow-2xl transition-transform hover:scale-[1.01]"
        style={{
          background: "conic-gradient(from 180deg, #22d3ee, #3b82f6, #d946ef, #fb923c, #facc15, #22d3ee)",
        }}
      >
        <div className="w-full bg-[var(--sheet)] text-[var(--ink)] rounded-[22px] p-6 flex flex-col items-center text-center">
          {/* Top Badge */}
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[var(--num)] bg-[var(--accent-soft)] px-3 py-1 rounded-full mb-3">
            <Trophy size={14} className="text-amber-400" />
            <span>Kartu Karakter Koleksi</span>
          </div>

          {/* Mascot Illustration */}
          <div className="my-2 relative">
            <BunnyBuddy mood="correct" size={80} />
            <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse">
              <Sparkles size={20} fill="#facc15" />
            </div>
          </div>

          {/* Type Name */}
          <h2 className="text-2xl font-extrabold font-[family-name:var(--serif)] text-[var(--ink)] mt-1">
            {data.typeName}
          </h2>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5 mb-3">{data.subtitle}</p>

          {/* Role Match */}
          <div className="w-full flex items-center justify-center gap-2 bg-[var(--paper)] border border-[var(--line)] py-1.5 px-3 rounded-xl mb-4 text-xs font-semibold text-[var(--accent)]">
            <Laptop size={14} />
            <span>{data.developerRole}</span>
          </div>

          {/* Strengths List */}
          <div className="w-full text-left bg-[var(--accent-soft)]/50 border border-[var(--line)] p-3.5 rounded-2xl mb-3">
            <span className="text-xs font-bold text-[var(--accent)] flex items-center gap-1.5 mb-2">
              <Compass size={14} /> 3 Kekuatan Utama:
            </span>
            <ul className="text-xs space-y-1.5 text-[var(--ink)]">
              {data.strengths.map((st, i) => (
                <li key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-amber-400 font-bold">✦</span>
                  <span>{st}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Challenge */}
          <div className="w-full text-left bg-[var(--red-soft)] border border-[var(--line)] p-3 rounded-2xl mb-4 text-xs text-[var(--ink)]">
            <span className="font-bold text-[var(--red)] flex items-center gap-1.5 mb-1">
              <ShieldAlert size={14} /> Tantangan:
            </span>
            <p className="leading-snug text-xs">{data.challenge}</p>
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportStory}
            disabled={exporting}
            className="squish-btn w-full bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 shadow-md py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <Download size={14} />
            <span>{exporting ? "Menyiapkan Kartu…" : "Simpan Kartu (Ukuran Story)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
