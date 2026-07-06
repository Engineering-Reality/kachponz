# Prompt: Amadeus Frontend UI Redesign

> Copy seluruh isi ini sebagai prompt di Claude Code, working directory:
> `kachponz-main/microservice/frontend/`
>
> **Scope ketat**: hanya file frontend. Jangan sentuh apapun di luar
> `src/`, `public/`, `package.json` (devDependencies saja), dan
> `tailwind.config.*`. Backend tidak boleh diubah sama sekali.

---

## Konteks

Amadeus adalah enterprise agentic orchestrator untuk settlement Import
LC/SKBDN/SBLC di Bank Mandiri — artinya ini adalah **ops tool internal**
yang dipakai tim back office CTO yang terbiasa dengan Orchestrator UiPath
dan Bloomberg Terminal. Bukan SaaS B2C. Audience-nya adalah ops engineer,
RPA developer, dan analis yang melek terminal.

Tujuan redesign:
1. Tampilan yang **terasa dibangun, bukan di-generate** — editorial,
   punya karakter, tidak generik
2. Homepage yang **langsung menunjukkan** apa yang bisa Amadeus lakukan,
   bukan sekadar kata-kata
3. **Agent Invoke** sebagai fitur unggulan — interface-nya harus terasa
   seperti control panel sesungguhnya, bukan chat toy
4. Pertahankan **color palette yang ada**: `rainbow-*` dan `mono-*`
   yang sudah didefinisikan di `globals.css` — jangan ganti hex-nya,
   kembangkan penggunaannya
5. Font yang ada (Space Grotesk + JetBrains Mono) sudah tepat —
   **perketat cara pakainya**, bukan ganti font

---

## Design Plan

### Palette (pertahankan, kembangkan kontras)
```
Hitam editorial:  #0a0a0a (mono-950) — surface utama dark sections
Putih bersih:     #ffffff / #fafafa — konten area
Rainbow accent:   gradient 22d3ee → 3b82f6 → d946ef → ec4899 → fb923c → facc15
                  (hanya untuk satu elemen per section — jangan scatter)
Border tipis:     #e5e7eb / rgba(white, 0.08) tergantung background
```

### Typography — perketat hierarki

Saat ini font sudah benar tapi dipakai terlalu seragam. Terapkan ini:

```
Display hero:   Space Grotesk, font-black (900), tracking-tight, size 64–80px
                → HANYA untuk 1 headline per page
Section heads:  Space Grotesk, font-bold (700), size 28–36px
Body:           Space Grotesk, font-normal (400), size 15px, leading-relaxed
                text-slate-600 on white, text-slate-300 on dark bg
UI labels:      JetBrains Mono, font-medium, size 10–11px, UPPERCASE,
                letter-spacing 0.1em — untuk semua label form, badge, status
Code/data:      JetBrains Mono selalu — metric numbers, UUID, timestamps
```

Aturan: **jangan pernah pakai bold body text sebagai pengganti hierarki**.
Kalau butuh penekanan, naikkan size atau ganti warna, bukan weight.

### Signature element

**Rainbow underline yang jalan hanya di satu kata kunci per halaman** —
bukan gradient text yang shimmer di semua heading. Underline 3px animate
`border-spin` yang sudah ada, tapi posisinya presisi: di satu kata yang
paling mendefinisikan halaman. Di homepage: kata "settlement". Di agent
invoke: kata "stream". Ini yang membuat mata berhenti.

---

## File yang Harus Diubah

### 1. `src/app/globals.css` — Typography & spacing tokens

Tambahkan di bawah rule yang sudah ada (JANGAN hapus yang ada):

