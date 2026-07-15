# Security Compliance Mapping — Amadeus Orchestrator

Dokumen ini memetakan tiap kontrol keamanan dari **empat Lampiran Security
Requirement CISO Bank Mandiri** ke lokasi implementasinya di codebase, atau
menandainya *out-of-scope* (dengan alasan: menjadi tanggung jawab reverse
proxy / infrastruktur / proses organisasi, bukan kode aplikasi).

Status:
- ✅ **Implemented** — ada di kode, bisa ditunjuk file-nya.
- 🟡 **Partial / roadmap** — fondasi ada, penuh butuh kerja lanjutan (ditandai).
- 🔵 **Infra / Proxy** — di luar kode aplikasi; dipenuhi reverse proxy TLS,
  SIEM/IAM/PAM, atau konfigurasi server on-prem.
- 📋 **Proses / Dokumen** — dipenuhi lewat prosedur/dokumen (TSD, review berkala),
  bukan kode.

> Catatan cakupan: MVP ini adalah **service backend antar-mesin** (robot & agent),
> bukan aplikasi ber-UI untuk user manusia. Karena itu banyak kontrol
> "Pengelolaan User & Password" (login manusia, session 5 menit, indikator
> kekuatan password, SSO) **tidak berlaku langsung** ke service ini dan
> ditandai 🔵/📋 — kontrol setara untuk mesin diterapkan lewat *service account*.

---

## 1. Lampiran — API Security (20 requirement)

| # | Area | Status | Implementasi / Catatan |
|---|------|--------|------------------------|
| 1 | Authentication (OAuth2/Bearer) | 🟡 | MVP pakai `X-Robot-Key` (argon2-hash, `src/middleware/auth.ts`). OAuth2 client-credentials = roadmap; lihat §Roadmap. |
| 2 | 2FA signature utk API finansial | ✅ | Layer signature HMAC-SHA512 + anti-replay timestamp untuk step finansial (`verifyFinancialSignature`, `src/lib/crypto.ts`). Gate ditegakkan di `completeStep` (`SIGNATURE_REQUIRED`). |
| 3 | Authorization (OAuth2/Bearer) | 🟡 | Otorisasi per-robot via `allowed_types` + `company_id` isolation. Bearer/OAuth2 = roadmap. |
| 4 | Whitelist HTTP Method | ✅ | Hanya route eksplisit terdaftar (Fastify); method lain → 404. Content-type parser menolak non-JSON (`src/server.ts`). |
| 5 | Content-Type header benar | ✅ | `addContentTypeParser` memaksa `application/json` (415 bila bukan). |
| 6 | X-Content-Type-Options nosniff | ✅ | `@fastify/helmet` `noSniff` (`src/server.ts`). |
| 7 | X-Frame-Options | ✅ | helmet `frameguard: deny`. |
| 8 | Access Control ISO 10181-3 | 🟡 | Initiator=service account, Target=transaksi, AEF=middleware auth, ADF=`completeStep` policy. Terstruktur tapi belum formal-mapped. |
| 9 | TLS 1.3 (fallback 1.2 + cipher list) | 🔵 | **Reverse proxy** (Nginx/Traefik on-prem). Wajib; lihat `deployment.md`. App bind localhost. |
| 10 | Enkripsi data (SHA256withRSA / HMAC_SHA512 / AES-256) | ✅ | HMAC-SHA512 & AES-256-GCM tersedia (`src/lib/crypto.ts`). RSA-signature = roadmap bila dibutuhkan. |
| 11 | JWT | 🟡 | Belum; roadmap bila pindah ke OAuth2/Bearer. |
| 12 | WS-Security | 🔵 | N/A untuk REST/JSON internal; tidak dipakai. |
| 13 | Integrasi SIEM | 🔵 | Structured JSON log (Pino) siap di-forward ke SIEM oleh infra (`src/lib/logger.ts`). Shipping = infra. |
| 14 | SFTP utk file stream | 🔵 | N/A untuk MVP (tidak ada transfer file); infra bila diperlukan. |
| 15 | HTTP status semantik | ✅ | Error handler + DomainError memetakan status akurat (`src/server.ts`, `src/types/domain.ts`). |
| 16 | Hosting standards (ISO27001/PCI-DSS/SWIFT/ISO20022) | 📋 | Proses/hosting on-prem. Kode selaras ISO20022 di domain step (mt_converted/swift_released). |
| 17 | Security Assessment sebelum prod | 📋 | Proses (SAST/VA/pentest). Kode: 0 npm audit vuln, strict typecheck. |
| 18 | Failover: WSDL/RAML/Swagger | 🟡 | Kontrak endpoint terdokumentasi (`docs/api.md`); OpenAPI/Swagger gen = roadmap mudah (Fastify swagger plugin). |
| 19 | UTF-8 (khusus SNAP) | ✅ | DB & app UTF-8 end-to-end; N/A SNAP tapi terpenuhi. |
| 20 | Encode karakter unik `< > " ' % ( ) & +` | ✅ | Input divalidasi ketat via Zod regex (slug charset), JSON di-escape otomatis. Tidak ada interpolasi string ke SQL/HTML. |

