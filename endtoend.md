# Prompt — End-to-End LC Settlement Demo: 1 Agent, 2 MCP, 9 Steps

## Misi

Buat satu demo end-to-end yang bisa di-screenshot dan dikirim ke leadership:

**Satu agent mengoordinasikan seluruh alur settlement Import LC dari `submitted` sampai `advised`, menggunakan `amadeus-mcp` + `mcp-uipath` sebagai tools, dengan cost-aware routing yang memilih executor termurah per step.**

Ini bukan fitur baru — ini WIRING yang menghubungkan semua komponen yang sudah ada.

## Kondisi yang sudah ada

Baca file-file ini dulu:

| File | Apa isinya |
|---|---|
| `microservice/amadeus-mcp/src/tools/*.ts` | 8 tools amadeus (list, get, create, dispatch, complete, fail, executors, route) |
| `microservice/mcp-uipath/src/index.ts` | 3 tools UiPath real (trigger_job, list_processes, get_job_status) |
| `microservice/transaction_tracker/src/config/stepFlows.ts` | 9 step LC: submitted→distributed_to_analyst→doc_examined→ee_ntf_created→ee_ntf_approved→mt_converted→swift_released→settled→advised |
| `microservice/transaction_tracker/src/orchestrator/executors/executorMap.ts` | Mapping siapa mengerjakan step apa (LLM/PAD/UiPath) |
| `backend/Amadeus/backend/microservice/agent_boilerplate/boilerplate/agent_boilerplate.py` baris 150-195 | Cara boilerplate agent build `mcp_config` dari Supabase tool rows lalu connect via `MultiServerMCPClient` ke `http://localhost:{port}/sse` |

## Yang harus dibangun

### Deliverable 1 — Demo script `scripts/e2e-demo.ts`

**BUAT file baru:** `microservice/transaction_tracker/scripts/e2e-demo.ts`

Script Node.js yang mensimulasikan agent mengoordinasikan 9 step LC **tanpa boilerplate Python** (supaya bisa dijalankan standalone untuk demo). Script ini adalah "agent script" yang memanggil kedua MCP server via HTTP langsung.

```ts
/**
 * End-to-end LC settlement demo.
 *
 * Menunjukkan satu "orchestrator agent" menggerakkan seluruh alur
 * settlement Import LC dari submitted sampai advised, menggunakan
 * amadeus-mcp + mcp-uipath sebagai tools.
 *
 * Jalankan:
 *   1. Start transaction_tracker:  cd transaction_tracker && npm run start
 *   2. Start amadeus-mcp:          cd amadeus-mcp && npm run start
 *   3. Start mcp-uipath:           cd mcp-uipath && npm run start
 *   4. Jalankan demo:              npx tsx scripts/e2e-demo.ts
 *
 * Output: log narasi step-by-step yang bisa di-screenshot.
 */
```

Alur script:

