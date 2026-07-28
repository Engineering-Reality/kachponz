# PROMPT — Status MCP yang Jujur + Smoke Test Seluruh Endpoint

Untuk `microservice/amadeus-core` dan `microservice/frontend`. Temuan di bawah **sudah diverifikasi** terhadap snapshot v19. Tempel ke Claude Code.

---

> ## ⚠️ KOREKSI (2026-07-28) — BACA DULU SEBELUM PERCAYA A1
> Premis **A1 di bawah SALAH** terhadap kode nyata di branch
> `security/amadeus-core-hardening`. A1 mengklaim "tidak ada yang pernah
> menulis status 'running'/'starting'" dan "satu-satunya penulis adalah
> `routes.ts:488`". Itu keliru karena grep hanya mencari `INSERT`/`UPDATE`
> literal ke nama tabel, sedangkan **semua tulisan siklus hidup lewat fungsi
> Postgres** (`fn_reserve_mcp_port`, `fn_release_mcp_runtime`), bukan SQL
> inline. Kenyataannya `scripts/mcpAutoManager.ts` sudah menulis siklus penuh:
> `starting` (pra-spawn) → `running` (setelah TCP liveness terbukti) →
> `crashed`+last_error → `stopped` (idle/obsolete), plus rekonsiliasi stale row
> saat boot. `routes.ts:488` cuma escape-hatch restart manual.
>
> Konsekuensi status pekerjaan (per 2026-07-28):
> - **A1 & sebagian besar A3: SUDAH ADA.** Jangan ditulis ulang.
> - **A4: sebagian besar selesai** — `method` dan `status` sudah jadi dua field
>   terpisah; hanya fallback string `'stdio (spawned on demand)'` yang jadi
>   wart. **Sudah diperbaiki** di commit unit A2+A4+B.
> - **A2: bukan "hardcoded Online".** `on_status` adalah toggle enablement
>   (dibaca daemon), bukan liveness; status live sudah dari `/mcp/status`.
>   Sisa isu = badge daftar pakai toggle sbg proksi. **Sudah diperbaiki.**
> - **B (enum kontrak): DIKERJAKAN** — `src/types/mcpStatus.ts` (BE, sumber
>   kebenaran) + `frontend/src/lib/mcpStatus.ts` (salinan sinkron) + drift
>   guard `test/mcpStatusContract.test.ts`.
> - **Belum dikerjakan:** A3 re-probe periodik proses milik-daemon (item 3),
>   C smoke test (item 4), D2 dedup StdioClientTransport.
>
> Sisa dokumen di bawah dipertahankan apa adanya sebagai jejak; jangan
> perlakukan A1 sebagai fakta.

---

