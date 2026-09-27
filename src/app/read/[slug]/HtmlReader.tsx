"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

// Reader untuk e-book HTML mandiri: e-book punya UI + kuis sendiri, jadi kita
// tampilkan utuh dalam <iframe> full-screen. Gerbang token + device-lock +
// watermark ditangani oleh /api/read-html. deviceId dari localStorage (sama
// dengan reader gambar) supaya batas 2 perangkat konsisten.
export default function HtmlReader({ slug }: { slug: string }) {
  const token = useSearchParams().get("t");
  const [src, setSrc] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    let id = localStorage.getItem("reader_device_id");
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("reader_device_id", id);
    }
    setSrc(`/api/read-html/${slug}?t=${encodeURIComponent(token)}&d=${encodeURIComponent(id)}`);
  }, [slug, token]);

  if (!token)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white gap-4 px-6 text-center">
        <h2 className="text-xl font-bold">Tidak bisa membuka e-book</h2>
        <p className="text-zinc-300 max-w-md">Buka e-book dari link yang dikirim admin lewat WhatsApp.</p>
      </div>
    );

  return (
    <div className="fixed inset-0 bg-zinc-900">
      {src && <iframe src={src} title={slug} className="w-full h-full border-0" allow="clipboard-write" />}
    </div>
  );
}
