# Prompt untuk Claude Code — Lanjutan Amadeus Orchestrator

> Salin isi file ini sebagai prompt awal saat membuka Claude Code di direktori
> `amadeus-orchestrator/`. Ini memberi Claude Code konteks penuh + daftar tugas
> lanjutan yang sudah terprioritas.

---

## Konteks proyek

Kamu melanjutkan **Amadeus Orchestrator**: service backend (TypeScript/Node +
Fastify + PostgreSQL) untuk mengorkestrasi alur settlement Import LC/SKBDN/SBLC
di Bank Mandiri, menggantikan handoff email manual antar robot RPA (UiPath/PAD)
& agent agentic.

**Constraint keras (jangan dilanggar):**
- **TIDAK boleh Python** sama sekali (diblok CISO), termasuk transitif.
- **PostgreSQL on-prem** (bukan Supabase/cloud). Koneksi via `pg`.
- **TypeScript/Node** (Fastify + Zod + Vitest). Node LTS 20/22.
- Service **wajib di belakang reverse proxy TLS**; app bind `127.0.0.1`.
- Registrasi robot **lewat CLI** (`npm run robot:register`), bukan endpoint.
- Semua kontrol keamanan mengacu 4 Lampiran CISO — lihat `docs/security_compliance.md`.

**Yang SUDAH jadi & lolos test (20/20):**
- Layer 1 State Tracker: `stepFlows.ts` (state machine data-driven), `transactions.ts`
  (create/complete dengan optimistic lock + idempotency + financial gate),
  audit trail append-only (immutable via trigger DB), env fail-fast, Pino logging.
- Dual auth: `X-Robot-Key` (argon2) + HMAC-SHA512 signature (anti-replay) untuk
  step finansial (`src/middleware/auth.ts`, `src/lib/crypto.ts`).
- Layer 2 A2A: envelope + handoff engine (`src/orchestrator/engine.ts`, `a2a/protocol.ts`).
- Layer 3: registry agent + 1 contoh agentic (`docExamAgent`), sandbox CLI.
- Postgres, migration, semua endpoint, docs, compliance mapping.

**Arsitektur**: baca `README.md` + `docs/a2a_protocol.md` dulu.

## Cara verifikasi cepat (lakukan pertama)

```bash
npm install
# Pastikan Postgres on-prem yang sudah ada berjalan
npm run migrate:up
npm run test                       # harus 20 passed
npm run typecheck                  # harus bersih
```

Jika test hijau, fondasi sehat. Baru lanjut ke tugas di bawah.

## Tugas lanjutan (urut prioritas — kerjakan satu per satu, test tiap selesai)

### P1 — Event kegagalan formal + retry/kompensasi
Saat ini `task.failed` di `engine.ts` hanya nge-log. Tambahkan:
- Kolom/enum status event `failed` (migration baru, JANGAN ubah migration lama).
- `completeStep` varian `failStep` yang menulis event `failed` (tetap append-only,
  tidak memajukan `current_step`), dengan `reason` wajib.
- Test: gagal lalu retry dengan idempotency key baru berhasil.

### P2 — Transisi mundur/koreksi dengan reason
Flow `import_lc` saat ini linear. Tambahkan dukungan transisi mundur eksplisit
(mis. `doc_examined` → kembali ke `distributed_to_analyst` untuk revisi) di
`stepFlows.ts` sebagai edge terpisah, dan pastikan `completeStep` mewajibkan
`reason` (kode `REASON_REQUIRED` sudah ada). Test kasus mundur.

### P3 — OpenAPI/Swagger (CISO API #18)
Tambah `@fastify/swagger` + `@fastify/swagger-ui`, generate dari schema Zod yang
sudah ada (pakai `fastify-type-provider-zod`). Endpoint `/docs`.

### P4 — Agentic agent nyata (air-gapped LLM/VLM)
Isi slot TODO di `src/orchestrator/agents/docExamAgent.ts`. Konteks air-gapped:
integrasikan ke server inferensi on-prem (mis. model lokal via HTTP internal).
Untuk agentic framework, gunakan **LangGraph.js / LlamaIndex.TS** (TypeScript,
bukan Python). Buat abstraksi tipis supaya model bisa di-swap.
JANGAN memanggil API cloud eksternal (air-gapped).

### P5 — Hardening auth ke OAuth2 (CISO API #1,#3,#11)
Bila gateway bank mewajibkan: tambah OAuth2 client-credentials + JWT sebagai
layer di atas/ganti `X-Robot-Key`. Simpan sebagai strategi auth pluggable di
`src/middleware/auth.ts`. Pertahankan `X-Robot-Key` untuk backward-compat internal.

### P6 — Skala service account
`findActiveAccountByApiKey` saat ini scan-then-verify (aman utk puluhan/ratusan
robot). Untuk ribuan: tambah kolom lookup non-rahasia (prefix key ter-index),
persempit kandidat, baru verify hash penuh. Lihat komentar di
`src/services/serviceAccounts.ts`.

## Aturan kerja
- Tiap perubahan: `npm run typecheck && npm run test` harus hijau sebelum lanjut.
- JANGAN tambahkan dependency Python atau tooling yang menjalankan interpreter Python.
- JANGAN hardcode secret/connection string (env only; lihat `src/config/env.ts`).
- Semua query DB HARUS parameterized (anti-SQLi). Tidak ada string interpolation ke SQL.
- Pertahankan `transaction_events` append-only (jangan bikin path UPDATE/DELETE).
- Update `docs/security_compliance.md` bila menutup item roadmap.
- Migration baru = file baru bertimestamp; JANGAN edit `1700000000000_init.ts`.