```css
/* === TYPOGRAPHY SYSTEM === */
.display-hero {
  font-family: var(--font-sans);
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1.0;
}

.section-head {
  font-family: var(--font-sans);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.ui-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.metric-value {
  font-family: var(--font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* === SIGNATURE: RAINBOW UNDERLINE === */
.rainbow-underline {
  display: inline;
  background-image: linear-gradient(
    90deg, #22d3ee, #3b82f6, #d946ef, #ec4899, #fb923c, #facc15, #22d3ee
  );
  background-size: 200% 3px;
  background-repeat: no-repeat;
  background-position: 0 100%;
  padding-bottom: 4px;
  animation: border-spin 4s linear infinite;
}

/* === DARK SURFACE === */
.surface-dark {
  background: #0a0a0a;
  color: #f5f5f5;
}

.surface-dark-elevated {
  background: #171717;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

/* === TERMINAL CARD (untuk agent invoke) === */
.terminal-card {
  background: #111111;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  font-family: var(--font-mono);
}

.terminal-card-header {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* === MOTION: hanya untuk elemen yang memang butuh === */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.cursor-blink {
  animation: cursor-blink 1.1s step-end infinite;
}

@keyframes stream-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.stream-in {
  animation: stream-in 0.18s ease-out both;
}

/* === NAV REFINEMENT === */
.amadeus-header {
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid #f1f5f9;
}

.nav-active-indicator {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #d946ef);
  margin-right: 6px;
  vertical-align: middle;
}
```

---

### 2. `src/app/page.tsx` — Homepage Restructure

Rewrite halaman ini sepenuhnya. Pertahankan semua state logic dan data
yang sudah ada (NAV_APPS, BENCHMARKS, dsb) — hanya ubah JSX dan tambah
CSS class.

#### Section 1: Hero

**Buang**: top banner teks "amadeus.a2a/1 — Enterprise Trade Finance Node Live"  
**Ganti dengan**: satu baris `ui-label` di dalam hero sebagai eyebrow, bukan banner terpisah.

Layout hero: **full-bleed dark section** (`surface-dark`), bukan white.
Split tetap 2 kolom di desktop.

Left column:
```
[ui-label eyebrow]: AMADEUS / A2A ORCHESTRATOR
[display-hero h1]: Automate LC
                   <span rainbow-underline>settlement</span>.
                   Without the manual.
[body text]:  Amadeus coordinates UiPath robots, PAD flows, and AI agents
              through cryptographically-audited state transitions —
              so your CTO ops team stops chasing email threads.
[CTA buttons]: "Open Console" (btn-primary, white bg/black text on dark)
               "Read Blueprint" (ghost: border white/20, text white/70)
```

Right column (pertahankan 3D stack animation yang sudah ada, adjust warna
agar cocok di dark background):
- Stack layer background: `rgba(255,255,255,0.04)` bukan putih
- Border: `rgba(255,255,255,0.10)`
- Text: putih
- Flow packet tetap ada

#### Section 2: Live Flow Ticker (BARU — signature interactive element)

Setelah hero, **section putih**, full-width, height auto.  
Ini adalah **state machine visualizer** yang menunjukkan urutan step
import_lc bergerak dari kiri ke kanan seperti ticker tape.

Data steps (hardcode, tidak perlu fetch):
```
submitted → distributed_to_analyst → doc_examined → ee_ntf_created →
ee_ntf_approved → mt_converted → swift_released → settled → advised
```

Render sebagai horizontal scroll container dengan:
- Setiap step = pill/chip `ui-label` dengan border
- Step "aktif" (animasi bergantian setiap 1.5 detik via useInterval)
  dapat `surface-dark` background + rainbow underline di label-nya
- Antar step: panah `→` kecil berwarna `slate-300`
- Di atas ticker: label `ui-label`: "IMPORT LC STATE MACHINE — LIVE DEMO"
- Di bawah ticker: satu baris teks kecil: "Step transitions are
  append-only and cryptographically logged."

Ini menunjukkan apa yang Amadeus lakukan, bukan menjelaskannya.

#### Section 3: App Grid (pertahankan NAV_APPS, redesign cards)

Background `#fafafa`. Grid 3 kolom di desktop.

Card redesign:
- Tidak ada `bg-blue-50` / colored background — semua card putih dengan
  border `#e5e7eb`
- Icon: warna rainbow accent **hanya untuk icon**, bukan background kotak
- Hover: border berubah jadi gradient rainbow tipis (1.5px, bungkus dengan
  wrapper teknik yang sama dengan user message bubble yang sudah ada)
- Label card: `section-head` size 18px
- Desc: body, slate-500

**Agent Invoke card** dibuat berbeda dari yang lain:
- Full-width di bawah grid (span 3 kolom), background `surface-dark`
- Layout horizontal: kiri = teks, kanan = mini preview terminal window
  (static, tidak perlu interaktif) yang menunjukkan contoh bot response
  dengan formatting mono
- CTA: "Launch Agent Console →" button putih di atas dark background