```
STEP 1: Create transaction
  → HTTP POST ke amadeus-mcp tool "create_transaction" { type: "import_lc" }
  → Print: "📋 LC-{shortId} created. Status: in_progress, step: submitted"

STEP 2: Explain routing plan
  → Untuk setiap step di alur LC, call "explain_route" { step, type: "import_lc" }
  → Print tabel:
    Step                    │ Executor              │ Kind   │ Cost
    ────────────────────────┼───────────────────────┼────────┼─────
    distributed_to_analyst  │ executor.pad.distribute│ pad    │ 10
    doc_examined            │ executor.qwen_vl.doc_exam│ llm  │ 3
    ee_ntf_created          │ executor.pad.ee_create │ pad    │ 10
    ee_ntf_approved         │ (manual — checker)     │ —      │ —
    mt_converted            │ executor.uipath.mt     │ uipath │ 100
    swift_released          │ executor.uipath.swift  │ uipath │ 100
    settled                 │ executor.uipath.settle │ uipath │ 100
    advised                 │ executor.pad.advise    │ pad    │ 10

STEP 3-6: Dispatch automatable steps (submitted → ee_ntf_created)
  Loop untuk step: distributed_to_analyst, doc_examined, ee_ntf_created:
    → Call "dispatch_step" { transactionId, idempotencyKey: unique }
    → Print outcome: "✅ Step {step} completed by {executor} (cost: {costUnit})"
    → Atau: "🚀 Step {step} dispatched to {executor} — waiting for robot"
    → Atau: "❌ Step {step} failed: {reason}"
    → Setelah dispatch, call "get_transaction" untuk print current state

STEP 7: Simulate checker approval (ee_ntf_approved)
  → Print: "⏸️  Step ee_ntf_approved requires human checker. Simulating approval..."
  → Call "complete_step" { transactionId, step: "ee_ntf_approved", idempotencyKey }
  → Print: "✅ Checker approved EE/NTF"

STEP 8-10: Financial steps (mt_converted, swift_released, settled)
  Dua mode (tentukan via env `DEMO_MODE`):

  MODE A — `DEMO_MODE=simulate` (default, tanpa UiPath Cloud):
    → Print: "🏦 Financial step {step} — would dispatch to UiPath, simulating..."
    → Call "complete_step" dengan signature { timestamp, secret } dari env
    → Print: "✅ Financial step {step} completed (simulated)"

  MODE B — `DEMO_MODE=live` (dengan UiPath Cloud):
    → Call mcp-uipath tool "list_uipath_processes" → print proses yang tersedia
    → Call mcp-uipath tool "trigger_uipath_job" { releaseKey, arguments: { AmadeusTransactionId, AmadeusStep } }
    → Print: "🚀 UiPath job {jobId} started for step {step}"
    → Poll "get_uipath_job_status" setiap 5 detik, max 60 detik
    → Kalau job Successful: call amadeus-mcp "complete_step" dengan signature
    → Kalau job Failed/timeout: call amadeus-mcp "fail_step"

STEP 11: Last step (advised)
  → Call "dispatch_step" { transactionId, idempotencyKey }
  → Print: "✅ Step advised completed by PAD. LC settlement DONE!"

STEP 12: Final summary
  → Call "get_transaction" → print full timeline
  → Print:
    "═══════════════════════════════════════════════════
     AMADEUS END-TO-END SETTLEMENT DEMO — COMPLETE
     Transaction: {id}
     Type: import_lc
     Total steps: 9
     Total events: {count}
     Executors used:
       LLM (Qwen VL):  1 step  — cost ~3 units
       PAD:             3 steps — cost ~30 units
       UiPath:          3 steps — cost ~300 units
       Manual:          2 steps — cost 0 units
     Total cost: ~333 units
     vs. All-UiPath: ~900 units
     SAVINGS: ~63%
     ═══════════════════════════════════════════════════"
```

**Detail teknis script:**

Komunikasi ke MCP server BUKAN via MCP protocol (terlalu complex untuk demo script). Langsung HTTP ke transaction_tracker API + UiPath API. Script ini meniru apa yang agent LLM akan lakukan, tapi deterministik dan scriptable.

```ts
const AMADEUS_API = process.env.AMADEUS_API_BASE ?? 'http://127.0.0.1:8080';
const AMADEUS_KEY = process.env.AMADEUS_ROBOT_KEY ?? '';
const UIPATH_MCP = process.env.UIPATH_MCP_URL ?? 'http://127.0.0.1:10001';
const DEMO_MODE = process.env.DEMO_MODE ?? 'simulate';
const SIGNING_SECRET = process.env.AMADEUS_SIGNING_SECRET ?? '';
```

Pakai `fetch` builtin Node 20+. HMAC signature compute pakai `node:crypto` (copy pattern dari `transaction_tracker/src/lib/crypto.ts`).

Untuk setiap API call, print:
```
[08:15:03] 🔧 POST /transactions → 201
[08:15:03] 📋 Created LC abc12345 (step: submitted)
```

Error handling: kalau API call gagal, print error tapi **lanjut ke step berikutnya** dengan catatan `[SKIPPED]`. Demo harus bisa jalan sampai selesai walaupun ada step yang gagal.

### Deliverable 2 — Agent system prompt untuk boilerplate

**BUAT file baru:** `microservice/transaction_tracker/docs/orchestrator_agent_prompt.md`

System prompt yang bisa di-paste ke agent config di UI `/agent-creator` atau Supabase `agents` table:

