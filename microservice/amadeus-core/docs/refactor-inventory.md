# FASE 1 — Inventaris Bukti (Refactor amadeus-core)

> Status: **INVENTARIS SAJA. Belum ada yang dihapus.** Menunggu konfirmasi
> sebelum FASE 2 (hapus) / FASE 3 (duplikat) / FASE 4 (pecah file).
>
> Service: `microservice/amadeus-core` — 71 file `.ts`, ~11.544 baris (src + scripts).

## Metodologi tiga-jalur

Setiap simbol diperiksa dengan tiga metode deteksi sekaligus:

- **M1 — import langsung**: `import { X }` / `import X from`
- **M2 — import namespace**: `import * as NS` lalu pemakaian `NS.X`
- **M3 — referensi tak-statis**: string literal, `import()` dinamis, akses index
  `obj['X']`, registry handler, nama yang muncul di migrasi/config

Sweep otomatis: 220 simbol ter-export dipindai. Mayoritas "zero external ref"
dari sweep adalah **interface/type** yang dipakai secara struktural atau internal —
itu bukan dead code berbahaya, jadi tidak dimasukkan ke daftar hapus. Daftar di
bawah hanya memuat **nilai/fungsi/class runtime** dan temuan arsitektural.

---

## ⚠ KOREKSI terhadap "temuan awal yang sudah diverifikasi" di prompt

Tiga dari temuan pra-verifikasi di prompt **terbukti salah** saat diperiksa tiga-jalur.
Ini justru bukti kenapa aturan H2 ada.

| Klaim prompt | Kenyataan | Bukti |
|---|---|---|
| `watchTask` mati (temuan A) | **LIVE** | `src/orchestrator/a2a/streamHandler.ts:2` `import { watchTask }`, dipanggil di `:24` |
| `linearOrder` tidak dipakai (temuan D) | **LIVE (transitif)** | `stepFlows.ts:107` `stepIndex()` memanggil `linearOrder`; `stepIndex` dipakai `services/transactions.ts:190-192` |
| `quoteCmdArg` "tidak dipakai di luar test" (temuan C) | **LIVE (internal)** | dipakai `spawnCompat.ts:83` di jalur Windows `cmd` dari `resolveSpawnTarget` |

Kalau ketiganya dihapus mengikuti prompt, SSE A2A rusak, ordering step rusak, dan
quoting argumen Windows rusak. **Jangan hapus.**

---

## Tabel simbol — nilai/fungsi runtime

| Simbol | File | Dipakai oleh (M1/M2/M3) | Status |
|---|---|---|---|
| `submitTask` | services/a2aTasks.ts:57 | M2 `rpcHandler.ts:53` (`a2aTasks.submitTask`) | **LIVE** |
| `getTaskWithMessages` | services/a2aTasks.ts:103 | M2 `rpcHandler.ts:79`; internal `watchTask` | **LIVE** |
| `cancelTask` | services/a2aTasks.ts:168 | M2 `rpcHandler.ts:109` | **LIVE** |
| `provideInput` | services/a2aTasks.ts:172 | M2 `rpcHandler.ts:122` | **LIVE** |
| `watchTask` | services/a2aTasks.ts:204 | M1 `streamHandler.ts:2` | **LIVE** |
| `a2aEventEmitter` | services/a2aTasks.ts:10 | internal (`notifyTaskUpdate`, `watchTask`); **tidak** ada M1/M2/M3 eksternal | **LIVE tapi over-exported** → turunkan jadi non-export |
| `markTaskWorking` | services/a2aTasks.ts:177 | tidak ada (M1/M2/M3 nihil) | **SUSPECT-DEAD → lihat Temuan A** |
| `markTaskInputRequired` | services/a2aTasks.ts:181 | tidak ada | **SUSPECT-DEAD → Temuan A** |
| `markTaskFailed` | services/a2aTasks.ts:185 | tidak ada | **SUSPECT-DEAD → Temuan A** |
| `markTaskCompleted` | services/a2aTasks.ts:189 | tidak ada (padahal ia satu-satunya pemicu `computeHandoffAfterTaskCompletion` dari jalur task-DB) | **SUSPECT-DEAD → Temuan A** |
| `A2AClient` (class) | a2a/client.ts:? | tidak ada `new A2AClient` di mana pun | **SUSPECT-DEAD → Temuan A** (bagian dari subsistem v1 yang sama) |
| `aesGcmEncrypt` | lib/crypto.ts:93 | tidak ada; semua import crypto bersifat named & tak menyentuh ini | **SUSPECT-DEAD (Temuan B)** |
| `aesGcmDecrypt` | lib/crypto.ts:102 | tidak ada | **SUSPECT-DEAD (Temuan B)** |
| `runRecipe` | recipes/executor.ts:393 | hanya internal: dipanggil `runRecipeStream` (`executor.ts:528`). Eksternal cuma `runRecipeStream` (`routes.ts:20,288`) | **LIVE tapi over-exported (Temuan E)** → turunkan jadi non-export |
| `quoteCmdArg` | lib/spawnCompat.ts:55 | internal `spawnCompat.ts:83` + test | **LIVE** |
| `resolveSpawnTarget` | lib/spawnCompat.ts:88 | M1 `scripts/mcpAutoManager.ts:13`, dipakai `:351` | **LIVE (Temuan C: sudah tersambung)** |
| `linearOrder` | config/stepFlows.ts:93 | internal `stepIndex` → `transactions.ts` | **LIVE** |