```text
KONTEKS
Keluhan: status tool MCP di UI tidak mencerminkan kenyataan — tidak ketahuan
mana yang benar-benar online dan mana yang mati.

Review menemukan penyebabnya, dan ini bukan bug kecil di satu tempat:
statusnya memang tidak pernah ditulis oleh siapa pun.

=========================================================================
A — AKAR MASALAH (verifikasi dulu, lalu perbaiki)

A1. TIDAK ADA YANG PERNAH MENULIS STATUS "RUNNING"
    Pencarian menyeluruh (multi-baris, seluruh src + scripts) menemukan
    HANYA SATU penulis ke tabel mcp_runtime_state:

      src/orchestrator/routes.ts:488
      UPDATE mcp_runtime_state SET status = 'stopped', pid = NULL, ...

    Tidak ada satu pun INSERT atau UPDATE yang menulis 'starting' atau
    'running'. Artinya:
      - scripts/mcpAutoManager.ts men-spawn proses tetapi tidak pernah
        mencatatnya sebagai hidup (ia hanya MEMBACA tabel itu di baris 79
        dan 457)
      - GET /orchestrator/mcp/status melakukan LEFT JOIN ke tabel yang tidak
        pernah menerima status positif, jadi selalu jatuh ke default
      - kolom pid, port, started_at praktis tidak pernah terisi untuk proses
        yang benar-benar berjalan

    Verifikasi sendiri sebelum memperbaiki, lalu perbaiki:
      - mcpAutoManager WAJIB menulis siklus hidup lengkap:
        'starting' saat spawn -> 'running' saat port terbukti listening ->
        'stopped' saat exit normal -> 'crashed' + last_error saat exit tidak
        normal, termasuk saat idle-stop (baris ~604) dan saat menghentikan
        proses obsolete (baris ~583)
      - tulis pid, port, started_at, updated_at sungguhan
      - saat manager start, rekonsiliasi dulu: baris apa pun yang berstatus
        'running' dari sesi sebelumnya tetapi pid-nya sudah tidak ada harus
        diubah jadi 'stopped' (stale state setelah restart/crash)

A2. FRONTEND MENAMPILKAN "Online" SEBAGAI DEFAULT HARDCODED
    frontend/src/app/(protected)/tools/page.tsx baris 43, 78, 184:
      on_status: tool.on_status || "Online"
    Jadi tool yang mati pun tampil "Online". Ini bukan status, ini hiasan.

    Perbaiki:
      - hapus default "Online". Status HARUS berasal dari
        GET /orchestrator/mcp/status, bukan dari nilai tersimpan di baris tool
      - bedakan dengan jelas: unknown (belum ada data) vs stopped vs running
        vs crashed. "Belum tahu" bukan "online"
      - tampilkan kapan status terakhir diperbarui (updated_at), supaya
        pengguna tahu datanya basi atau tidak
      - kalau ada last_error, tampilkan (potong panjangnya, jangan
        membocorkan detail internal)

A3. TIDAK ADA VERIFIKASI LIVENESS
    Status berbasis "kami pernah men-spawn" bukan "prosesnya masih hidup".
    Proses bisa mati tanpa ada yang tahu.
    Tambahkan liveness ringan pada satu loop periodik di mcpAutoManager:
      - tool SSE: cek pid masih ada (process.kill(pid, 0)) DAN portnya masih
        menerima koneksi. Keduanya, karena pid bisa hidup tapi port sudah
        tidak listening
      - tool stdio: TIDAK ADA proses persisten — jangan tampilkan
        running/stopped seolah-olah ada. Statusnya harus kategori tersendiri
        (mis. 'on-demand'), plus waktu pemakaian terakhir bila tersedia
    Simpan hasil cek terakhir beserta timestamp-nya. Jangan lakukan cek
    liveness di dalam request handler — itu membuat halaman UI lambat dan
    bergantung pada waktu.

A4. STDIO vs SSE HARUS JUJUR DI UI
    Endpoint sekarang mengembalikan string 'stdio (spawned on demand)'
    sebagai status. Itu mencampur dua konsep berbeda (metode transport dan
    status hidup) ke satu field.
    Pisahkan: `method` (stdio | sse) dan `status` (running | stopped |
    crashed | on-demand | unknown) sebagai dua field terpisah, dan biarkan
    UI yang merangkainya. Jangan bangun kalimat untuk UI di dalam SQL.

=========================================================================
B — KONTRAK STATUS (sepakati dulu sebelum menulis kode)

Definisikan enum status yang eksplisit, satu sumber, dipakai BE dan FE:

  running     proses hidup DAN port terverifikasi listening (khusus sse)
  starting    sudah di-spawn, port belum terbukti listening
  stopped     dihentikan dengan sengaja
  crashed     keluar tanpa diminta; last_error terisi
  on-demand   tool stdio; tidak ada proses persisten
  unknown     belum pernah ada data, atau data lebih tua dari ambang basi

Tulis di satu tempat (mis. src/types/mcpStatus.ts) dan ekspor tipenya.
Frontend mengimpor tipe yang sama, jangan mendefinisikan ulang string-nya.

=========================================================================
C — SMOKE TEST SELURUH ENDPOINT (40 endpoint unik)

Buat satu skrip pengujian yang menembak SETIAP endpoint dan melaporkan
hasilnya sebagai tabel. Tujuannya menemukan endpoint yang rusak, bukan
mengejar cakupan.

Untuk tiap endpoint, uji minimal:
  1. tanpa auth              -> harus 401/403, bukan 500, bukan 200
  2. auth valid, input valid -> 2xx, dan bentuk response cocok dengan schema
                                 Zod-nya
  3. auth valid, input cacat -> 4xx dengan pesan tervalidasi, bukan 500
  4. id yang tidak ada       -> 404, bukan 500
  5. id milik akun lain      -> 403/404 (uji IDOR), bukan 200

Keluarkan tabel: method | path | skenario | expected | actual | PASS/FAIL.
Setiap FAIL disertai potongan response dan lokasi kodenya.

Perhatian khusus pada kelompok berikut karena paling berisiko:
  - /a2a/* dan /.well-known/amadeus-agent-card.json — permukaan publik
  - /feature-sharing/* — 6 endpoint, semuanya soal siapa boleh melihat apa
  - /agent-invoke/shared-agent/:hash dan shared-thread/:hash — diakses tanpa
    login; pastikan hash yang salah tidak membocorkan keberadaan resource
  - /orchestrator/mcp/* — start/stop/status, bisa memicu spawn proses
  - route yang memanggil LLM — pastikan ada timeout dan rate limit

JANGAN jalankan skenario yang benar-benar men-spawn proses atau memanggil
LLM berbayar tanpa penanda; pisahkan sebagai grup `--live` yang harus
diminta eksplisit.

=========================================================================
D — REFACTOR YANG MEMANG PERLU (bukan tambahan gaya)

Hanya kerjakan yang muncul dari A–C:

D1. Satu penulis state, satu pembaca.
    Semua tulisan ke mcp_runtime_state lewat satu modul
    (mis. src/services/mcpRuntimeState.ts) dengan fungsi bernama jelas:
    markStarting, markRunning, markStopped, markCrashed, reconcileOnBoot.
    Jangan biarkan SQL mentah tersebar seperti sekarang.

D2. Duplikasi pembangunan transport stdio.
    src/orchestrator/engine.ts membangun StdioClientTransport di DUA tempat
    (sekitar baris 490 dan 717) dengan kode hampir identik. Satukan jadi satu
    factory. Ini juga memastikan gerbang keamanan (allowlist, cwd) hanya
    perlu dipasang di satu tempat, bukan diulang dan berisiko lupa.

D3. Jangan menyusun kalimat UI di SQL/route.
    Lihat A4 — route mengembalikan 'stdio (spawned on demand)'. Kembalikan
    data, biar UI yang menyusun kata.

Bila menemukan duplikasi atau dead code lain saat mengerjakan ini, CATAT di
laporan tetapi JANGAN kerjakan sekarang — itu FASE 2/3 yang terpisah.

=========================================================================
BATASAN
- Jangan mengubah kontrak API yang sudah dipakai frontend tanpa memperbarui
  frontend-nya di commit yang sama.
- Jangan melemahkan hasil hardening keamanan sebelumnya (allowlist spawn,
  cwd, error generik, JWT alg pinning).
- Migrasi database boleh ditambah bila perlu kolom baru (mis. last_checked_at),
  tetapi harus additive dan punya `down`.
- Satu commit per bagian: A1, A2, A3/A4, C, lalu D.

URUTAN
1. Verifikasi A1 dan A2 sendiri, tunjukkan buktinya, TUNGGU konfirmasi.
2. Sepakati kontrak status (B) sebelum menulis kode.
3. Baru kerjakan A, lalu C, lalu D.

Kalau menemukan bahwa asumsi dalam prompt ini salah terhadap kode nyata,
LAPORKAN dulu — jangan menyesuaikan diam-diam.
```

---

## Ringkasan temuan yang mendasari prompt ini

| Temuan | Bukti |
|---|---|
| Tidak ada yang menulis status "running" | Satu-satunya penulis: `routes.ts:488`, dan itu hanya menulis `'stopped'` |
| `mcpAutoManager` hanya membaca | Baris 79 dan 457 — keduanya `SELECT` |
| Frontend memaksa "Online" | `tools/page.tsx:43,78,184` — `tool.on_status \|\| "Online"` |
| Tidak ada liveness check | Tidak ditemukan `process.kill(pid,0)`, ping port, atau health probe |
| Status mencampur konsep | Route mengembalikan `'stdio (spawned on demand)'` sebagai nilai status |

Jadi saat ini: tool yang mati tampil **Online** karena default frontend, dan tool yang hidup tampil **stopped** karena backend tidak pernah mencatatnya. Kedua arah salah — bukan sekadar kurang akurat.