```markdown
# Amadeus Settlement Orchestrator Agent

Kamu adalah orchestrator agent untuk settlement Import LC/SKBDN/SBLC di Bank Mandiri.

## Tools yang kamu punya

### amadeus-mcp (port 10002)
- `list_transactions` — lihat transaksi aktif
- `get_transaction` — detail + timeline handoff
- `create_transaction` — buat transaksi baru
- `dispatch_step` — AKSI UTAMA: jalankan step saat ini via executor termurah
- `complete_step` — tandai step selesai (untuk robot yang lapor balik)
- `fail_step` — tandai step gagal
- `list_executors` — lihat executor tersedia + biaya
- `explain_route` — preview siapa yang akan mengerjakan step

### mcp-uipath (port 10001)
- `trigger_uipath_job` — jalankan proses UiPath
- `list_uipath_processes` — daftar proses tersedia
- `get_uipath_job_status` — cek status job

## Alur kerja kamu

1. Saat diminta memproses LC baru:
   a. Panggil `create_transaction` dengan type yang sesuai
   b. Panggil `explain_route` untuk setiap step — jelaskan rencana ke user
   c. Panggil `dispatch_step` berulang untuk memajukan transaksi

2. Untuk step yang butuh UiPath (mt_converted, swift_released, settled):
   a. `dispatch_step` akan return outcome "dispatched"
   b. Panggil `trigger_uipath_job` dengan releaseKey yang sesuai
   c. Monitor dengan `get_uipath_job_status` sampai selesai
   d. Panggil `complete_step` dengan signature untuk menyelesaikan

3. Untuk step ee_ntf_approved (checker manusia):
   a. Beri tahu user bahwa step ini butuh approval manusia
   b. Tunggu konfirmasi dari user
   c. Panggil `complete_step` setelah user konfirmasi

4. Selalu jelaskan biaya:
   - LLM (Qwen VL): ~3 cost units per step
   - PAD: ~10 cost units per step
   - UiPath: ~100 cost units per step
   - Bandingkan dengan skenario all-UiPath

## Aturan
- JANGAN skip step — ikuti urutan state machine
- Financial steps (mt_converted, swift_released, settled) WAJIB signature
- Selalu panggil `get_transaction` setelah step selesai untuk konfirmasi
- Kalau step gagal, jelaskan alasan dan tawarkan retry
```

### Deliverable 3 — Register agent di Supabase (via UI)

**BUAT file baru:** `microservice/transaction_tracker/docs/demo_setup_guide.md`

Panduan langkah-demi-langkah untuk setup demo:

```markdown
# Amadeus E2E Demo Setup Guide

## Prerequisite
- Node.js 20+
- PostgreSQL 16 (lokal atau Docker)
- (Opsional) UiPath Automation Cloud account

## Step 1: Start Transaction Tracker
cd microservice/transaction_tracker
cp .env.example .env
# Edit .env: isi DATABASE_URL, SIGNATURE_PEPPER
npm install
npm run build
docker compose up -d postgres  # atau pakai Postgres existing
npm run migrate:up
npm run start
# → Running di :8080

## Step 2: Register robot service account
cd microservice/transaction_tracker
npx tsx scripts/registerRobot.ts --name demo-agent --types import_lc,skbdn,sblc
# → Catat API key dan signing secret yang muncul SEKALI

## Step 3: Start Amadeus MCP
cd microservice/amadeus-mcp
cp .env.example .env
# Edit .env: isi AMADEUS_ROBOT_KEY dari step 2
npm install && npm run build
npm run start
# → SSE di :10002/sse

## Step 4: Start UiPath MCP
cd microservice/mcp-uipath
cp .env.example .env
# Edit .env: isi UIPATH_CLIENT_ID, SECRET, ORG, TENANT, FOLDER_ID
npm install && npm run build
npm run start
# → SSE di :10001/sse

## Step 5: Verify via MCP Inspector
# Terminal baru:
npx @modelcontextprotocol/inspector http://localhost:10002/sse
# → Harus lihat 8 tools amadeus
npx @modelcontextprotocol/inspector http://localhost:10001/sse
# → Harus lihat 3 tools UiPath

## Step 6: Run E2E demo (simulate mode)
cd microservice/transaction_tracker
AMADEUS_API_BASE=http://127.0.0.1:8080 \
AMADEUS_ROBOT_KEY=<dari step 2> \
AMADEUS_SIGNING_SECRET=<dari step 2> \
DEMO_MODE=simulate \
npx tsx scripts/e2e-demo.ts
# → 9 step LC jalan, print narasi + tabel biaya

## Step 7: Run E2E demo (live UiPath mode)
# Sama seperti step 6, tapi:
DEMO_MODE=live \
UIPATH_MCP_URL=http://127.0.0.1:10001 \
npx tsx scripts/e2e-demo.ts
# → Step finansial benar-benar trigger UiPath Cloud

## Step 8: Register di boilerplate agent (opsional)
# Buka http://localhost:3000/tools
# Klik "Add Tool" → isi:
#   Name: amadeus-mcp
#   Port: 10002
#   Method: sse
# Klik "Add Tool" → isi:
#   Name: mcp-uipath
#   Port: 10001
#   Method: sse
#
# Buka http://localhost:3000/agent-creator
# Paste system prompt dari docs/orchestrator_agent_prompt.md
# Assign tools: amadeus-mcp, mcp-uipath
# Save agent
#
# Buka http://localhost:3000/agent-invoke
# Pilih agent yang baru dibuat
# Ketik: "Process a new import LC"
# → Agent akan menjalankan alur 9 step via tools
```

