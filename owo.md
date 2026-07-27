text

# PROMPT — Refactor Clean Code (Brutal) + Audit Keamanan Backend

Untuk `microservice/amadeus-core`. Temuan di bawah **sudah diverifikasi** terhadap snapshot repo terbaru — bukan tebakan. Tempel ke Claude Code.

> Catatan sebelum mulai: scan statis pertama yang aku jalankan **salah** menandai seluruh modul `a2aTasks` sebagai mati, padahal ia diimpor sebagai namespace (`import * as a2aTasks`). Prompt ini memuat pelajaran itu sebagai aturan wajib — jangan pernah menghapus berdasarkan satu metode deteksi saja.

---

```text
KONTEKS
Repo: kachponz-main, service microservice/amadeus-core.
Ukuran: 71 file TypeScript, ~11.544 baris (src + scripts).
Tujuan: refactor bersih tanpa ampun + audit keamanan backend.
Aturan pokok dari user: TIDAK BOLEH ada fungsi menganggur atau duplikat.

ATURAN KERAS — LANGGAR SATU SAJA, PEKERJAAN DITOLAK
H1. Jangan mengubah perilaku eksternal. Kontrak API, bentuk response, kode error,
    dan schema database tetap. Refactor ≠ redesign.
H2. Jangan menghapus apa pun tanpa BUKTI TIGA JALUR (lihat FASE 1). Deteksi
    satu-jalur terbukti salah: modul a2aTasks tampak mati oleh grep biasa padahal
    diimpor via `import * as a2aTasks from ...`.
H3. Jangan melemahkan keamanan demi kerapian. helmet, rate-limit, CORS, argon2,
    validasi Zod, dan HMAC signature tidak boleh disederhanakan.
H4. Satu commit = satu jenis perubahan. Jangan campur penghapusan dead code
    dengan perbaikan keamanan dengan perubahan struktur.
H5. Setiap penghapusan wajib punya baris di laporan: simbol, file, bukti tidak
    dipakai, dan risiko bila ternyata salah.

=========================================================================
FASE 1 — INVENTARIS BUKTI (jangan hapus apa pun di fase ini)

Bangun daftar simbol dengan TIGA metode deteksi sekaligus, karena satu metode
selalu bocor:
  M1. Import langsung        : `import { X }` / `import X from`
  M2. Import namespace       : `import * as NS` lalu pemakaian `NS.X`
  M3. Referensi tak-statis   : string literal, dynamic import(), akses via
                               index `obj['X']`, registry/tabel handler,
                               nama yang muncul di migrasi atau config

Untuk tiap simbol keluarkan tabel: simbol | file | dipakai oleh (M1/M2/M3) |
status (LIVE / SUSPECT-DEAD / ENTRYPOINT).

ENTRYPOINT bukan dead code — kenali dan kecualikan:
  - export yang dipakai test (mis. buildServer dipakai test harness)
  - CLI/script entry (`main()` di scripts/*)
  - handler yang didaftarkan lewat registry, bukan dipanggil langsung
  - export publik yang memang bagian dari kontrak modul

TEMUAN AWAL YANG SUDAH DIVERIFIKASI — pakai sebagai titik mulai, verifikasi ulang:

  A. src/services/a2aTasks.ts — 6 dari 10 export tidak pernah dipanggil:
       markTaskWorking, markTaskInputRequired, markTaskFailed,
       markTaskCompleted, a2aEventEmitter, watchTask
     Yang dipanggil hanya: submitTask, getTaskWithMessages, cancelTask, provideInput
     ⚠ INI BUKAN SEKADAR DEAD CODE — INVESTIGASI DULU SEBELUM MENGHAPUS.
     Artinya task A2A bisa di-submit dan di-cancel tetapi TIDAK PERNAH
     bertransisi ke working / completed / failed. Itu kemungkinan besar
     LUBANG FUNGSIONAL, bukan kode sisa. Tentukan mana yang benar:
       (a) state machine memang belum selesai → laporkan sebagai bug, JANGAN hapus
       (b) transisi ditangani di tempat lain → tunjukkan di mana, lalu hapus yang duplikat
     Jangan ambil keputusan tanpa membaca alur A2A end-to-end.

  B. src/lib/crypto.ts — aesGcmEncrypt / aesGcmDecrypt tidak pernah dipakai.
     Kode kriptografi menganggur berbahaya: ia terlihat "tersedia" lalu suatu
     hari dipakai tanpa review. Hapus, atau bila memang direncanakan, beri
     komentar alasan + tanggal + siapa yang memutuskan.

  C. src/lib/spawnCompat.ts — quoteCmdArg tidak dipakai di luar test-nya sendiri.
     Periksa: apakah lapisan spawn Windows sudah benar-benar terpasang di
     scripts/mcpAutoManager.ts dan src/orchestrator/engine.ts, atau modulnya
     dibuat tapi tidak pernah disambungkan? Kalau belum tersambung, itu bug,
     bukan dead code.

  D. src/config/stepFlows.ts — linearOrder tidak dipakai.
  E. src/orchestrator/recipes/executor.ts — runRecipe di-export padahal hanya
     dipakai di dalam file itu sendiri (oleh runRecipeStream). Turunkan jadi
     non-export, kecuali ada alasan kontrak.
  F. src/config/env.ts (loadEnv) dan src/server.ts (buildServer) — cek dulu,
     kemungkinan besar entrypoint / dipakai test.

Keluaran fase ini: docs/refactor-inventory.md berisi tabel lengkap.
BERHENTI di sini dan tunggu konfirmasi sebelum menghapus apa pun.

=========================================================================
FASE 2 — HAPUS YANG MATI (setelah disetujui)
Untuk tiap simbol berstatus SUSPECT-DEAD yang sudah dikonfirmasi:
  - hapus simbol beserta helper yang jadi ikut yatim
  - hapus import yang jadi tidak terpakai
  - hapus dependency di package.json yang jadi tidak terpakai (verifikasi dulu
    dengan pencarian menyeluruh, termasuk pemakaian di config dan script)
  - jalankan `tsc --noEmit` setelah setiap penghapusan, jangan menumpuk
Laporkan: berapa baris hilang, berapa file hilang, berapa dependency hilang.

=========================================================================
FASE 3 — DUPLIKASI (aturan user: tidak boleh ada duplikat)

Duplikat yang sudah diverifikasi:

  D1. scripts/e2e-demo.ts (459 baris) menulis ulang logika produksi:
        getUiPathToken, createTransaction, completeStep, failStep,
        explainRoute, sleep
      File ini hanya punya 5 pemanggilan fetch(), jadi ia BUKAN sekadar
      klien HTTP — sebagian logika diduplikasi dan pasti akan menyimpang
      dari src seiring waktu.
      Putuskan salah satu, jangan digantung:
        (a) jadikan murni klien HTTP terhadap API yang berjalan (paling benar
            untuk sebuah e2e demo — ia harus menguji API, bukan mengimpor
            internal), atau
        (b) impor fungsi dari src dan buang salinannya.
      Apa pun pilihannya, `sleep` dan util sejenis WAJIB dari satu sumber.

  D2. failStep ADA DUA IMPLEMENTASI PRODUKSI:
        src/orchestrator/engine.ts:264   (privat, berbasis A2AEnvelope)
        src/services/transactions.ts:266 (export, berbasis FailStepInput)
      Ini operasi domain yang sama dengan dua jalur kode. Baca keduanya,
      tentukan mana yang otoritatif, dan jadikan satu — yang lain memanggilnya.
      Bila keduanya memang beda konteks, RENAME agar tidak menyesatkan
      (mis. failStepFromEnvelope vs failStepDirect) dan tulis alasannya.

  D3. Cari duplikasi lain yang tidak sama namanya. Nama identik hanya
      menangkap kasus mudah. Cari juga blok logika yang mirip:
      - validasi/normalisasi yang diulang di beberapa route
      - pembentukan error yang identik
      - query database yang hampir sama
      Laporkan dengan lokasi kedua salinan dan usulan penyatuan.

=========================================================================
FASE 4 — UKURAN & STRUKTUR FILE
File terbesar saat ini:
  src/orchestrator/engine.ts        1.437 baris
  src/orchestrator/routes.ts          737
  scripts/mcpAutoManager.ts           673
  src/orchestrator/recipes/executor.ts 535
engine.ts jelas melanggar single-responsibility. Pecah berdasarkan tanggung
jawab yang SUDAH ADA di dalamnya (jangan mengarang lapisan baru), mis.:
  - konstruksi model & konfigurasi
  - loop ReAct
  - pemuatan/penyambungan tool MCP
  - penanganan A2A envelope
  - telemetri
Syarat: murni pemindahan. Nol perubahan perilaku, nol perubahan signature
publik. Setelah pecah, `tsc --noEmit` bersih dan test tetap lulus.

=========================================================================
FASE 5 — AUDIT KEAMANAN BACKEND (ini bagian yang serius)

Kabar baik dari scan awal: TIDAK ditemukan SQL string-interpolation —
query tampaknya berparameter. Verifikasi ulang menyeluruh, lalu periksa:

  S1. KEBOCORAN PESAN ERROR
      src/routes/agents.ts:298 meneruskan `err.message` mentah dari provider
      LLM ke DomainError yang dikirim ke klien. Pesan error provider bisa
      memuat URL internal, nama model, bahkan potongan kredensial.
      Periksa SEMUA jalur error: mana yang di-log (boleh detail) dan mana
      yang dikirim ke klien (harus generik + correlation id).
      Bandingkan dengan src/server.ts:131-138 yang sudah memisahkan log vs body.

  S2. AUTENTIKASI & OTORISASI
      - Baca ulang src/middleware/auth.ts: JWT, X-Robot-Key (argon2),
        HMAC-SHA512 untuk step finansial. Pastikan tidak ada jalur yang
        melewati salah satunya.
      - IDOR: untuk setiap route yang menerima id (agent, thread, tool,
        knowledge base, transaction), buktikan ada pengecekan kepemilikan /
        service account. Kalau ada yang hanya mengandalkan "id sulit ditebak",
        laporkan sebagai temuan.
      - Anti-replay: jendela timestamp HMAC — pastikan skew-nya masuk akal
        dan perbandingan signature timing-safe.

  S3. SSRF & COMMAND INJECTION (permukaan terbesar di aplikasi ini)
      - MCP SSE: URL server MCP berasal dari database. Bisakah user menambah
        tool dengan URL ke jaringan internal (169.254.x, 127.0.0.1, metadata
        endpoint cloud)? Kalau belum ada allowlist, itu SSRF.
      - MCP stdio: spawn(command, args). Pastikan command di-allowlist dan
        tidak pernah `shell: true`. Cek juga jalur spawnCompat (lihat FASE 1C).
      - Vision/ingest: URL atau path gambar dari input user → cek path
        traversal dan fetch ke alamat internal.

  S4. PENANGANAN SECRET
      - Tidak ada secret di repo, log, atau pesan error.
      - Cek src/orchestrator/routes.ts:608 yang me-log response OAuth UiPath —
        pastikan hanya status, bukan body/token.
      - Pastikan .env ter-gitignore dan tidak ada default kredensial di kode.

  S5. INPUT & BATAS
      - Semua route punya schema Zod (request DAN response).
      - Batas ukuran body, ukuran upload, dan timeout ada dan masuk akal.
      - Rate limit: apakah berlaku untuk route mahal (invoke agent, ingest)?
        Route yang memanggil LLM harus punya batas lebih ketat.

  S6. TIPE YANG DILUMPUHKAN
      `as any` terhitung: engine.ts 12, server.ts 9, executor.ts 3, routes.ts 2.
      Setiap `as any` adalah pengecekan tipe yang dimatikan. Untuk masing-masing:
      ganti dengan tipe yang benar, atau bila memang batas dengan library luar,
      ganti jadi `unknown` + validasi Zod. Sisakan hanya yang benar-benar
      tidak bisa dihindari, dan beri komentar alasannya.

  S7. LOGGING
      5 `console.log` di src — ganti ke logger pino terstruktur, karena
      console.log lolos dari redaction dan level filtering.

Keluaran: docs/security-audit.md dengan tabel
  temuan | file:baris | severity (High/Med/Low) | bukti | perbaikan | status
Severity ditentukan oleh dampak nyata, bukan perasaan. Bila sebuah temuan
ternyata sudah aman, tulis juga beserta alasannya — daftar yang hanya berisi
masalah membuat pembaca mengira sisanya belum diperiksa.

=========================================================================
FASE 6 — JARING PENGAMAN
Saat ini hanya ada SATU file test (test/spawnCompat.test.ts) untuk ~11.500 baris.
Refactor tanpa test adalah tebakan. Sebelum FASE 4 (pecah file), tulis dulu
test karakterisasi untuk jalur yang akan disentuh:
  - satu happy path per route yang direfactor
  - auth: token valid, token invalid, signature salah, timestamp kedaluwarsa
  - validasi verdict: input sesuai schema dan yang menyimpang (harus 502)
Tidak perlu cakupan tinggi — cukup untuk membuktikan perilaku tidak berubah.

=========================================================================
KELUARAN AKHIR
1. docs/refactor-inventory.md   — tabel bukti tiga-jalur, per simbol
2. docs/security-audit.md       — tabel temuan + status
3. Rangkaian commit kecil, satu jenis perubahan per commit
4. Ringkasan: baris dihapus, duplikat disatukan, temuan keamanan per severity
5. Daftar "SENGAJA TIDAK DISENTUH" beserta alasannya — sama pentingnya
   dengan daftar yang dikerjakan

URUTAN KERJA
FASE 1 dulu, tunjukkan inventarisnya, TUNGGU konfirmasi.
Lalu FASE 5 (keamanan) — temuan keamanan lebih mendesak daripada kerapian.
Baru FASE 2, 3, 6, dan terakhir FASE 4.
Jangan mengerjakan FASE 4 sebelum ada test dari FASE 6.

Bila ragu antara "hapus" dan "tanya", TANYA. Kode yang salah dihapus jauh
lebih mahal daripada kode menganggur yang bertahan satu minggu lagi.
```

---

## Kenapa urutannya begitu

**Keamanan sebelum kerapian.** Kalau ada SSRF lewat URL MCP, itu jauh lebih mendesak daripada `engine.ts` yang 1.437 baris.

**Pecah file paling akhir, dan hanya setelah ada test.** Dengan satu file test untuk 11.500 baris, memecah `engine.ts` sekarang sama dengan refactor buta.

**Temuan A dan C bisa jadi bug, bukan dead code.** Ini yang paling penting: `a2aTasks` yang tak pernah menandai task selesai/gagal, dan `spawnCompat` yang mungkin dibuat tapi tak pernah disambungkan. Kalau keduanya dihapus begitu saja karena "tidak dipakai", kamu menghapus bukti adanya lubang, bukan memperbaikinya.
