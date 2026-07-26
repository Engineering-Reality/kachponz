# Dua Prompt Siap Pakai — Amadeus Orchestrator

Dokumen ini berisi dua prompt yang bisa langsung kamu tempel ke coding assistant (Claude Code / Cursor / dsb) di dalam repo `kachponz-main`.

- **PROMPT 1** — menjalankan repo di Windows CMD pada laptop terstandardisasi CISO, tanpa merusak MCP.
- **PROMPT 2** — refactor agar muat di VPS kecil (2 vCPU / 4 GB).

Temuan teknis di bawah sudah diverifikasi langsung terhadap source code, jadi assistant tidak perlu menebak.

---

## PROMPT 1 — Menjalankan di Windows CMD (laptop CISO)

```text
KONTEKS REPO
Repo: kachponz-main (monorepo). Service utama: microservice/amadeus-core
(Node.js + TypeScript + Fastify + LangGraph + MCP), frontend: microservice/frontend (Next.js).
Target: menjalankan amadeus-core + frontend secara LOKAL di Windows 10/11 lewat CMD/PowerShell,
di laptop korporat yang terkunci kebijakan CISO (tanpa admin permanen, ada proxy TLS-inspection,
kemungkinan AppLocker/Defender ASR aktif, Docker Desktop mungkin diblokir).

TUJUAN
Buat repo ini bisa dijalankan di Windows TANPA mengubah perilaku keamanan yang sudah ada,
dan TANPA merusak fungsi MCP (baik tool 'stdio' maupun 'sse').

MASALAH YANG SUDAH DIKETAHUI (sudah diverifikasi di source code — verifikasi ulang sebelum mengubah)

1. [BLOCKER MCP] scripts/mcpAutoManager.ts (~baris 339)
   spawn(command, args, { shell: false })  // komentar di kode: "never true"
   Command yang tersimpan di tabel `tools` umumnya "npx" (lihat migrations/1792000000000_normalize_mcp_commands.ts
   yang menormalisasi command ke "npx" + args terstruktur).
   Di Windows, `npx` sebenarnya `npx.cmd`. Node child_process.spawn dengan shell:false TIDAK bisa
   mengeksekusi .cmd/.bat → gagal dengan ENOENT, dan pada Node >= 18.20.2/20.12 (perbaikan CVE-2024-27980)
   memanggil .cmd dengan shell:false ditolak dengan EINVAL.
   AKIBAT: semua MCP tool method 'sse' gagal spawn → tool tidak pernah listening → agent kehilangan seluruh tools.

2. [BLOCKER MCP] src/orchestrator/engine.ts (~baris 450 dan ~667)
   new StdioClientTransport({ command: release.command || "node", ... })
   Masalah identik untuk tool method 'stdio' yang di-spawn on-demand per koneksi.

3. [BLOCKER INSTALL] dependency `argon2` (^0.41.1) adalah native module.
   Bila prebuilt binary untuk versi Node yang dipakai tidak tersedia, npm akan mencoba kompilasi
   (butuh Visual Studio Build Tools + Python) yang biasanya tidak tersedia di laptop CISO.

4. [BLOCKER DB] migrations/1795000000000_add_rag.ts memanggil pgm.createExtension('vector')
   dan membuat index HNSW. Artinya PostgreSQL WAJIB punya extension pgvector.
   Installer PostgreSQL standar di Windows tidak menyertakan pgvector.

5. [LINGKUNGAN] Proxy TLS-inspection korporat menyebabkan:
   - `npm install` gagal: SELF_SIGNED_CERT_IN_CHAIN / UNABLE_TO_GET_ISSUER_CERT_LOCALLY
   - `npx -y <paket-mcp>` mengunduh paket SAAT RUNTIME (bukan saat install) → MCP bisa lolos install
     tapi gagal saat dipakai kalau egress ke registry diblokir.

6. [LINGKUNGAN] AppLocker/Defender ASR sering memblokir eksekusi binary dari direktori user-writable
   (cache npx ada di %LOCALAPPDATA%\npm-cache\_npx) → spawn bisa gagal walaupun path sudah benar.

7. [MINOR] scripts/migrate_supabase.ts punya path hardcoded '/home/firania/Downloads/...'.
   Script legacy; jangan dijalankan di Windows (atau tandai/skip).

8. [INFO] env HOST default '127.0.0.1' (src/config/env.ts) — sudah benar, jangan diubah.
   Windows Firewall mungkin memunculkan prompt saat pertama listen; catat sebagai langkah manual.

YANG HARUS KAMU KERJAKAN

A. Preflight check (buat script baru, mis. scripts/preflight-windows.mjs, dipanggil via `npm run preflight`)
   Cek dan laporkan dalam bentuk tabel PASS/FAIL + saran perbaikan:
   - versi Node (harus >=20 <23 sesuai engines) dan arsitektur
   - `where npx`, `where node` → tampilkan path absolut yang terdeteksi
   - apakah argon2 bisa di-require (native binding termuat)
   - koneksi ke PostgreSQL (DATABASE_URL) + apakah `CREATE EXTENSION vector` tersedia
     (query: SELECT * FROM pg_available_extensions WHERE name='vector')
   - variabel proxy (HTTP_PROXY/HTTPS_PROXY/NODE_EXTRA_CA_CERTS) dan apakah registry npm terjangkau
   - untuk setiap tool di tabel `tools`: tampilkan method + command + apakah command resolvable di PATH
   Script ini TIDAK boleh mengubah apa pun, hanya mendiagnosis.

B. Lapisan kompatibilitas spawn (INI YANG UTAMA — jangan asal set shell:true)
   Buat satu modul baru, mis. src/lib/spawnCompat.ts, yang mengekspor:
     resolveSpawnTarget(command: string, args: string[]): { command: string, args: string[] }
   Aturan:
   - Di non-Windows: kembalikan apa adanya (perilaku hari ini tidak berubah sama sekali).
   - Di Windows: resolusi command ke path absolut. Untuk shim .cmd/.bat (npx, npm, pnpm),
     JANGAN pakai shell:true (itu membuka argument-injection dan membatalkan alasan komentar
     "shell: false — never true" di kode).
     Pakai pendekatan eksplisit: spawn 'cmd.exe' dengan ['/d','/s','/c', <target>, ...args]
     DAN aktifkan windowsVerbatimArguments hanya bila kamu sendiri yang melakukan quoting,
     ATAU (lebih disukai) resolusi ke entry .js asli sehingga bisa dipanggil sebagai
     `node <path-ke-npx-cli.js> ...args` tanpa cmd.exe sama sekali.
   - Wajib: validasi/allowlist command yang boleh di-spawn (mis. hanya node/npx/path absolut
     di bawah direktori yang diizinkan), dan tolak command yang mengandung karakter meta shell.
   - Tulis unit test kecil untuk resolveSpawnTarget (kasus: npx, node, path absolut, command dengan spasi,
     command dengan karakter berbahaya).
   Terapkan modul ini di DUA tempat: scripts/mcpAutoManager.ts dan src/orchestrator/engine.ts
   (kedua lokasi StdioClientTransport). Jangan duplikasi logika.

C. Fallback offline untuk MCP
   Tambahkan opsi agar tool MCP bisa dijalankan dari paket yang SUDAH ter-install lokal
   (mis. devDependency atau folder vendor/) alih-alih `npx -y` yang menarik dari registry saat runtime.
   Dokumentasikan cara memindahkan tool dari mode "npx" ke mode "node <path lokal>" lewat data di tabel `tools`,
   dan sediakan script bantu untuk mengubahnya. Ini penting kalau egress registry diblokir.

D. Dokumentasi
   Buat docs/windows-setup.md berisi:
   - langkah instalasi (Node LTS, PostgreSQL + pgvector, cara set NODE_EXTRA_CA_CERTS untuk CA korporat)
   - dua opsi database: (1) Docker Desktop dengan image pgvector/pgvector:pg16 bila Docker diizinkan,
     (2) PostgreSQL native Windows + cara memasang pgvector bila Docker diblokir; sebutkan konsekuensinya
   - perintah menjalankan: `npm run preflight`, `npm run migrate:up`, `npm run dev`
   - daftar hal yang butuh persetujuan IT/CISO (instalasi Node, PostgreSQL, exception AppLocker bila perlu,
     akses registry npm) dalam bentuk checklist yang bisa diajukan
   - tabel troubleshooting: gejala → penyebab → perbaikan (minimal untuk ENOENT/EINVAL npx,
     SELF_SIGNED_CERT_IN_CHAIN, argon2 gagal build, extension vector tidak ada)

BATASAN KERAS (jangan dilanggar)
- JANGAN menonaktifkan verifikasi TLS secara global (dilarang: NODE_TLS_REJECT_UNAUTHORIZED=0,
  npm config set strict-ssl false). Gunakan NODE_EXTRA_CA_CERTS dengan CA korporat.
- JANGAN mengubah HOST default dari 127.0.0.1, dan jangan menambah bind 0.0.0.0.
- JANGAN melemahkan autentikasi di src/middleware/auth.ts, dan jangan mem-bypass validasi Zod.
- JANGAN menaruh secret/kredensial di dalam repo; semua lewat .env (dan pastikan .env ter-gitignore).
- JANGAN menjalankan aplikasi dengan data nasabah asli di laptop. Untuk uji coba gunakan data sintetis,
  dan biarkan NETRA_MODE sesuai kebijakan (mode cloud hanya untuk data sintetis — lihat catatan compliance
  di src/orchestrator/executors/netraClient.ts).
- Perubahan harus additive: perilaku di Linux/macOS wajib identik seperti sekarang.

OUTPUT YANG DIHARAPKAN
1. Ringkasan diagnosis (apa yang benar-benar rusak di Windows, dengan rujukan file:baris).
2. Patch/diff per file, kecil dan mudah di-review.
3. File baru: src/lib/spawnCompat.ts (+ test), scripts/preflight-windows.mjs, docs/windows-setup.md.
4. Langkah verifikasi end-to-end: perintah yang harus dijalankan dan output yang menandakan sukses
   (mis. satu MCP tool berhasil listening, satu invoke agent berhasil memanggil tool).
5. Daftar risiko sisa + rencana rollback.

Kerjakan bertahap: mulai dari (A) preflight, tunjukkan hasilnya, baru lanjut ke (B).
Jangan mengubah file di luar daftar tanpa menjelaskan alasannya lebih dulu.
```