#### Section 4: Benchmark (pertahankan logic, redesign visual)

Background `surface-dark`. Tab tetap ada tapi style:
- Tab aktif: putih dengan titik rainbow
- Tab inactive: slate-500

Bar chart:
- Bar Amadeus: gradient rainbow horizontal (pakai `vibrant-rainbow-border`
  yang sudah ada sebagai `background`)
- Bar lainnya: `#2a2a2a` dengan border `rgba(white,0.1)`
- Label: `metric-value` font-mono untuk angka
- Angka: tampilkan dengan animasi count-up sederhana saat section masuk
  viewport (gunakan `IntersectionObserver` yang sudah ada)

#### Section 5: Security/Compliance Strip (pertahankan konten, redesign)

Background putih. Bukan card grid — **horizontal table** dengan border-top
dan border-bottom, tidak ada box/card. Tiap compliance item:
```
[nomor mono 01]  [nama kontrol]  [keterangan singkat]
```
Gaya editorial seperti invoice atau specs sheet. Tidak ada icon besar.

#### Section 6: Footer

Minimal. Dark background. Satu baris:
```
Amadeus Orchestrator — Bank Mandiri Trade Finance Ops
[mono kiri]                              [link Docs kanan]
```
Tambahkan rainbow bar 1px di atas footer (class `rainbow-bar` yang sudah ada).

---

### 3. `src/app/agent-invoke/page.tsx` — Control Panel Redesign

Ini halaman paling penting. Redesign total layout dan visual, **tanpa
mengubah satu baris logic** (fetch, handleSend, stream parsing, state).

#### Layout: Full dark, terminal-first

Ubah root container dari `bg-white` ke `bg-[#0a0a0a]`.
Semua elemen menggunakan dark palette.

#### Sidebar kiri — ubah jadi "Mission Control" panel

```
Header sidebar:
  [terminal-dot merah] [terminal-dot kuning] [terminal-dot hijau]
  "AMADEUS CONSOLE" — ui-label, slate-500

Agent Select:
  Label: "ACTIVE NODE" — ui-label
  Select: background #1a1a1a, border rgba(white,0.1), text putih
          Saat ada agent terpilih: border-nya pakai gradient rainbow tipis
  Tombol Inspect: text-only, underline on hover — tidak perlu kotak

Session Config:
  Label: "SESSION ENV" — ui-label
  Input HASH: terminal style — background #111, font-mono, text emerald-400
              prefix "HASH:" berwarna slate-500
  Checkbox "Flush Memory" dan "Load Context": redesign jadi toggle switch
  kecil custom (CSS only, tidak perlu library)

Metrics panel:
  Label: "TELEMETRY" — ui-label dengan badge "LIVE" rainbow (bukan blue)
  Setiap metric: layout dua kolom, angka pakai `metric-value` class
  Background: #111111, no border — biarkan float di dalam sidebar gelap
  Saat ada nilai: angka muncul dengan `stream-in` animation

Footer sidebar:
  Button "Apply Config": background #1a1a1a, border rainbow gradient,
  text putih — bukan full black
```

#### Area chat utama — redesign jadi stream console

Header chat area:
- Background `#0f0f0f`, border-bottom `rgba(white,0.06)`
- Status: dot animasi pulse + teks `ui-label`
- Tambahkan: nama agent terpilih di tengah header (truncated)
- Tombol clear: icon saja, merah saat hover

Empty state (belum ada pesan):
- Bukan `<Bot>` icon besar — ganti dengan ASCII art terminal prompt:
  ```
  amadeus@a2a:~$ _
  ```
  Di mana `_` menggunakan class `cursor-blink`
- Sub-teks: "Select an agent and send a prompt to begin streaming."
  Ukuran kecil, mono, slate-500

User message bubble:
- Pertahankan rainbow gradient border wrapper yang sudah ada
- Tapi background dalam: `#0f0f0f` bukan `#ffffff`
- Text: `#f5f5f5`

Bot message bubble:
- Tidak ada card/box — biarkan teks mengalir langsung
- Prefix: `amadeus ›` berwarna rainbow-gradient text (1 token saja)
- Text: slate-200, font size 14px, leading relaxed
- Tiap bot message baru muncul dengan `stream-in` animation