### Deliverable 4 — UBAH `microservice/frontend/src/app/dashboard/page.tsx`

Tambah **"Demo" button** yang link ke panduan atau langsung ke agent-invoke dengan pre-filled agent.

**Cari** section utama di dashboard page. **Tambah** card:

```tsx
<GlassCard>
  <h3>🚀 E2E Settlement Demo</h3>
  <p>Run a full Import LC settlement from submitted to advised</p>
  <div className="flex gap-2 mt-3">
    <a href="/agent-invoke?agent=orchestrator" className="btn-primary">
      Run via Agent
    </a>
    <a href="/docs" className="btn-secondary">
      Setup Guide
    </a>
  </div>
</GlassCard>
```

Style: ikuti pattern `GlassCard` yang sudah ada di `microservice/frontend/src/components/`.

### Deliverable 5 — UBAH `microservice/frontend/src/app/agent-creator/page.tsx`

**Cari** array `EXAMPLES` (baris 19-23). **Tambah** satu preset:

```ts
{
  icon: Landmark,  // import dari lucide-react
  label: "LC Settlement Orchestrator",
  text: "Create an orchestrator agent that coordinates Import LC settlement across 9 steps using amadeus-mcp and mcp-uipath tools. It should use cost-aware routing (LLM for doc examination, PAD for simple CRUD, UiPath for financial steps) and provide real-time status updates."
},
```

## Constraint

1. **Script e2e-demo.ts** harus jalan standalone — tanpa Python, tanpa Supabase, tanpa boilerplate agent. Cukup 3 service: transaction_tracker + amadeus-mcp + mcp-uipath.
2. **DEMO_MODE=simulate** harus bisa jalan TANPA UiPath Cloud credential. Financial steps di-simulate via `complete_step` langsung.
3. **DEMO_MODE=live** trigger UiPath Cloud asli via `mcp-uipath` HTTP endpoint (bukan MCP protocol — langsung REST ke UiPath API dari script).
4. **Output narasi harus bisa di-screenshot** — pakai emoji, alignment rapi, print cost summary di akhir.
5. **Semua perubahan frontend** ikuti style existing (GlassCard, Tailwind, lucide icons).
6. **TypeScript strict** di semua file baru.

## Urutan kerja

1. BACA `stepFlows.ts` + `executorMap.ts` — pahami mapping step → executor + cost
2. BUAT `scripts/e2e-demo.ts` — mulai dari skeleton (create → dispatch loop → summary)
3. Test `e2e-demo.ts` simulate mode — HARUS jalan end-to-end tanpa error
4. BUAT `docs/orchestrator_agent_prompt.md`
5. BUAT `docs/demo_setup_guide.md`
6. UBAH `dashboard/page.tsx` — tambah demo card
7. UBAH `agent-creator/page.tsx` — tambah LC Orchestrator preset
8. (Opsional) Test live mode kalau UiPath credential tersedia

