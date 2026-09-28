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
- Menyusul: (c) HP swipe ikut jari + chrome auto-hide, (d) komponen interaktif penuh,
  (e) cetak + Playwright + lint emoji.

## Catatan
- Watermark dihapus dari tampilan atas permintaan pemilik (semula §9). Gerbang akses tetap:
  konten hanya via API bertoken + device-lock 2 perangkat, `cache-control: private, no-store`.
- Drag-dari-sudut yang mengikuti pointer: menyusul (saat ini zona sudut = klik). 
- Paginasi paragraf per-kalimat & cache sessionStorage: menyusul (fase penyempurnaan).
