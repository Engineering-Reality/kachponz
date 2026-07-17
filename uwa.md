# Claude Code Prompt — Light/Dark Mode + Aurora Palette + Copy Cleanup

## Scope
4 halaman: `/agents`, `/tools`, `/agent-creator`, `/playground`
(file: `agents/page.tsx`, `tools/page.tsx`, `agent-creator/page.tsx`,
`playground/page.tsx`), plus shell pembungkusnya `AppShell.tsx`.

## Temuan penting sebelum mulai ngerjain

- **Dark mode belum ada sama sekali di app yang login-protected.** Cek
  `grep -c "dark:" ` ke semua file di atas hasilnya 0 — termasuk
  `AppShell.tsx` (sidebar/nav chrome). Infra dark mode-nya sendiri sudah
  ada dan jalan (`next-themes`, `ThemeToggle.tsx`, `.dark` class di
  `globals.css`, `defaultTheme="dark"` di `layout.tsx`) — cuma dipakai di
  homepage/marketing, belum pernah di-wire ke halaman app-nya.
- **Root cause yang paling efisien buat dibenerin duluan**: keempat
  halaman ini pakai shared CSS classes dari `globals.css`
  (`.form-input`, `.form-label`, `.btn-primary`, `.btn-secondary`,
  `.page-shell`, `.page-header`, `.badge-*`) puluhan kali per halaman
  (mis. `form-input` dipakai 22x di `agents/page.tsx`, 15x di
  `tools/page.tsx`). Class-class ini di-hardcode warna hex light-mode
  tanpa override dark — kalau ini dibenerin sekali di `globals.css`,
  mayoritas permukaan visual di 4 halaman otomatis ke-dark-mode-in tanpa
  nyentuh JSX-nya. Kerjakan ini SEBELUM masuk ke utility class per-baris.
- Warna aksen yang dipakai sekarang: `indigo`, `pink`, `violet`,
  `orange`, `blue` — tidak konsisten dengan palette aurora homepage
  (cyan `#22d3ee` / fuchsia `#d946ef` / yellow `#fde047`, sudah didefinisi
  sebagai `--aurora-cyan` / `--aurora-fuchsia` / `--aurora-yellow` di
  `globals.css`).
- **JANGAN swap warna semantik**: `red` (error/delete/destructive),
  `green` (success/status online), `amber` (warning) itu bukan
  keputusan branding — itu makna fungsional. Kalau ikut di-swap ke
  cyan/fuchsia/yellow, user bisa salah baca status (apalagi ini tools
  operasional bank). Biarkan tetap red/green/amber.

## Task 1 — Perbaiki shared classes di `globals.css` (kerjakan duluan)

Tambahkan dark-mode override untuk tiap class berikut, ikuti pola warna
yang SUDAH dipakai di komponen yang sudah benar (`ThemeToggle.tsx`,
`FeatureShowcase.tsx`, homepage `page.tsx`) supaya konsisten — jangan
bikin palette dark baru:
- `.form-input`, `.form-label`
- `.btn-primary`, `.btn-secondary`
- `.page-shell`, `.page-header`
- `.badge-green`, `.badge-red`, `.badge-blue`, `.badge-orange`,
  `.badge-slate` (dan `.badge-success` kalau ada — cek dulu, kelihatannya
  dipakai di `agent-creator/page.tsx` tapi definisinya belum ketemu di
  `globals.css`, mungkin perlu ditambahkan)
- `.status-dot` variants (`.online`, `.offline`, `.active`)

Gunakan selector `.dark` yang sudah ada (bukan bikin sistem baru), dan
kalau memungkinkan pindahkan warna-warna ini ke CSS variable (seperti
`--background`/`--foreground` yang sudah ada) supaya konsisten dan gampang
di-maintain ke depannya — bukan cuma nempelin `.dark .form-input { ... }`
satu-satu tanpa struktur.

## Task 2 — Dark mode untuk `AppShell.tsx`

Sidebar/nav chrome ini dipakai di semua 4 halaman — kalau dark mode-nya
belum jalan di sini, keempat halaman bakal keliatan setengah-tema
walaupun Task 1 & 3 udah beres. Tambahkan `dark:` variant ke semua
background/border/text di sini, ikuti convention yang sama.

## Task 3 — Sisa raw Tailwind utility class per halaman

Setelah Task 1 & 2, baru masuk ke warna yang ditulis langsung di JSX
masing-masing 4 halaman (bukan lewat shared class). Pakai mapping ini
(sudah dipakai konsisten di komponen yang sudah dark-mode-ready):
- `bg-white` → tambah `dark:bg-slate-900`
- `bg-slate-50` → tambah `dark:bg-slate-800/50`
- `border-slate-200` → tambah `dark:border-slate-800`
- `text-slate-900` → tambah `dark:text-white`
- `text-slate-600` / `text-slate-500` → tambah `dark:text-slate-400`
- `bg-slate-100` → tambah `dark:bg-slate-800`

## Task 4 — Swap warna aksen dekoratif ke palette aurora

Untuk warna yang murni dekoratif/branding (bukan status/semantic),
petakan ke aurora terdekat:
- `indigo` / `blue` (dekoratif, bukan link/info semantic) → `cyan`
- `pink` / `violet` / `purple` → `fuchsia`
- `orange` / `amber` yang dipakai dekoratif (BUKAN warning state) →
  `yellow`

Sebelum swap tiap instance, cek dulu itu dipakai buat apa — kalau itu
warning/error/success state, skip, biarkan aslinya (lihat aturan di atas).

## Task 5 — Rapikan copy, hilangin kata yang nggak perlu

Audit label, placeholder, tooltip, dan teks pendek lain di 4 halaman ini
dengan standar yang sama seperti pembersihan buzzword yang sudah
dikerjakan sebelumnya di `FeatureShowcase.tsx` (hindari kata generik
kayak "seamlessly", "powerful", "intuitive", kalimat basa-basi yang
nggak nambah informasi). Fokus ke:
- Label/tooltip yang berulang atau menjelaskan hal yang sudah jelas dari
  konteks visualnya (mis. ikon yang sudah jelas fungsinya tapi masih
  dikasih title panjang)
- Placeholder yang terlalu panjang padahal bisa lebih singkat tanpa
  kehilangan makna
- Konsistensi istilah antar 4 halaman (pastikan istilah yang sama dipakai
  sama persis di semua halaman, jangan variasi tanpa alasan)

Jangan hapus placeholder/label yang isinya contoh konkret dan penting
buat pengisian form teknis (mis. contoh format command, path, atau
template variable) — itu bukan kata yang "gaperlu", itu instruksi yang
functional.

## Urutan kerja & verifikasi
1. Task 1 (globals.css) → cek di browser: toggle dark/light di satu
   halaman dulu (`/agents` misalnya), pastikan form-input/button/badge
   ganti tema dengan benar.
2. Task 2 (AppShell) → cek sidebar ikut ganti tema.
3. Task 3 & 4 per halaman, satu-satu, toggle dark/light tiap habis satu
   halaman sebelum lanjut ke halaman berikutnya.
4. Task 5 terakhir, sambil re-check tiap halaman di kedua tema.
5. Sebelum dianggap selesai: screenshot tiap 4 halaman di light DAN dark
   mode (8 screenshot total), pastikan tidak ada teks yang nyaris tak
   kebaca (kontras kurang) di salah satu tema.