---

## PROMPT 2 — Refactor agar muat di VPS 2 vCPU / 4 GB

> Catatan: dua paket Rp35.000 dan Rp70.000 di pertanyaanmu adalah **shared cloud hosting (cPanel)**, bukan VPS — lihat penjelasan di jawaban chat. Prompt ini ditulis untuk **VPS KVM 2 vCPU / 4 GB / ±60 GB NVMe dengan akses root**, yang merupakan tier realistis paling murah untuk stack ini.

```text
KONTEKS
Repo: kachponz-main. Service: microservice/amadeus-core (Fastify + LangGraph + MCP + PostgreSQL)
dan microservice/frontend (Next.js 16).
Target deploy: SATU VPS KVM Linux (Ubuntu 22.04/24.04), 2 vCPU, 4 GB RAM, ~60 GB NVMe, akses root.
Tujuan deployment: DEMO / staging dengan DATA SINTETIS saja (bukan data nasabah, bukan produksi bank).

TUJUAN
Buat repo ini bisa berjalan stabil dalam batas 4 GB RAM / 2 vCPU, tanpa mengorbankan kontrol keamanan
yang sudah ada, dan dengan jejak operasional sekecil mungkin.

BASELINE YANG SUDAH DIVERIFIKASI DI KODE
- amadeus-core: Fastify 5, LangGraph, MCP SDK; proses terpisah `scripts/mcpAutoManager.ts` yang
  men-spawn satu proses Node per MCP tool method 'sse' (lihat spawn di ~baris 339), plus tool 'stdio'
  yang di-spawn on-demand per koneksi (src/orchestrator/engine.ts ~450 dan ~667).
  → Ini sumber konsumsi RAM terbesar dan paling sulit diprediksi.
- PostgreSQL wajib punya extension pgvector (migrations/1795000000000_add_rag.ts: createExtension('vector') + index HNSW).
- env HOST default 127.0.0.1; docs/deployment.md mewajibkan reverse proxy TLS (Nginx/Traefik),
  TLS 1.3 fallback 1.2, dan melarang ekspos HTTP plain.
- engines.node: >=20 <23.
- Inferensi LLM lewat NETRA_BASE_URL (OpenAI-compatible). Di VPS publik ini TIDAK ada GPU:
  model harus di endpoint eksternal. Karena itu deployment ini hanya boleh memakai data sintetis
  (lihat peringatan compliance di src/orchestrator/executors/netraClient.ts).

TUGAS

A. Ukur dulu, jangan menebak
   - Buat script pengukuran (mis. scripts/measure-footprint.mjs atau dokumen langkah) yang melaporkan
     RSS tiap proses: server Fastify, mcpAutoManager, tiap MCP tool yang ter-spawn, PostgreSQL, Next.js.
   - Sajikan tabel "komponen → RAM idle → RAM saat 1 invoke agent".
   - Dari situ tentukan berapa MCP tool yang realistis boleh aktif bersamaan di 4 GB.

B. Kurangi jejak proses MCP (prioritas utama)
   - Tambahkan konsep "tool budget": batas maksimum MCP tool 'sse' yang boleh hidup bersamaan,
     dapat dikonfigurasi lewat env (mis. MCP_MAX_LIVE_TOOLS).
   - Tambahkan idle-timeout: tool 'sse' yang tidak dipakai selama N menit dihentikan dan
     akan di-spawn ulang saat dibutuhkan (manfaatkan mcp_runtime_state yang sudah ada).
   - Pastikan tidak ada kebocoran proses: proses anak wajib mati saat parent berhenti
     (tangani SIGTERM/SIGINT, dan pastikan tidak ada zombie saat restart systemd).
   - Batasi memori tiap proses anak (mis. --max-old-space-size) bila terbukti perlu dari hasil pengukuran (A).

C. Mode build & serve yang hemat
   - Jalankan backend dari hasil `npm run build` (node dist/server.js), BUKAN `tsx watch`.
   - Frontend: build di CI/lokal, di VPS cukup `next start` (atau output standalone) —
     jangan build Next.js di VPS 4 GB kalau bisa dihindari; kalau harus, dokumentasikan
     kebutuhan swap dan NODE_OPTIONS.
   - Hilangkan devDependencies dari runtime image/instalasi produksi.

D. Konfigurasi PostgreSQL untuk 4 GB
   - Berikan konfigurasi yang masuk akal untuk mesin kecil: shared_buffers, work_mem,
     maintenance_work_mem, effective_cache_size, max_connections yang selaras dengan pool `pg` di aplikasi.
   - Pastikan pool koneksi aplikasi dibatasi (cek src/db/pool.ts) dan tidak melebihi max_connections.
   - Sediakan langkah instalasi pgvector di Ubuntu.

E. Operasional
   - Buat unit systemd untuk: amadeus-core, mcpAutoManager, frontend (masing-masing terpisah,
     Restart=on-failure, User non-root, WorkingDirectory jelas, EnvironmentFile=.env).
   - Konfigurasi Nginx sebagai reverse proxy TLS sesuai docs/deployment.md
     (TLS 1.3 + fallback 1.2, proxy_pass ke 127.0.0.1, header X-Forwarded-*),
     dan pastikan SSE tidak terputus (proxy_buffering off, timeout memadai untuk streaming).
   - Aktifkan swap 2 GB + konfigurasi vm.swappiness yang wajar sebagai jaring pengaman.
   - Sediakan skrip backup PostgreSQL (pg_dump terjadwal) dan cara restore.
   - Tambahkan healthcheck: manfaatkan GET /health yang sudah ada; jelaskan cara memantaunya.

F. Dokumentasi
   Buat docs/vps-deployment.md: spesifikasi minimum, langkah instalasi dari nol, tabel port,
   variabel .env yang wajib diisi, prosedur update/rollback, dan batasan tegas
   ("demo/staging dengan data sintetis; bukan untuk data nasabah").

BATASAN KERAS
- JANGAN mengubah default HOST menjadi 0.0.0.0; akses publik hanya lewat reverse proxy.
- JANGAN menonaktifkan helmet, rate-limit, CORS, atau validasi Zod untuk "menghemat resource".
- JANGAN menaruh kredensial di repo atau di unit systemd; gunakan EnvironmentFile dengan permission 600.
- JANGAN memakai data nasabah asli di VPS ini.
- Perubahan tidak boleh mengubah kontrak API atau schema database yang sudah ada tanpa migrasi eksplisit.

OUTPUT YANG DIHARAPKAN
1. Tabel hasil pengukuran footprint (sebelum optimasi).
2. Patch per file untuk B, C, D (kecil dan bisa di-review satu per satu).
3. File baru: unit systemd, konfigurasi Nginx contoh, docs/vps-deployment.md, script backup.
4. Tabel "sebelum vs sesudah" konsumsi RAM.
5. Daftar batas kapasitas yang jujur: berapa MCP tool aktif dan berapa concurrent invoke
   yang realistis di 2 vCPU / 4 GB, serta gejala saat batas terlampaui.

Kerjakan (A) lebih dulu dan tunjukkan angkanya sebelum melakukan optimasi apa pun.
```

