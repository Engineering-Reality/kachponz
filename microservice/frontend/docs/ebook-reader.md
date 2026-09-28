# E-Book Reader V2 — keputusan desain

## Flip engine: `PageTurn`/`BookSpread` custom (framer-motion), BUKAN react-pageflip
Alasan (syarat lolos §4 ebook.md):
- react-pageflip memperlakukan seluruh permukaan halaman sebagai area drag → mengetik
  di `<textarea>`, klik tombol kuis, memilih `<select>`, dan menambah ide COCD akan
  memicu flip. Kontrol trigger tidak cukup granular untuk halaman interaktif.
- `BookSpread` custom (framer-motion, sudah terpasang, React 19-ready) memberi kontrol penuh:
  flip HANYA dari tombol panah, keyboard (← → PageUp PageDown Home End), dan **zona sudut 48px**
  di tepi luar. Isi halaman (input/klik) tak pernah memicu flip karena tidak ada drag global.
- Animasi: leaf berputar `rotateY` 0→∓180° pada engsel tengah, dua sisi `backface-visibility:hidden`
  (depan = halaman sekarang, belakang = halaman tujuan), bayangan gradien + gutter tengah,
  durasi 620ms easing `[0.33,0,0.2,1]`.

## Profil ukuran (logis, lalu di-scale)
- desktop: 560×790, spread 2 halaman (≥1024px & landscape).
- mobile: 380×680, 1 halaman.
Paginasi pada ukuran logis profil → jumlah halaman stabil; halaman di-scale utuh dgn `transform`.

## Status
- Fase a: model konten + paginator(+test) + API bertoken + render statis. ✅
- Fase b: spread desktop + page-turn + toolbar (tema/TOC/fullscreen) + keyboard + slider. ✅
- Fase c: HP — MobilePager swipe ikut jari (track 3 halaman, snap spring), chrome
  auto-hide 3 dtk (tap tengah toggle), safe-area, TOC bottom sheet, reduced-motion crossfade. ✅
- Fase d: komponen interaktif + state tersimpan (localStorage per slug+order). Kuis knowledge
  ditandai benar/salah in-place + penjelasan via tooltip; kuis tipe/skala → panel samping (desktop)
  / bottom sheet (HP), halaman tak bertambah tinggi. Worksheet/COCD/Crazy8/MindMap/Fishbone/
  Certificate editable tinggi-tetap; textarea HP → editor full-screen (sheet). ✅
- Fase e: cetak lembar kerja A4 hitam-putih (`/read/[slug]/print?sheets=`, isian ikut),
  `npm run lint:emoji` (gagal bila emoji di reader/konten), Playwright `tests/ebook.spec.ts`
  (viewport & tema, cek overflow/emoji/flip-saat-mengetik/state-persist). ✅ SELESAI a–e.

## Menjalankan tes
- Unit paginator: `npm run test:unit` (node --test, tanpa dependency).
- Emoji: `npm run lint:emoji`.
- E2E: `npx playwright install chromium` lalu dev server (EBOOK_READER_V2=true) →
  `EBOOK_TOKEN=<token> npm run test:e2e`. Screenshot: `artifacts/screens/`.

## State (fase d)
- `EbookProvider` (context) + localStorage key `mmp:<slug>:<order_ref>`; hasil kuis & editor
  dirender DI LUAR halaman (panel/sheet) agar tinggi halaman stabil setelah paginasi.

## HP (fase c)
- Geser MENGIKUTI jari via pointer events + framer `useMotionValue`/`animate` (spring).
- Geser dimatikan bila sentuhan mulai di input/textarea/select/button/tabel bisa-geser/[data-no-swipe].
- Virtualisasi: hanya render halaman cur-1..cur+1.

## Catatan
- Watermark dihapus dari tampilan atas permintaan pemilik (semula §9). Gerbang akses tetap:
  konten hanya via API bertoken + device-lock 2 perangkat, `cache-control: private, no-store`.
- Drag-dari-sudut yang mengikuti pointer: menyusul (saat ini zona sudut = klik). 
- Paginasi paragraf per-kalimat & cache sessionStorage: menyusul (fase penyempurnaan).
