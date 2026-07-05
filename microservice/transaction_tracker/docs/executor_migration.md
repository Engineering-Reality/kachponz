# Executor Migration Playbook

Amadeus adalah **meta-orchestrator**: setiap step di alur settlement bisa
dieksekusi oleh salah satu dari tiga jenis executor:

| Kind    | Estimasi biaya | Kekuatan | Kelemahan |
|---------|----------------|----------|-----------|
| `llm`   | Termurah (~$0.001–0.01/run) | Fleksibel, agentic, bagus untuk step "cognitive" (baca dokumen, klasifikasi, ekstraksi) | Tidak deterministik; butuh review manusia untuk step kritis; audit trail perlu payload lengkap |
| `pad`   | Murah (Windows/M365 license saja) | Cukup untuk step CRUD/form-filling sederhana di aplikasi Windows/browser | Kapabilitas terbatas dibanding UiPath; scheduling attended kadang perlu |
| `uipath`| Mahal (per-runtime license) | Enterprise-grade, sudah teruji untuk integrasi sistem legacy (SAA, MT converter, EE) | Cost tinggi; over-engineered untuk step sederhana |

## Prinsip cost-reduction

**Setiap step yang bisa dipindahkan ke executor yang lebih murah TANPA
mengorbankan compliance atau reliabilitas = penghematan langsung.**

Tujuan proyek RPA optimization (49-55% license reduction) tercapai lewat
mekanisme ini, bukan lewat re-negosiasi vendor semata.

## Cara memindahkan step antar executor

**Tidak perlu menyentuh kode aplikasi.** Cukup 3 hal:

### 1. Pastikan executor tujuan terdaftar di `executorMap.ts`

Contoh: mau pindah `ee_ntf_created` dari UiPath ke PAD.

```ts
// src/orchestrator/executors/executorMap.ts
executorRegistry.register(
  makePadExecutor({
    id: 'executor.pad.ee_create',
    displayName: 'PAD — Create EE/NTF Entry',
    step: 'ee_ntf_created',
    types: ['import_lc', 'skbdn', 'sblc'],
    financial: false,
    flowName: 'Amadeus.EE.CreateNTF', // nama flow PAD di infra kalian
  }),
);
```

### 2. Set preference agar router memilih PAD

Bisa via env (**tidak perlu redeploy** — cukup restart):

```bash
EXECUTOR_PREFERENCES="ee_ntf_created=executor.pad.ee_create"
```

Format: `step[:type]=executor_id[,fallback_id];step2=...`

Bila multi-step:
```bash
EXECUTOR_PREFERENCES="ee_ntf_created=executor.pad.ee_create;distributed_to_analyst=executor.pad.distribute"
```

### 3. Verifikasi via endpoint introspeksi

```bash
curl -H "X-Robot-Key: $KEY" \
  "http://amadeus.local:8080/orchestrator/route?step=ee_ntf_created&type=import_lc"
```

Response:
```json
{
  "chosen": { "id": "executor.pad.ee_create", "kind": "pad", "costUnit": 10 },
  "reason": "preferred",
  "alternatives": [
    { "id": "executor.uipath.ee_create", "kind": "uipath", "costUnit": 100 }
  ]
}
```

## Decision tree: kapan pakai apa

```
Step baru masuk backlog
       │
       ▼
┌─────────────────────────────────────────┐
│ Apakah step ini FINANSIAL                │
│ (menyentuh MT/SWIFT/settlement)?          │
└─────────────────────────────────────────┘
       │
       ├── YA ─────▶ UiPath.
       │            Alasan: audit, MT converter legacy, SAA integration,
       │            SLA banking-grade sudah tervalidasi vendor.
       │            (Jangan LLM/PAD tanpa review arsitektur mendalam)
       │
       └── TIDAK
            │
            ▼
┌─────────────────────────────────────────┐
│ Apakah step ini butuh reasoning /        │
│ ekstraksi dari dokumen / klasifikasi?    │
└─────────────────────────────────────────┘
            │
            ├── YA ─────▶ LLM (Qwen VL/text).
            │            Contoh: doc_examined, klasifikasi tipe LC,
            │            deteksi discrepancy dokumen.
            │
            └── TIDAK
                 │
                 ▼
┌─────────────────────────────────────────┐
│ Apakah step ini CRUD sederhana:          │
│ form-filling, klik-klik-simpan, kirim    │
│ email/notif, download file?              │
└─────────────────────────────────────────┘
                 │
                 ├── YA ─────▶ PAD.
                 │            Contoh: distributed_to_analyst,
                 │            ee_ntf_created, advised (KOPRA notify).
                 │
                 └── TIDAK ──▶ UiPath (default fallback).
```

## Bagaimana step "diselesaikan" oleh masing-masing executor

Ini penting untuk memahami mengapa **state tracker tetap source of truth**
apapun executor-nya:

### LLM (in-process)
```
POST /orchestrator/dispatch  →  LLM run() SYNC  →  outcome: 'completed'
                             →  engine langsung panggil completeStep
                             →  state tracker maju
```

### PAD / UiPath (external, async)
```
POST /orchestrator/dispatch  →  dispatch job ke robot  →  outcome: 'dispatched'
                             →  state tracker BELUM maju
       ...(robot bekerja)...
       ...(robot selesai)...
Robot   POST /a2a { type: task.complete, step: ... }
                             →  engine panggil completeStep
                             →  state tracker maju
```

**Konsekuensi penting**: PAD/UiPath workflow **WAJIB** memanggil `/a2a`
dengan `task.complete` (atau `/transactions/:id/steps/:step/complete`) saat
selesai. Tanpa itu, state tracker tidak akan maju walaupun robot sudah
menyelesaikan pekerjaannya di sistem eksternal.

## Testing sebelum go-live

Sebelum memindahkan step production dari UiPath ke PAD/LLM:

1. **Jalankan side-by-side** — set preference ke executor lama, tapi test
   executor baru dengan `POST /orchestrator/dispatch` di transaksi test.
2. **Bandingkan hasil** — ambil 100 transaksi selama seminggu, jalankan di
   kedua executor, cek delta hasil.
3. **Cek SLA & failure rate** — LLM mungkin lebih cepat tapi failure rate
   berbeda. Ukur ini.
4. **Baru switch preference production** — dengan monitoring ketat 2 minggu
   pertama. Rollback sekali klik (edit env).

## Roadmap hardening executor

1. **Watcher timeout** — bila outcome `dispatched` tidak diikuti `task.complete`
   dalam SLA, otomatis alarm + retry lewat executor lain.
2. **Circuit breaker per-executor** — bila executor X gagal N kali dalam window,
   auto-fallback ke alternatif.
3. **A/B routing** — 10% traffic ke LLM, 90% ke UiPath, ukur perbedaan.
4. **Cost dashboard** — hitung actual spend per executor per bulan berdasar
   `costUnit × invocation count`, tampilkan di ops console.
