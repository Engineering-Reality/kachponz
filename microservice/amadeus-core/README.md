# Amadeus Orchestrator

Transaction State Tracker + Agent-to-Agent (A2A) orchestrator untuk alur
settlement **Import LC/SKBDN/SBLC** Bank Mandiri. Menggantikan handoff email
manual antar robot RPA & agent dengan "papan skor" status transaksi yang
authoritative, idempoten, dan CISO-aligned.

**Constraint kunci**: tanpa Python (diblok CISO), PostgreSQL on-prem (bukan
Supabase/cloud), TypeScript/Node, wajib di belakang reverse proxy TLS, registrasi
robot lewat CLI (bukan endpoint).

## Arsitektur (3 layer, satu codebase)

- **Layer 1 — State Tracker** (`src/services/transactions.ts`): state machine
  data-driven (`src/config/stepFlows.ts`), optimistic locking, idempotency,
  audit trail append-only (immutable via trigger DB), dual auth.
- **Layer 2 — A2A Coordination** (`src/orchestrator/`): envelope handoff antar
  agent, dibangun di atas Layer 1 sebagai wasit.
- **Layer 3 — Agent + Sandbox** (`src/orchestrator/agents/`, `scripts/agentSandbox.ts`):
  abstraksi agent (RPA deterministik / agentic), CLI sandbox, slot LLM air-gapped.

## Quickstart

```bash
cp .env.example .env
# Pastikan Postgres on-prem sudah berjalan dan sesuaikan DATABASE_URL di .env
npm install
npm run migrate:up                     # buat skema
npm run robot:register -- --name test-robot --company 11111111-1111-1111-1111-111111111111
npm run dev                            # start server (tsx watch)
curl http://127.0.0.1:8080/health      # 200 + status DB
```

## Endpoint

| Method | Path | Auth | Fungsi |
|--------|------|------|--------|
| GET | `/health` | – | liveness + status DB |
| POST | `/transactions` | robot | buat transaksi |
| POST | `/transactions/:id/steps/:step/complete` | robot (+sig utk finansial) | selesaikan step |
| GET | `/transactions/:id` | robot | detail + histori event |
| GET | `/transactions?status=&type=&limit=` | robot | list terfilter |
| POST | `/a2a` | robot | pesan A2A (handoff) |
| POST | `/orchestrator/run-agentic` | robot | jalankan agent agentic in-process |
| GET | `/orchestrator/agents` | robot | daftar agent |

## Testing

```bash
npm run test        # 20 test: state transition, idempotency, optimistic lock,
                    # financial gate, immutability, auth, company isolation
```

Butuh Postgres on-prem dengan `DATABASE_URL` di-set di file `.env`.

## Dokumen

- `docs/deployment.md` — reverse proxy TLS, node pin, onboarding robot.
- `docs/uipath_integration.md` — HTTP Request activity + credential asset + signature.
- `docs/a2a_protocol.md` — desain protokol A2A.
- `docs/security_compliance.md` — pemetaan lengkap 4 Lampiran CISO → implementasi.

## Catatan keamanan

- Auth dual: `X-Robot-Key` (argon2) untuk internal + HMAC-SHA512 signature
  (anti-replay) untuk step finansial.
- Semua query parameterized (anti-SQLi). Secret di-hash, tak pernah plaintext.
- Error handler tak pernah bocorkan stack trace. Security header via helmet.
- Lihat `docs/security_compliance.md` untuk peta kontrol per requirement.