---

## Lampiran: memetakan hasil kerja ke checklist CISO

Empat dokumen `Lampiran Security Requirement` yang kamu punya berbentuk tabel **Area / Requirement / Compliance / Comment** yang perlu diisi. Beberapa hal di repo sudah bisa langsung dijadikan bukti:

| Dokumen | Requirement | Bukti di repo |
|---|---|---|
| API v2.6 | OAuth 2.0 / Bearer token | `src/middleware/auth.ts` — verifikasi JWT via `jose` (`OAUTH2_JWT_SECRET`) |
| API v2.6 | 2FA dengan Signature untuk API transaksi finansial | `verifyFinancialSignature()` — HMAC-SHA512 + timestamp anti-replay + signing secret ter-hash argon2 |
| API v2.6 | Whitelist HTTP Method & Content-Type | Definisi route Fastify + schema Zod per endpoint |
| Code Security Review | Rutin validasi input terpusat | `fastify-type-provider-zod` + schema di `src/routes/schemas.ts` |
| Code Security Review | Kegagalan validasi harus menolak input | `AmlVerdictSchema.safeParse` → `DomainError('LLM_PARSE_ERROR', 502)` di `src/routes/agents.ts` |

Saat menjalankan PROMPT 1 dan 2, minta assistant mencatat setiap perubahan yang menyentuh baris-baris di atas, supaya kolom **Comment** pada lampiran bisa diisi dengan rujukan file dan baris yang akurat.
