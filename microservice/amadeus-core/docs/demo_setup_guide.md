# Amadeus E2E Demo Setup Guide

## Prerequisite
- Node.js 20+
- PostgreSQL 16 reachable at `DATABASE_URL` (lokal atau Docker — repo ini tidak
  menyediakan `docker-compose.yml`, jadi siapkan Postgres sendiri lalu isi
  `DATABASE_URL` di `.env`)
- (Opsional) UiPath Automation Cloud account — hanya untuk `DEMO_MODE=live`

## Step 1: Start Transaction Tracker
```bash
cd microservice/transaction_tracker
cp .env.example .env
# Edit .env: isi DATABASE_URL, SIGNATURE_PEPPER (boleh string acak apa saja
# min 16 char — hanya harus SAMA PERSIS dengan AMADEUS_SIGNATURE_PEPPER yang
# nanti dipakai amadeus-mcp/e2e-demo, kalau kamu set salah satu)
npm install
npm run build
npm run migrate:up
npm run start
# → Running di :8080 — cek dengan: curl http://127.0.0.1:8080/health
```

## Step 2: Register robot service account
```bash
cd microservice/transaction_tracker
npx tsx scripts/registerRobot.ts --name demo-agent --company <UUID company> \
    --types import_lc,skbdn,sblc --financial
# → Catat X-Robot-Key dan Signing-Secret yang muncul SEKALI (tidak akan
#   ditampilkan lagi, tidak disimpan plaintext). --financial WAJIB kalau mau
#   men-demo-kan step finansial (mt_converted/swift_released/settled).
```
`<UUID company>` harus ada di tabel `companies`. Untuk dev lokal, cek data
seed yang ada (`SELECT id FROM companies;`) atau buat satu dulu.

## Step 3: Start Amadeus MCP
```bash
cd microservice/amadeus-mcp
cp .env.example .env
# Edit .env: isi AMADEUS_ROBOT_KEY dari Step 2.
# Isi juga AMADEUS_SIGNATURE_PEPPER SAMA PERSIS dengan SIGNATURE_PEPPER
# tracker (lihat .env.example — WAJIB kalau tracker set SIGNATURE_PEPPER,
# kalau tidak, financial step tidak akan pernah lolos verifikasi HMAC).
npm install && npm run build
npm run start
# → SSE di :10002/sse
```

## Step 4: Start UiPath MCP (opsional, hanya untuk live mode)
```bash
cd microservice/mcp-uipath
cp .env.example .env
# Edit .env: isi UIPATH_CLIENT_ID, SECRET, ORG, TENANT, FOLDER_ID
# (lihat README.md di folder ini untuk cara dapat credential UiPath)
npm install && npm run build
npm run start
# → SSE di :10001/sse
```

## Step 5: Verify via MCP Inspector
```bash
# Terminal baru:
npx @modelcontextprotocol/inspector --cli http://localhost:10002/sse --transport sse --method tools/list
# → Harus lihat 8 tools amadeus
npx @modelcontextprotocol/inspector --cli http://localhost:10001/sse --transport sse --method tools/list
# → Harus lihat 3 tools UiPath
```

## Step 6: Run E2E demo (simulate mode)
```bash
cd microservice/transaction_tracker
AMADEUS_API_BASE=http://127.0.0.1:8080 \
AMADEUS_ROBOT_KEY=<X-Robot-Key dari Step 2> \
AMADEUS_SIGNING_SECRET=<Signing-Secret dari Step 2> \
AMADEUS_SIGNATURE_PEPPER=<sama dengan SIGNATURE_PEPPER tracker, kalau di-set> \
DEMO_MODE=simulate \
npx tsx scripts/e2e-demo.ts
# → 9 step LC jalan, print narasi + tabel biaya + summary
```
`e2e-demo.ts` bicara langsung ke REST API transaction_tracker (bukan MCP
protocol — lebih sederhana untuk script demo yang deterministik). amadeus-mcp
di Step 3 dipakai untuk agent asli (via boilerplate/Inspector), bukan oleh
script demo ini.

## Step 7: Run E2E demo (live UiPath mode)
```bash
# Sama seperti Step 6, tapi tambahkan:
DEMO_MODE=live \
UIPATH_BASE_URL=https://cloud.uipath.com \
UIPATH_ORG=<org slug> \
UIPATH_TENANT=<tenant slug> \
UIPATH_CLIENT_ID=<client id> \
UIPATH_CLIENT_SECRET=<client secret> \
UIPATH_FOLDER_ID=<folder id> \
UIPATH_RELEASE_MAP="mt_converted=<releaseKey>;swift_released=<releaseKey>;settled=<releaseKey>" \
npx tsx scripts/e2e-demo.ts
# → Step finansial benar-benar trigger UiPath Cloud (REST langsung ke
#   Orchestrator API, bukan lewat mcp-uipath server) dan poll job status
#   tiap 5 detik sampai 60 detik.
```

## Step 8: Register di boilerplate agent (opsional)
```
Buka http://localhost:3000/tools
Klik "Add Tool" → isi:
  Name: amadeus-mcp
  Port: 10002
  Method: sse
Klik "Add Tool" → isi:
  Name: mcp-uipath
  Port: 10001
  Method: sse

Buka http://localhost:3000/agent-creator
Klik preset "LC Settlement Orchestrator" (atau paste system prompt dari
docs/orchestrator_agent_prompt.md secara manual)
Assign tools: amadeus-mcp, mcp-uipath
Save agent

Buka http://localhost:3000/dashboard/amadeus
Klik "🚀 E2E Settlement Demo" → "Run via Agent" (link ke /agent-invoke)
Pilih agent yang baru dibuat di dropdown
Ketik: "Process a new import LC"
→ Agent akan menjalankan alur 9 step via tools
```

## Troubleshooting yang ditemukan waktu verifikasi

- **`dispatch_step` gagal `NO_EXECUTOR` di step `submitted`**: `submitted`
  (Contact Point intake) dan `ee_ntf_approved` (checker) TIDAK punya executor
  otomatis — keduanya harus di-`complete_step` langsung (bukan `dispatch_step`)
  untuk mewakili aksi manusia. `e2e-demo.ts` sudah menangani ini.
- **`Kredensial tidak valid` walau X-Robot-Key benar**: biasanya ada proses
  MCP server lama yang masih memegang port dengan env stale — matikan semua
  proses `node .../build/index.js` di port terkait sebelum restart, jangan
  cuma `pkill` dengan pattern yang bisa ke-match proses lain juga.
  `.env` di-load Node via `--env-file=.env` hanya SEKALI saat proses start;
  edit `.env` tidak berlaku untuk proses yang sudah berjalan.
- **Financial step selalu `SIGNATURE_REQUIRED` walau signature dikirim**:
  cek apakah tracker set `SIGNATURE_PEPPER`. Kalau ya, HMAC key di client
  HARUS `${secret}:${pepper}`, bukan `secret` saja — lihat
  `AMADEUS_SIGNATURE_PEPPER` di amadeus-mcp/.env.example.
- **`.env` values dengan karakter `#`**: Node `--env-file` memperlakukan `#`
  sebagai awal komentar bahkan di tengah value — selalu bungkus value yang
  mengandung `#`, spasi, atau simbol lain dengan tanda kutip ganda.