Agent Call card (tool execution):
- Pertahankan dark card yang sudah ada — sudah bagus
- Refinement: ganti emoji `⚙️` dengan lucide `Cpu` icon
- Tambahkan: background gradient subtle rainbow dari kiri (10% opacity)
  sebagai `::before` atau inline style

Error message:
- Pertahankan style, tambah icon `AlertTriangle` dari lucide di kiri

Input area (bawah):
- Background: `#0a0a0a`, border-top `rgba(white,0.08)`
- Textarea: background `#111`, border `rgba(white,0.06)`, text putih
  placeholder: "Query the agent..." — slate-600
- Tombol Send: background rainbow gradient (bukan hitam polos)
  icon `Send` putih
- Shortcut hint: "⏎ send · shift+⏎ newline" — ui-label, slate-600,
  di bawah input

#### Inspect panel (modal/drawer kanan)

Pertahankan logic open/close. Redesign:
- Overlay: `bg-black/60 backdrop-blur-sm`
- Panel: `surface-dark` background, width 400px
- Header panel: terminal-card-header style (dots + nama agent)
- Konten: daftar tools sebagai rows dengan border-bottom,
  bukan card grid

---

### 4. `src/app/agents/page.tsx` — Refinement (bukan rewrite)

Pertahankan semua logic. Hanya ubah visual:

- Page header: tambahkan `ui-label` eyebrow di atas judul
- Agent cards: tambahkan `stream-in` animation saat pertama load
  (staggered: `animation-delay: {index * 0.05}s`)
- Status badge ONLINE/OFFLINE: pindahkan ke pojok kanan atas card,
  bukan di dalam konten
- Tombol "Invoke Agent": ganti teks jadi "→ Invoke" dan buat text-only
  dengan underline hover, bukan full button. Ini mengurangi kesan "banyak CTA".
- Empty state: redesign seperti terminal empty state di agent-invoke

---

### 5. `src/app/dashboard/page.tsx` — Refinement

- Transaction rows: tambahkan left border 3px berwarna sesuai status
  (blue = in_progress, green = completed, red = failed, slate = idle)
- Step badges: buat lebih compact, font-mono, border tidak ada,
  background `#f8fafc` dengan teks slate-700
- Header metrik cards (jika ada): pakai `metric-value` class untuk angka

---

## Aturan Tidak Boleh Dilanggar

1. **Zero perubahan backend** — tidak ada sentuhan ke file di luar
   direktori frontend
2. **Pertahankan semua API call, state management, event handler** —
   hanya JSX dan CSS yang berubah
3. **Jangan tambah library baru** kecuali yang murni CSS/animation
   (tidak perlu Framer Motion, GSAP, dsb — semua sudah bisa dengan
   CSS animation yang sudah ada)
4. **Rainbow gradient** hanya boleh muncul di maksimal 1–2 spot per
   section, bukan diulang-ulang
5. **JetBrains Mono** hanya untuk: label UI, kode/data, metrik angka,
   terminal content — bukan untuk body text
6. **Responsif** tetap harus jalan di viewport 1024px ke atas
   (desktop-first untuk ops tool internal ini)
7. Setiap perubahan: **build check** dengan `npm run build` atau
   `npm run dev` — tidak boleh ada TypeScript error baru
8. Jangan hapus class yang sudah ada di `globals.css` — hanya tambahkan

---

## Verification Plan

Setelah selesai, cek secara visual:

```
/ (homepage)
  ✓ Hero dark background, text putih, CTA visible
  ✓ Live flow ticker berjalan (step bergantian aktif)
  ✓ Rainbow underline hanya di kata "settlement"
  ✓ Agent Invoke card berbeda dari card lain
  ✓ Benchmark bars: Amadeus = rainbow, sisanya = dark
  ✓ Footer dengan rainbow bar di atas

/agent-invoke
  ✓ Seluruh halaman dark
  ✓ Empty state menampilkan ASCII prompt + cursor blink
  ✓ Sidebar panel bergaya terminal (dots, dark background)
  ✓ Bot message muncul dengan stream-in animation
  ✓ User message: rainbow border dengan dark interior
  ✓ Send button: rainbow background
  ✓ Inspect modal: dark panel

/agents
  ✓ Cards muncul staggered
  ✓ Tombol invoke: text-only

/dashboard
  ✓ Transaction rows: left border berwarna sesuai status
```

Kalau semua centang terpenuhi dan tidak ada TypeScript error: selesai.