---

## 2. Lampiran — Code Security Review (45 requirement)

### Validasi Input (#1–16)
| # | Status | Implementasi |
|---|--------|--------------|
| 1 Rutin validasi terpusat | ✅ | `src/routes/schemas.ts` (Zod) — satu pintu. |
| 2 Gagal validasi → tolak input | ✅ | Zod `.parse()` throw → 400 `VALIDATION_ERROR`. |
| 3 Validasi tiap input (URL, header) | ✅ | Params/query/body semua ber-schema; header auth divalidasi. |
| 4 Header hanya ASCII | 🟡 | Key/signature header dibatasi charset di verifikasi; enforcement ASCII penuh = tambah guard (roadmap kecil). |
| 5 Validasi redirect | 🔵 | Tidak ada redirect di API ini (N/A). |
| 6 Validasi tipe data | ✅ | Zod typed schema. |
| 7 Validasi range | ✅ | `limit` min/max, timestamp skew window. |
| 8 Validasi client & server | ✅ | Server-side penuh (robot = client mesin). |
| 9 Validasi length | ✅ | `min/max` di semua string schema. |
| 10 Encode karakter unik | ✅ | Slug regex menolak `< > " ' %` dsb sejak input. |
| 11 Null byte (%00) | ✅ | Regex `^[a-z0-9_]+$` / charset menolak %00. |
| 12 Newline (%0d %0a \r \n) | ✅ | Ditolak charset slug/idem-key. |
| 13 Dot-dot-slash (../) | ✅ | Ditolak charset; tak ada path dari input. |
| 14 Validasi file upload | 🔵 | Tidak ada upload di MVP (N/A). |
| 15 Sanitasi data ke log | ✅ | Pino `redact` menyensor secret; input tervalidasi sebelum dilog. |
| 16 "no suggestion" field | 🔵 | UI concern (N/A untuk API mesin). |

### Otentikasi & Manajemen Password (#17–23)
| # | Status | Implementasi |
|---|--------|--------------|
| 17 Encode output berbahaya | ✅ | Response JSON; tidak render HTML. |
| 18 Respon auth gagal tanpa info bocor | ✅ | Pesan generik "Kredensial tidak valid" (`auth.ts`). |
| 19 POST utk credential | ✅ | Key via header pada POST; tak pernah di query string. |
| 20 Credential ke service luar dienkripsi | ✅ | Signing secret di-hash argon2; transport TLS (proxy). |
| 21 Kompleksitas password | ✅ | API key/secret = 32-byte random (entropi ≫ aturan password manusia). |
| 22 Nonaktif akun stlh gagal login | 🟡 | `is_active` + CLI disable ada; auto-lockout after N fails = roadmap. |
| 23 Session baru stlh login | 🔵 | Stateless (tanpa session cookie); N/A. |

### Secure Coding (#24–45)
| # | Status | Implementasi |
|---|--------|--------------|
| 24 Session id tak di URL/log | ✅ | Stateless; tak ada session id. |
| 25/26 Cookie secure/HttpOnly | 🔵 | Tak pakai cookie (N/A). |
| 27 Tak ada stack trace ke klien | ✅ | Error handler generik (`src/server.ts`). |
| 28 Pesan error umum | ✅ | `INTERNAL_ERROR` generik. |
| 29 Log kegagalan validasi | ✅ | `req.log.warn` pada Zod fail. |
| 30 AES-256, bukan RC4/MD5, no insecure RNG | ✅ | AES-256-GCM + `crypto.randomBytes` (`src/lib/crypto.ts`). |
| 31 Tak expose OS/versi framework | ✅ | helmet `hidePoweredBy`. |
| 32 Error tak bocor detail sistem | ✅ | DomainError terkontrol. |
| 33 Security header (XSS/CSP/HSTS/X-Frame) | ✅ | helmet full set. |
| 34 Tak simpan password/conn-string plaintext | ✅ | Argon2 hash; conn-string dari env, di-redact di log. |
| 35 Source code tak mengandung credential | ✅ | `.env` di gitignore; `.env.example` tanpa secret nyata. |
| 36 Tak ada param sensitif di GET | ✅ | GET hanya filter non-sensitif; key via header. |
| 37 Autocomplete off | 🔵 | UI concern (N/A). |
| 38 Directory listing off | ✅ | Fastify tak serve static; 404 default. |
| 39 Prepared statement (anti-SQLi) | ✅ | **Semua** query parameterized (`src/db/pool.ts`, services). Nol string-interpolation. |
| 40 Connection string tak di source | ✅ | Hanya dari env, divalidasi Zod (`src/config/env.ts`). |
| 41 Penutupan connection string | ✅ | Pool + `withTransaction` release di `finally`. |
| 42 Validasi file upload | 🔵 | N/A (tak ada upload). |
| 43 Validasi redirect | 🔵 | N/A. |
| 44 Tutup resource (connection/handle) | ✅ | `finally { client.release() }` (`src/db/pool.ts`). |
| 45 Secure coding pihak ketiga | 📋 | Proses (bila outsourcing). |