## Entrypoint (BUKAN dead code — dikecualikan)

| Simbol | File | Alasan |
|---|---|---|
| `buildServer` | server.ts:23 | dipanggil `server.ts:215`; export publik untuk test harness | **ENTRYPOINT** |
| `loadEnv` | config/env.ts:177 | dipanggil `config/env.ts:193` (`export const env = loadEnv()`) | **ENTRYPOINT** |
| `main()` scripts/* | scripts/*.ts | CLI entry via `npm run …` | **ENTRYPOINT** |
| MCP server `mcpAdapters.ts` | orchestrator/mcpAdapters.ts | proses stdio terpisah, dispawn oleh manager | **ENTRYPOINT** |

Interface/type ter-export "zero-ref" dari sweep (`StepDef`, `StepFlow`, `TaskRow`,
`FailStepInput`, `PortRange`, dst.) **tidak** masuk daftar hapus: dipakai
struktural / bagian kontrak modul / dikonsumsi via inferensi. Risiko hapus > manfaat.

---

## 🔴 TEMUAN A (diperluas) — bukan sekadar dead code, ini DUA subsistem A2A paralel

Investigasi end-to-end sesuai perintah H2. Ada **dua** implementasi A2A yang hidup
berdampingan:

**Subsistem 1 — envelope (LIVE, jalur produksi sebenarnya):**
- `a2a/protocol.ts` (`A2AEnvelope`, tipe pesan `task.complete` / `task.failed`)
- Ditangani di `engine.ts` (`case 'task.complete'` :175, `:177`), engine sendiri
  yang meng-emit `type:'task.complete'` (`:1114`, `:1380`) → memicu handoff.
- `orchestrator/routes.ts:44` memakai enum envelope ini.
- Robot UiPath/PAD "mengirim `task.complete` via A2A" (lihat komentar di
  `executors/uipathExecutor.ts`, `padExecutor.ts`, `base.ts`).

**Subsistem 2 — task DB + JSON-RPC (SETENGAH TERPASANG):**
- `services/a2aTasks.ts` (tabel `a2a_tasks` + `a2a_task_messages`), `protocol_v1.ts`
  (JSON-RPC `task.submit/get/cancel/provideInput`), `a2a/rpcHandler.ts`,
  `a2a/streamHandler.ts`, `a2a/client.ts`.
- Sisi **klien** hidup: submit / get / cancel / provideInput bisa dipanggil via RPC.
- Sisi **agen MATI**: `markTaskWorking/InputRequired/Failed/Completed` tidak pernah
  dipanggil dari mana pun, dan `A2AClient` tidak pernah di-`new`.

**Konsekuensi nyata:** sebuah task yang di-`submit` lewat subsistem 2 akan
tersangkut di state `submitted` selamanya — tidak ada kode yang memindahkannya ke
`working`/`completed`/`failed`. `markTaskCompleted` adalah satu-satunya jembatan
dari task-DB ke `computeHandoffAfterTaskCompletion`, dan ia tidak pernah dipanggil.

**Keputusan (sesuai prompt: (a) vs (b)):** Ini kasus **(a) state machine belum
selesai** untuk subsistem 2, sementara handoff nyata berjalan lewat subsistem 1
(envelope/engine).

**KEPUTUSAN USER (2026-07-27): SELESAIKAN / SAMBUNGKAN.** `markTask*` + `A2AClient`
**tidak dihapus**. Dicatat sebagai **bug terbuka**: write-side subsistem v1 belum
tersambung ke handler agen, sehingga task yang di-submit lewat JSON-RPC nyangkut di
`submitted`. Rencana penyelesaian (di luar scope refactor ini): sambungkan endpoint/
robot agen ke `markTaskWorking/InputRequired/Failed/Completed` sehingga tabel
`a2a_tasks` benar-benar dipakai dan `computeHandoffAfterTaskCompletion` terpicu dari
jalur task-DB. Sampai itu terjadi, simbol-simbol ini SENGAJA dipertahankan.

---

## Temuan B — `aesGcmEncrypt`/`aesGcmDecrypt` (crypto menganggur)

Benar-benar tak terpakai (M1/M2/M3 nihil). Ini "kripto menganggur" yang berbahaya:
terlihat tersedia, suatu hari dipakai tanpa review. **Aman dihapus** — risiko
rendah, tidak ada kontrak eksternal, tidak ada migrasi/config yang menyebut.
Alternatif bila memang direncanakan: beri komentar alasan + tanggal + pemutus.

## Temuan C — `spawnCompat` (SUDAH tersambung, bukan bug)

Sudah terpasang di `scripts/mcpAutoManager.ts:13,351` (jalur spawn MCP stdio).
`engine.ts` **sengaja** tidak memakainya — ia pakai `StdioClientTransport` dari MCP
SDK yang punya `cross-spawn` sendiri (ada komentar eksplisit di `engine.ts:467-468,
692-693`). Jadi tidak ada bug di sini.

> Catatan kecil untuk FASE 5: `server.ts:252` men-`spawn('tsx', …)` mcpAutoManager
> **tanpa** lewat `resolveSpawnTarget`. Itu jalur dev-only auto-spawn; di Windows
> bisa rapuh, tapi bukan permukaan keamanan. Dicatat, tidak diubah di FASE 1.

## Temuan E — `runRecipe` over-exported → turunkan jadi non-export (aman)

## Temuan F — `loadEnv` / `buildServer` = ENTRYPOINT, jangan sentuh

---

## Ringkasan yang butuh KEPUTUSAN sebelum lanjut

1. **Subsistem A2A v1 (Temuan A)** — selesaikan atau buang? (perubahan besar)
   Rekomendasi: **buang** kalau produksi memang jalan lewat envelope/engine; simpan
   hanya kalau ada rencana konkret memakai tabel `a2a_tasks`. Butuh jawaban user.
2. **Hapus `aesGcmEncrypt`/`aesGcmDecrypt` (B)** — rekomendasi: hapus. Aman.
3. **Turunkan `runRecipe` (E) & `a2aEventEmitter` jadi non-export** — aman, murni internal.

## SENGAJA TIDAK DISENTUH di FASE 1
- Semua interface/type "zero-ref" (kontrak modul / structural typing).
- `watchTask`, `linearOrder`, `quoteCmdArg` (koreksi atas prompt — LIVE).
- `buildServer`, `loadEnv`, script `main()`, `mcpAdapters` (entrypoint).
- Perilaku eksternal, schema DB, kode error (aturan H1).

---

**BERHENTI DI SINI (perintah prompt).** Menunggu konfirmasi. Urutan berikutnya
sesuai prompt: FASE 5 (keamanan) lebih dulu, baru FASE 2/3/6, terakhir FASE 4.
