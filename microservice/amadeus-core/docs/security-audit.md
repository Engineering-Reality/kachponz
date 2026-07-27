# FASE 5 — Audit Keamanan Backend (amadeus-core)

> Scope: `microservice/amadeus-core`. Tanggal: 2026-07-27.
> Metodologi: baca jalur auth end-to-end, telusuri tiap `fetch()`/`spawn()`,
> tiap route yang menerima `id`, tiap titik error→klien, tiap secret.
> **Belum ada kode yang diubah** — ini laporan. Severity = dampak nyata.

Ringkasan: **2 High, 5 Medium, 5 Low.** Bagian "SUDAH AMAN" di bawah sama
pentingnya — menunjukkan apa yang sudah diperiksa dan terbukti benar.

---

## Tabel temuan

| # | Temuan | file:baris | Sev | Bukti | Perbaikan | Status |
|---|---|---|---|---|---|---|
| 1 | **RCE terautentikasi via stdio MCP tool** | `orchestrator/engine.ts:471`, `routes/tools.ts:40,51` | **High** | `/tools` menyimpan `command: z.string().min(1)` + `args: z.array(z.string())` tanpa allowlist. Saat tool stdio dijalankan, `engine.ts` memanggil `StdioClientTransport({ command: release.command, args: release.args })` **langsung** — melewati `ALLOWLISTED_COMMANDS` (`npx/node/python/python3`) di `spawnCompat.ts`. `shell:false` menahan injeksi metachar shell, TAPI bukan eksekusi biner arbitrer: `command:"/bin/sh"` atau `node -e "…"` = eksekusi kode di host orchestrator. Robot/user satu company bisa naik dari "kelola tool company sendiri" → RCE di host bersama. | Validasi `command` terhadap allowlist di `toolWriteSchema` (reuse `ALLOWLISTED_COMMANDS`), DAN/ATAU routekan jalur stdio engine lewat `resolveSpawnTarget()` yang sudah punya allowlist. Pertimbangkan tolak args gaya `-e/-p/--eval` untuk node. | ✅ **FIXED** 5fd1e9c — `assertSpawnSafe` di-enforce di engine stdio + `/tools` write. (Residual: allowlist masih izinkan absolute path & `node -e`; catat.) |
| 2 | **`backend/.env` ter-commit ke git** | repo root `backend/.env` (via `git ls-files`) | **High** | `git ls-files \| grep .env` → `backend/.env` terlacak sejak initial commit dengan kredensial **nyata** (SUPABASE_KEY, JWT_SECRET, HF_TOKEN, MAIAROUTER_API_KEY, OPENROUTER_API_KEY). | `git rm --cached` + rotasi + scrub history. | ⚠️ **PARTIAL** 12da348 — untracked. **ROTASI + scrub history masih tugas manual user** (secret masih ada di history). |
| 3 | **SSRF terautentikasi + refleksi respons (UiPath folders test)** | `orchestrator/routes.ts:589,597,614,617-620` | **Med** | `baseUrl: z.string().url().default(...)` — URL valid tapi host tidak dibatasi. Server `fetch(`${baseUrl}/identity_/connect/token`)` lalu memantulkan body upstream ke klien (`tokenText.slice(0,300)` di 502, `folders` di 200). Penyerang terautentikasi bisa mengarahkan ke `http://169.254.169.254/…` / service internal dan membaca respons. | Allowlist host / cek IP bukan link-local. Jangan pantulkan body upstream. | ✅ **FIXED** 0397314 + d2e14d3 — body upstream log-only; `UIPATH_ALLOWED_HOSTS` (env) meng-allowlist host eksak, fallback ke blokir loopback/link-local/metadata (RFC1918 diizinkan utk on-prem) saat env kosong. Residual: bukan proteksi DNS-rebinding penuh. |
| 4 | **Pesan error provider LLM bocor ke klien** | `routes/agents.ts:298`, `server.ts:136-149` | **Med** | agents.ts meneruskan `err.message` mentah ke `DomainError`. Error handler `OpenRouterApiError` meneruskan `parsed.error.message` + **seluruh** `err.body` sebagai `details`. Body error provider bisa memuat URL internal, nama model, org id. | Kirim pesan generik + correlation id ke klien; detail hanya ke log. | ✅ **FIXED** da73632 — pesan generik + `requestId`, detail log-only. |
| 5 | **Tak ada rate-limit di route mahal (LLM/ingest)** | `routes/auth.ts:37` (satu-satunya), `orchestrator/routes.ts:204,271,295,680`, `routes/agents.ts` screen/architect | **Med** | `@fastify/rate-limit` hanya didaftarkan di `/auth/login`. `run-agentic`, `recipe/run`, `loop/run`, `rag/upload_file`, `agents/:id/screen`, `autofill`, `chat/*` memanggil LLM tanpa batas → penyalahgunaan biaya/DoS. | Daftarkan rate-limit dengan budget lebih ketat untuk route LLM/ingest. | ✅ **FIXED** d2e14d3 — rate-limit dipisah per kelas via env: global loose (polling/read), `RATE_LIMIT_LLM_*` ketat utk run-agentic/architect/`agents/:id/screen`/rag upload+query, `RATE_LIMIT_LOGIN_*` paling ketat per-IP utk login+register. |
| 6 | **JWT: alg tak dipin, tak ada aud/iss, tak ada cek revocation** | `middleware/auth.ts:40,42-49` | **Med** | `jwtVerify(token, secret)` tanpa `algorithms`. Jalur JWT set `req.auth` **tanpa** cek service account masih aktif → akun dicabut tetap berlaku sampai token expire; `companyId` diambil dari token tanpa validasi. (jose dgn kunci simetris sudah membatasi ke HMAC, jadi alg-confusion rendah.) | Pin `algorithms:['HS256']`, set+verifikasi `aud`/`iss`, TTL pendek atau daftar revocation. | ✅ **FIXED (partial)** b2c9ffc — alg dipin ke HS256. Residual: aud/iss + revocation belum (aud/iss akan invalidasi token 12h yang aktif → butuh keputusan). |
| 7 | **Anti-replay HMAC tanpa nonce** | `middleware/auth.ts:104-108` | **Med** | Hanya cek skew timestamp (`SIGNATURE_MAX_SKEW_SEC`). Request finansial bertanda-tangan yang tertangkap bisa di-replay dalam jendela skew. Mitigasi bergantung idempotensi `completeStep` — yang dicatat masih buggy (memory `completeStep-idempotency`). | Tambah cache nonce/`jti`, atau paksa idempotency-key server-side. | OPEN — **skew saat ini default 300 dtk (5 mnt)**, jendela replay "menit-an" → per keputusan review naikkan prioritas (atau perketat default ke ≤60 dtk sbg mitigasi murah sblm nonce). |
| 8 | **`trustProxy: true`** | `server.ts:30` | Low | Mempercayai seluruh rantai `X-Forwarded-For`. Bila rate-limit berbasis IP dipakai, `XFF` palsu bisa memintasnya. | Set `trustProxy` ke IP/subnet reverse-proxy on-prem yang diketahui. | ✅ **FIXED** d2e14d3 — `trustProxy: 'loopback'`; app bind 127.0.0.1 di belakang reverse proxy same-host, hanya hop loopback yang boleh set XFF. |
| 9 | **`console.*` melewati redaction pino (S7)** | `mcpAdapters.ts:35,67,93`, `server.ts:212-213`, `env.ts:186`, `db/pool.ts:25`, `a2a/client.ts:120`, `telemetry/llmUsage.ts:79` | Low | 5 `console.log` + beberapa `console.error` lolos level filtering & redaction pino. (mcpAdapters = proses stdio terpisah; banner server.ts kosmetik.) | Arahkan ke `logger` pino terstruktur (kecuali banner & proses stdio MCP). | OPEN |
| 10 | **`as any` mematikan pengecekan tipe (S6)** | engine.ts (12), server.ts (9), executor.ts (3), tools.ts (2), orchestrator/routes.ts (2), streamHandler.ts (2), a2a/client.ts (1) | Low | Tiap `as any` = satu cek tipe dimatikan. Sebagian batas library (fastify validation `err as any`, `app as any` saat register) wajar; sisanya sebaiknya `unknown`+Zod. | Ganti tipe benar atau `unknown`+validasi; sisakan batas library dengan komentar. | OPEN |
| 11 | **Body UiPath Folders di-log 2000 char** | `orchestrator/routes.ts:618` | Low | Bukan token, tapi struktur folder internal ter-log. | Log ringkasan/hitungan, bukan body mentah. | OPEN |
| 12 | **Endpoint publik shared-agent balikan kolom `tools`** | `routes/featureSharing.ts:201` | Low (verifikasi) | GET `/agent-invoke/shared-agent/:hash` (tanpa auth) mengembalikan `tools`. Pastikan JSONB `tools` tak memuat `env`/secret. | Batasi field publik; jangan sertakan konfigurasi tool sensitif. | OPEN |

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

## Prioritas tindakan
1. ✅ **#1 (RCE stdio)** & **#4 (error leak)** & **#6 (JWT alg)** — done.
   ⚠️ **#2 (backend/.env)** — untracked, **ROTASI + scrub history masih manual user**.
2. ✅ **#3 (SSRF)** & **#5 (rate-limit)** & **#8 (trustProxy)** — done (commit d2e14d3).
3. Tersisa OPEN: **#7 (HMAC nonce — skew 5 mnt, naikkan prioritas)**, #9 (console.*),
   #10 (`as any`), #11 (Folders body log), #12 (shared-agent `tools` field).

Setiap perbaikan = commit terpisah (aturan H4). Perbaikan keamanan **tidak**
dicampur dengan penghapusan dead code / perubahan struktur.