---

## 3. Lampiran — Aplikasi TI (109 req) & 4. BASE24 (64 req)

Keduanya mayoritas kontrol **aplikasi ber-UI untuk user manusia** dan
**infrastruktur bank**. Yang **relevan & sudah diimplementasi** untuk service
mesin ini:

| Area CISO | Req | Status | Implementasi |
|-----------|-----|--------|--------------|
| Service Account unik | APP_TI #30 | ✅ | `service_accounts.robot_name` unik (partial index aktif). |
| Service Account non-interaktif | #31 | ✅ | Hanya dipakai mesin via API key; tak ada login interaktif. |
| Service Account dapat dinonaktifkan | #32 | ✅ | `is_active=false` + `disabled_at`; CLI/SQL. |
| Auth service account by secret | #33 | ✅ | `X-Robot-Key` argon2-verify. |
| Kompleksitas & rotasi secret | #34 | 🟡 | 32-byte random (memenuhi entropi); rotasi berkala = re-register (roadmap: expiry field). |
| Review periodik service account | #35 | 📋 | Proses; data (`created_at`, `is_active`) mendukung audit. |
| Disable bila disalahgunakan | #36 | ✅ | `is_active=false`; evidence = proses. |
| Kripto lindungi auth (simpan+transit) | #37 | ✅ | Argon2 at-rest + TLS in-transit. |
| Ganti secret | #38 | ✅ | Re-register / update hash. |
| Least privilege | #39 | ✅ | `allowed_types` per robot; company isolation. |
| Bukan many-to-one | #40 | ✅ | Satu robot = satu service account = satu company. |
| Audit trail (event, actor, timestamp, integritas) | #76–104 | ✅ | `transaction_events` append-only + trigger immutability; actor & timestamp tiap event. |
| Time stamp pembayaran/settlement | #67 | ✅ | `created_at` timestamptz tiap event finansial. |
| Kripto data tersimpan | #68–70 | ✅ | AES-256-GCM tersedia utk payload sensitif; secret hashed. |
| Kontrol akses interface (anti-anonim) | #57 | ✅ | Semua endpoint transaksi butuh auth. |
| Mutual auth antar-sistem kriptografis | #58,59 | 🟡 | Signature layer = pembuktian secret; mTLS penuh = infra/roadmap. |
| Availability: quota/limit resource | #73 | ✅ | `bodyLimit` 1MB, statement_timeout, pool max. |
| SIEM/IAM/PAM/AD/Antivirus | #64 | 🔵 | Infra; log siap-SIEM. |
| DR plan teruji | #72 | 📋 | Proses infra; Postgres on-prem + migration reproducible. |

**Kontrol yang 🔵/📋 by design** (bukan gap kode): login manusia & session
5 menit, indikator kekuatan password, SSO/IDM portal, MFA user manusia,
report dashboard user, remote access approval — semua ini milik lapisan
aplikasi ber-UI/IAM, bukan service antar-mesin ini.

---

## Roadmap hardening (urut prioritas)

1. **OAuth2 client-credentials + JWT** menggantikan/melengkapi `X-Robot-Key`
   (API #1,#3,#11) — bila gateway API bank mewajibkan.
2. **mTLS** antar service (APP_TI #58–59) di layer proxy/service mesh.
3. **Auto-lockout** service account setelah N gagal auth (Code #22).
4. **Secret expiry & rotasi otomatis** (`expires_at` di `service_accounts`).
5. **OpenAPI/Swagger** generation (API #18).
6. **Event `failed` formal** + retry/compensation di orchestrator.
7. **Lookup-key non-rahasia** untuk skala ribuan service account tanpa
   scan-verify (lihat `src/services/serviceAccounts.ts`).
