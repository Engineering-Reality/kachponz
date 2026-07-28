# FASE 5 — Audit Keamanan Backend (amadeus-core)

> Scope: `microservice/amadeus-core`. Tanggal: 2026-07-27 (update 2026-07-28: #13).
> Metodologi: baca jalur auth end-to-end, telusuri tiap `fetch()`/`spawn()`,
> tiap route yang menerima `id`, tiap titik error→klien, tiap secret.
> **Belum ada kode yang diubah** — ini laporan. Severity = dampak nyata.

Ringkasan: **2 High, 6 Medium, 5 Low.** Bagian "SUDAH AMAN" di bawah sama
pentingnya — menunjukkan apa yang sudah diperiksa dan terbukti benar.

---

## Tabel temuan

| # | Temuan | file:baris | Sev | Bukti | Perbaikan | Status |
|---|---|---|---|---|---|---|
| 1 | **RCE terautentikasi via stdio MCP tool** | `orchestrator/engine.ts:471`, `routes/tools.ts:40,51` | **High** | `/tools` menyimpan `command: z.string().min(1)` + `args: z.array(z.string())` tanpa allowlist. Saat tool stdio dijalankan, `engine.ts` memanggil `StdioClientTransport({ command: release.command, args: release.args })` **langsung** — melewati `ALLOWLISTED_COMMANDS` (`npx/node/python/python3`) di `spawnCompat.ts`. `shell:false` menahan injeksi metachar shell, TAPI bukan eksekusi biner arbitrer: `command:"/bin/sh"` atau `node -e "…"` = eksekusi kode di host orchestrator. Robot/user satu company bisa naik dari "kelola tool company sendiri" → RCE di host bersama. | Validasi `command` terhadap allowlist di `toolWriteSchema` (reuse `ALLOWLISTED_COMMANDS`), DAN/ATAU routekan jalur stdio engine lewat `resolveSpawnTarget()` yang sudah punya allowlist. Pertimbangkan tolak args gaya `-e/-p/--eval` untuk node. | ✅ **FIXED** 5fd1e9c + 6d6ad20 (A1) + a24fdec (A2). A1: `assertSpawnSafe` di-enforce di engine stdio + `/tools` write **dan** absolute-path command kini ditolak (tak ada lagi escape `!isAbsolutePathLike`). A2: `hardenNpxArgs()` menulis-ulang `-y`/`--yes`→`--no-install` di luar `NODE_ENV=development` (paket harus sudah ter-vendor; nol egress registry saat runtime — penting utk on-prem), dan `cwd` dipin ke package root di **ketiga** call site (`scripts/mcpAutoManager.ts:351` SSE via `resolveSpawnTarget`, `engine.ts:490` + `engine.ts:717` stdio via `StdioClientTransport`) supaya `--no-install` benar-benar me-resolve `node_modules/.bin`. Test symmetry guard menahan regresi asimetris SSE-vs-stdio. **Pilihan transport `method` (stdio/sse) dari frontend TIDAK tersentuh** — ia field discriminated-union terpisah (`routes/tools.ts:58,64`); hardening ini hanya menyentuh `command`/`args`/`cwd`, stdio TIDAK di-drop. ⚠️ **VERIFIKASI, JANGAN PERCAYA:** finding ini SEMPAT ditandai "fixed" secara keliru pada 5fd1e9c — saat itu `assertSpawnSafe` sudah ada TAPI masih punya escape hatch `!isAbsolutePathLike(command)`, sehingga `command:"/bin/sh"` tetap lolos = RCE masih terbuka. Baru benar-benar tertutup setelah A1 (6d6ad20) membuang escape itu + A2 (a24fdec) meng-harden npx. Pelajarannya: cek `assertSpawnSafe` benar-benar menolak path absolut, jangan percaya label "fixed". (Residual: allowlist masih izinkan `node -e/-p/--eval`; catat sbg follow-up.) |
| 2 | **`backend/.env` ter-commit ke git** | repo root `backend/.env` (via `git ls-files`) | **High** | `git ls-files \| grep .env` → `backend/.env` terlacak sejak initial commit dengan kredensial **nyata** (SUPABASE_KEY, JWT_SECRET, HF_TOKEN, MAIAROUTER_API_KEY, OPENROUTER_API_KEY). | `git rm --cached` + rotasi + scrub history. | ⚠️ **PARTIAL** 12da348 — untracked. **ROTASI + scrub history masih tugas manual user** (secret masih ada di history). |
| 3 | **SSRF terautentikasi + refleksi respons (UiPath folders test)** | `orchestrator/routes.ts:589,597,614,617-620` | **Med** | `baseUrl: z.string().url().default(...)` — URL valid tapi host tidak dibatasi. Server `fetch(`${baseUrl}/identity_/connect/token`)` lalu memantulkan body upstream ke klien (`tokenText.slice(0,300)` di 502, `folders` di 200). Penyerang terautentikasi bisa mengarahkan ke `http://169.254.169.254/…` / service internal dan membaca respons. | Allowlist host / cek IP bukan link-local. Jangan pantulkan body upstream. | ✅ **FIXED** 0397314 + d2e14d3 — body upstream log-only; `UIPATH_ALLOWED_HOSTS` (env) meng-allowlist host eksak, fallback ke blokir loopback/link-local/metadata (RFC1918 diizinkan utk on-prem) saat env kosong. Residual: bukan proteksi DNS-rebinding penuh. |
| 4 | **Pesan error provider LLM bocor ke klien** | `routes/agents.ts:298`, `server.ts:136-149` | **Med** | agents.ts meneruskan `err.message` mentah ke `DomainError`. Error handler `OpenRouterApiError` meneruskan `parsed.error.message` + **seluruh** `err.body` sebagai `details`. Body error provider bisa memuat URL internal, nama model, org id. | Kirim pesan generik + correlation id ke klien; detail hanya ke log. | ✅ **FIXED** da73632 — pesan generik + `requestId`, detail log-only. |
| 5 | **Tak ada rate-limit di route mahal (LLM/ingest)** | `routes/auth.ts:37` (satu-satunya), `orchestrator/routes.ts:204,271,295,680`, `routes/agents.ts` screen/architect | **Med** | `@fastify/rate-limit` hanya didaftarkan di `/auth/login`. `run-agentic`, `recipe/run`, `loop/run`, `rag/upload_file`, `agents/:id/screen`, `autofill`, `chat/*` memanggil LLM tanpa batas → penyalahgunaan biaya/DoS. | Daftarkan rate-limit dengan budget lebih ketat untuk route LLM/ingest. | ✅ **FIXED** d2e14d3 — rate-limit dipisah per kelas, **semua konfigurabel via env** (default konservatif, keyed per-IP dg `trustProxy:'loopback'`): **GLOBAL** `RATE_LIMIT_GLOBAL_MAX=240 / WINDOW=60_000ms` (loose, polling/read frontend), **LLM** `RATE_LIMIT_LLM_MAX=30 / WINDOW=60_000ms` (ketat, run-agentic/architect/`agents/:id/screen`/rag upload+query), **LOGIN** `RATE_LIMIT_LOGIN_MAX=5 / WINDOW=60_000ms` (paling ketat, anti-brute-force login+register). Global didaftarkan sekali di `server.ts:68`; kelas LLM/login override lewat per-route `config.rateLimit`. |
| 6 | **JWT: alg tak dipin, tak ada aud/iss, tak ada cek revocation** | `middleware/auth.ts:40,42-49` | **Med** | `jwtVerify(token, secret)` tanpa `algorithms`. Jalur JWT set `req.auth` **tanpa** cek service account masih aktif → akun dicabut tetap berlaku sampai token expire; `companyId` diambil dari token tanpa validasi. (jose dgn kunci simetris sudah membatasi ke HMAC, jadi alg-confusion rendah.) | Pin `algorithms:['HS256']`, set+verifikasi `aud`/`iss`, TTL pendek atau daftar revocation. | ✅ **FIXED (partial)** b2c9ffc — alg dipin ke HS256. Residual: aud/iss + revocation belum (aud/iss akan invalidasi token 12h yang aktif → butuh keputusan). |
| 7 | **Anti-replay HMAC tanpa nonce** | `middleware/auth.ts:104-108`, `config/env.ts:73` | **Med** | Hanya cek skew timestamp (`SIGNATURE_MAX_SKEW_SEC`). Request finansial bertanda-tangan yang tertangkap bisa di-replay dalam jendela skew. Mitigasi bergantung idempotensi `completeStep` — yang dicatat masih buggy (memory `completeStep-idempotency`). | Tambah cache nonce/`jti`, atau paksa idempotency-key server-side. | **BACKLOG (nonce)** — mitigasi interim diterapkan: `SIGNATURE_MAX_SKEW_SEC` default **diturunkan 300→60 dtk** (jendela replay 1 mnt, aman krn robot di jaringan bank ber-NTP). Ini **postur sementara yang diterima**; HMAC-nonce tetap di backlog dg alasan di atas. **Pantau setelah rollout:** kalau klien SAH mulai kena `signature-expired`, NAIKKAN nilai env-nya (mis. 90/120), JANGAN diam-diam balik ke 300. |
| 8 | **`trustProxy: true`** | `server.ts:30` | Low | Mempercayai seluruh rantai `X-Forwarded-For`. Bila rate-limit berbasis IP dipakai, `XFF` palsu bisa memintasnya. | Set `trustProxy` ke IP/subnet reverse-proxy on-prem yang diketahui. | ✅ **FIXED** d2e14d3 — `trustProxy: 'loopback'`; app bind 127.0.0.1 di belakang reverse proxy same-host, hanya hop loopback yang boleh set XFF. |
| 9 | **`console.*` melewati redaction pino (S7)** | `mcpAdapters.ts:35,67,93`, `server.ts:212-213`, `env.ts:186`, `db/pool.ts:25`, `telemetry/llmUsage.ts:79` (satu instance di `a2a/client.ts:120` hilang saat file itu dihapus, #4-A2A) | Low | 5 `console.log` + beberapa `console.error` lolos level filtering & redaction pino. (mcpAdapters = proses stdio terpisah; banner server.ts kosmetik.) | Arahkan ke `logger` pino terstruktur (kecuali banner & proses stdio MCP). | OPEN |
| 10 | **`as any` mematikan pengecekan tipe (S6)** | engine.ts (12), server.ts (9), executor.ts (3), tools.ts (2), orchestrator/routes.ts (2), streamHandler.ts (2) (1 di `a2a/client.ts` hilang saat file dihapus, #4-A2A) | Low | Tiap `as any` = satu cek tipe dimatikan. Sebagian batas library (fastify validation `err as any`, `app as any` saat register) wajar; sisanya sebaiknya `unknown`+Zod. | Ganti tipe benar atau `unknown`+validasi; sisakan batas library dengan komentar. | OPEN |
| 11 | **Body UiPath Folders di-log 2000 char** | `orchestrator/routes.ts:618` | Low | Bukan token, tapi struktur folder internal ter-log. | Log ringkasan/hitungan, bukan body mentah. | OPEN |
| 12 | **Endpoint publik shared-agent balikan kolom `tools`** | `routes/featureSharing.ts:201` | Low (verifikasi) | GET `/agent-invoke/shared-agent/:hash` (tanpa auth) mengembalikan `tools`. Pastikan JSONB `tools` tak memuat `env`/secret. | Batasi field publik; jangan sertakan konfigurasi tool sensitif. | OPEN |
| 13 | **Kredensial API disimpan plaintext di DB (`tools.versions[].released.env`/`.args`)** | `db` kolom `tools.versions` (JSONB); dibaca via `routes/tools.ts:10` `maskSecrets()` | **Med** | Baris di tabel `tools` menyimpan kunci API asli (mis. Linear, GitHub PAT, token Supabase) di `released.env`/`released.headers` — plaintext, tanpa enkripsi at-rest. `maskSecrets()` (`routes/tools.ts:10-18`) menyamarkan nilai **saat dibaca lewat API** (bagus, mitigasi jalur baca), tapi penyimpanannya sendiri tidak berubah. Siapa pun dengan akses baca DB langsung — DBA, dump backup, replika DR, atau backup yang tak sengaja terbagi — mendapat kredensial asli, mem-bypass masking aplikasi sepenuhnya. | Opsi ke depan (belum diputuskan): (a) enkripsi kolom `env`/`headers` at-rest (butuh manajemen kunci + migrasi data existing), atau (b) pindahkan kredensial ke secret manager eksternal dan simpan hanya referensi/ID di kolom DB. **Enkripsi TIDAK diimplementasikan sekarang** — perubahan besar (migrasi + rotasi kunci), sengaja ditunda menunggu arahan. | **OPEN — keputusan tertunda.** Mitigasi ada (masking di jalur baca API), enkripsi at-rest belum. Kunci-kunci yang sudah tersimpan plaintext masuk daftar rotasi manual (lihat bagian "Kredensial lokal" / rotasi produksi di bawah — beda kelas: ini kredensial company milik pengguna platform, bukan dev lokal). |

---

## SUDAH AMAN (diperiksa, terbukti benar)

Penting dicantumkan agar jelas ini sudah diperiksa, bukan terlewat.

| Area | Bukti aman |
|---|---|
| **SQL injection** | Semua query berparameter (`$1..$n`). Build kolom dinamis (`a2aTasks.ts:143-152` update keys, `tools.ts:246` fields) memakai **nama kolom tetap** dari kode, nilai tetap parameter — bukan string user. `featureSharing.ts:58` memilih kolom lewat literal ter-guard. |
| **IDOR agents/tools/knowledgeBase/transactions** | Setiap SELECT/UPDATE/DELETE scoped `WHERE … company_id = $` (agents.ts:101,176,229; tools.ts:122,246,268; knowledgeBase.ts:134,157,179; transactions cek `company_id` di :79). |
| **IDOR feature-sharing** | `requireAgentShareAccess` → `canShareResource` (`lib/sharing.ts:28`) menegakkan owner ∨ company-sama ∨ email-editor sebelum mutasi. Otorisasi di kode, bukan SQL — benar. |
| **Bandingkan signature timing-safe** | `crypto.ts:79 safeEqualHex` pakai `timingSafeEqual` + guard panjang & panjang-0. |
| **Penyimpanan secret** | argon2id untuk API key/secret/password (`crypto.ts:23-40`); signing secret disimpan sebagai hash (`getSigningSecretHash` + `verifySecret`), bukan plaintext. |
| **MCP SSE URL (bukan SSRF)** | `engine.ts:463,697` bangun URL dari `mcpHost` (env `MCP_HOST`/config operator) + port dari `mcp_runtime_state` (ditulis process manager) — bukan URL user. |
| **Vision/ingest (bukan SSRF/traversal)** | `visionExtract.ts:13` menerima `Buffer` hasil upload lalu base64 inline; tidak ada fetch URL/path dari user. |
| **UiPath OAuth token log (S4)** | `orchestrator/routes.ts:608` hanya me-log `status`, bukan token/body. (Cf. temuan #11 soal Folders body.) |
| **Batas input** | `bodyLimit` 10MB, multipart `fileSize` 10MB, content-type whitelist → JSON saja (`server.ts:27,53,93`). |
| **CORS** | `config/cors.ts` allowlist eksplisit, tanpa wildcard; `credentials:true` aman karena origin dibatasi. |
| **Security headers** | helmet: CSP, HSTS, frameguard deny, noSniff, hidePoweredBy (`server.ts:75-90`). |
| **Rate-limit → 429 (bukan 500)** | Error handler mempertahankan 429 (`server.ts:153`) — regresi lama sudah diperbaiki (memory `ratelimit-500-bug-fixed`). |
| **errorHandler urutan** | Didaftarkan sebelum route plugin (`server.ts:105`) — bug lama sudah diperbaiki (memory `seterrorhandler-order-bug`). |

---

## Verifikasi pra-merge (B2, B4)

Dua pertanyaan yang sebelumnya menggantung, dijawab terhadap kode nyata.

### B2 — apakah `err.message` ASLI masih masuk log? **YA.**

Perbaikan #4 hanya menggenerik-kan pesan **ke klien**; detail asli tetap
tercatat di log terstruktur, dengan requestId yang sama dengan yang dikirim
ke klien:

- `OpenRouterApiError` (`server.ts:159-166`):
  `req.log.warn({ status: err.status, body: err.body }, err.message)` menulis
  **status + body upstream mentah + `err.message` asli** ke log; klien hanya
  dapat `{ code:'OPENROUTER_API_ERROR', message:'Upstream LLM provider returned
  an error', details:{ requestId: req.id } }`.
- Error tak dikenal (`server.ts:177`): `req.log.error({ err }, 'unhandled
  error')` menulis objek `err` penuh (message + stack); klien dapat pesan
  generik `INTERNAL_ERROR`.

Korelasi: Fastify otomatis menyematkan `reqId: req.id` pada **setiap** baris
`req.log.*`, dan `req.id` itulah yang dikirim ke klien sebagai `requestId`.
Jadi satu id menghubungkan respons klien ↔ baris log. Tidak menukar kebocoran
dengan kebutaan debug.

### B4 — apakah ada tool DB yang mati akibat hardening `--no-install`? **BERISIKO, tapi tidak ada yang saat ini jalan.**

`hardenNpxArgs` menulis-ulang `-y`→`--no-install` di luar `NODE_ENV=development`,
sehingga paket npx harus sudah ter-install lokal. Cek `node_modules` terhadap
`SELECT DISTINCT command,args FROM tools` (15 tool, DB runtime — dump di
`database/tools_rows.sql` sudah basi/8 baris):

| Paket npx (dari `args`) | Ter-install? | Tool | Status DB |
|---|---|---|---|
| `mcp-remote` | ❌ MISSING | Linear Official | Inactive |
| `@modelcontextprotocol/server-github` | ❌ MISSING | Github MCP | Inactive |
| `@modelcontextprotocol/server-gmail` | ❌ MISSING | mcp-gmail | Offline |
| `@modelcontextprotocol/server-google-sheets` | ❌ MISSING | mcp-google-sheets | Offline |
| `@modelcontextprotocol/server-sequential-thinking` | ❌ MISSING | Sequential Thinking | Inactive |
| `linear-mcp-server` | ❌ MISSING | Linear_1 | Inactive |
| `@supabase/mcp-server-supabase@latest` | ❌ MISSING | Supabase MCP v1.0.0 | Inactive |
| `@pegasusheavy/google-mcp` | ❌ MISSING | google-mcp | Inactive |

**SEMUA** paket npx MISSING → di luar dev, tiap tool npx ini akan gagal
resolve paket. **TAPI:** kedelapan-nya ber-status `Inactive`/`Offline`. Tool
yang benar-benar `Online` semuanya berbentuk `node <abs>/build/index.js`
(UiPath/amadeus MCP lokal, tidak butuh install) → **tidak terpengaruh**. Di
`NODE_ENV=development` `-y` dibiarkan, jadi dev juga tidak rusak.

**Rekomendasi sebelum salah satu tool npx diaktifkan di prod:** pilih sadar —
(a) pre-install paketnya sebagai dependency amadeus-core, atau (b) nonaktifkan
tool itu secara eksplisit. Jangan biarkan gagal diam-diam saat diaktifkan.

## Keputusan: Python dihapus dari allowlist (spawn) — permanen

`ALLOWLISTED_COMMANDS` (`src/lib/spawnCompat.ts`) dulu `["npx","node","python",
"python3"]`; kini `["npx","node"]`. `assertSpawnSafe()` sekarang **throw** untuk
`python`/`python3` di ketiga call site spawn.

**Konsekuensi (diterima, bukan kelalaian):** keputusan ini secara **permanen**
menutup pemakaian MCP server berbasis Python (ekosistem **uvx/uv**). Tidak ada
lagi jalur untuk menjalankan tool `python …`/`python3 …` dari `tools`. Trade-off
ini diambil atas aturan CISO absolut "tidak boleh ada Python sama sekali".

**Verifikasi sebelum penghapusan (`SELECT DISTINCT command FROM tools`):** command
token yang benar-benar dipakai = `node`, `npx`, `python`. Satu-satunya baris
python = **`Supabase MCP` v1.1.0**, dengan command
`python C:\Users\…\ponzgen\microservice\mcp_lib\supabase_rag_mcp\app_mcp_rag.py`
— sebuah **path Windows** pada host Linux ini, ber-status `Inactive`. Artinya
tool itu sudah non-fungsional sebelum perubahan; penghapusan python **tidak**
mematikan tool yang benar-benar jalan. (Versi v1.0.0 tool yang sama memakai
`npx @supabase/mcp-server-supabase@latest`, tapi engine memilih versi terakhir
= v1.1.0 python, sehingga tool ini efektif python-only.) Dilaporkan di sini,
sesuai perintah, sebelum merge.

Test: `test/spawnCompat.test.ts` — `assertSpawnSafe('python'|'python3', [])`
harus throw `not allowlisted`.

## Kredensial lokal yang sengaja dibiarkan (keputusan sadar)

Beda kelas dari secret cloud produksi (mis. `client_secret` UiPath, yang
DIROTASI manual di luar branch ini). Tiga ini adalah kredensial **dev lokal**
low-risk, sengaja dipertahankan:

- **`create_db.sh:2`** — `CREATE USER amadeus WITH PASSWORD 'amadeus_local_dev'`.
  Password DB dev lokal untuk onboarding satu-perintah; on-prem/prod memakai
  `DATABASE_URL` dari env (bukan skrip ini). **Diterima.**
- **`scripts/migrate_supabase.ts:11`** — DSN fallback
  `postgres://amadeus:amadeus_local_dev@127.0.0.1:5432/amadeus`, dipakai **hanya
  bila `DATABASE_URL` tidak di-set**. Kredensial dev yang sama, loopback saja.
  **Diterima.**
- **`src/config/env.ts:31`** — hanya string **contoh** di pesan validasi
  (`contoh: postgres://user:pass@host:5432/amadeus`). Bukan kredensial nyata.
  **Aman.**

Bukan didiamkan — ini keputusan tercatat. Kalau kelak dev DB dipromosikan ke
jaringan bersama, ganti password lokal ini dan hapus DSN fallback.

## Prioritas tindakan
1. ✅ **#1 (RCE stdio)** — benar-benar tertutup (path absolut + npx); sempat
   salah-label "fixed", lihat catatan di baris finding #1. **#4 (error leak)** &
   **#6 (JWT alg)** — done. ⚠️ **#2 (backend/.env)** — untracked, **ROTASI +
   scrub history masih manual user**.
2. ✅ **#3 (SSRF)** & **#5 (rate-limit, per-kelas via env)** & **#8 (trustProxy
   'loopback')** — done. **#7 (HMAC nonce)** — backlog; mitigasi interim skew
   300→**60 dtk** diterapkan (branch security ini). **Python** dihapus dari
   allowlist. **A2A** ditunda di balik `A2A_ENABLED` (default off).
3. Tersisa OPEN: #7 (nonce, backlog), #9 (console.*), #10 (`as any`),
   #11 (Folders body log), #12 (shared-agent `tools` field), #13 (kredensial
   tools plaintext at-rest — keputusan enkripsi/secret-manager tertunda).

**Status tsc pra-merge (jujur):** `tsc --noEmit` menyisakan **3 error
pre-existing** yang TIDAK diperkenalkan branch ini dan di luar cakupannya —
`scripts/seedSwiftKbSynthetic.ts:23,24` (2) dan `a2a/agentCard.ts:29` (1, hanya
terpanggil bila `A2A_ENABLED=true`). Semua bertipe `noUncheckedIndexedAccess`
"possibly undefined". Perbaikannya trivial tapi menyentuh file di luar scope;
diserahkan sebagai keputusan (bukan didiamkan). Semua test (29) lulus.

Setiap perbaikan = commit terpisah (aturan H4). Perbaikan keamanan **tidak**
dicampur dengan penghapusan dead code / perubahan struktur.