## Deliverable checklist

- [ ] `microservice/transaction_tracker/scripts/e2e-demo.ts` — 200-300 baris, self-contained
- [ ] `microservice/transaction_tracker/docs/orchestrator_agent_prompt.md`
- [ ] `microservice/transaction_tracker/docs/demo_setup_guide.md`
- [ ] `microservice/frontend/src/app/dashboard/page.tsx` — diubah, tambah demo card
- [ ] `microservice/frontend/src/app/agent-creator/page.tsx` — diubah, tambah preset
- [ ] Demo simulate mode jalan tanpa error dari terminal
- [ ] Output narasi rapi + cost summary yang bisa di-screenshot

Mulai dari langkah 1. Kalau ada blocker, tanya duluan.


Benar. Arsitekturnya sudah didesain persis untuk itu sejak awal. Bukan roadmap — foundationnya sudah ada di kode.

## Cara kerjanya (yang sudah ada)

Semua tiga jenis executor berbicara ke **satu state tracker yang sama** lewat **kontrak yang sama**:

```
Step ee_ntf_created  →  PAD robot selesai  →  POST /a2a { task.complete }
Step doc_examined    →  Qwen VL selesai    →  completeStep() internal
Step mt_converted    →  UiPath robot selesai → POST /a2a { task.complete }
```

State tracker tidak peduli **siapa** yang menyelesaikan step. Dia cuma cek: apakah step valid? apakah idempotency key baru? apakah signature ada (kalau finansial)? Kalau ya, state maju. Kalau tidak, reject.

Ini berarti kamu bisa campur dalam **satu transaksi yang sama**:

```
LC-2026-001:
  submitted              → manusia (Contact Point)
  distributed_to_analyst → PAD robot (cost: 10)
  doc_examined           → Amadeus agent Qwen VL (cost: 3)
  ee_ntf_created         → PAD robot (cost: 10)
  ee_ntf_approved        → manusia (checker)
  mt_converted           → UiPath robot (cost: 100)
  swift_released         → UiPath robot (cost: 100)
  settled                → UiPath robot (cost: 100)
  advised                → PAD robot (cost: 10)
```

Dan kalau suatu hari PAD sudah bisa handle `mt_converted` (misalnya sistem MT converter-nya punya web UI yang bisa di-automate tanpa legacy integration), kamu cukup ubah **satu baris env**:

```bash
EXECUTOR_PREFERENCES="mt_converted=executor.pad.mt_convert"
```

Restart. Selesai. Step yang tadinya 100 unit jadi 10 unit. Nol perubahan kode.

## Yang perlu ditambah untuk PAD (belum ada, tapi gampang)

`mcp-uipath` sudah real (OAuth2 + StartJobs). Untuk PAD, kamu butuh equivalent-nya: **`mcp-pad`** — MCP server yang trigger Power Automate Desktop flow via HTTP.

Begitu tim-mu konfirmasi metode dispatch PAD (Power Automate cloud flow HTTP trigger paling umum), kamu bikin `microservice/mcp-pad/` dengan pola persis sama seperti `mcp-uipath` — cuma ganti endpoint OAuth ke Microsoft Entra dan endpoint trigger ke Power Automate API. Tiga tools: `trigger_pad_flow`, `list_pad_flows`, `get_pad_run_status`.

Setelah itu agent orchestrator punya **3 MCP**: amadeus + uipath + pad. Dia bisa dalam satu percakapan bilang:

> *"Step distributed_to_analyst — aku pakai PAD karena lebih murah. [panggil mcp-pad: trigger_pad_flow]. Done. Sekarang doc_examined — aku scan sendiri pakai Qwen VL. [panggil amadeus-mcp: dispatch_step]. Done. Sekarang mt_converted — ini finansial, harus UiPath. [panggil mcp-uipath: trigger_uipath_job]. Menunggu robot..."*

Itu percakapan satu agent yang mengoordinasikan tiga jenis robot. Itulah misi agentic-mu.

Fokus sekarang: jalankan e2e demo prompt yang barusan. Begitu itu jalan, PAD tinggal plug in.