# PROMPT — Tutup Branch Security (sisa terakhir)

Sebagian besar sudah selesai. Diverifikasi terhadap v21: bypass path absolut **tertutup**, `npx` **di-harden** (`-y` → `--no-install` + `cwd` di-pin), `trustProxy: 'loopback'` **terpasang**, rate limit **sudah per-kelas** (global / LLM / login), dan `resolveSpawnTarget` memanggil `assertSpawnSafe` di baris pertama sehingga **ketiga jalur spawn** (engine ×2, tools route, mcpAutoManager) terlindungi.

Yang tersisa di bawah ini kecil-kecil. Tempel ke Claude Code.

---

```text
KONTEKS
Branch security tinggal beberapa item. Verifikasi dulu tiap klaim di bawah
terhadap kode nyata — beberapa mungkin sudah selesai sejak snapshot dibuat.

=========================================================================
1 — HAPUS PYTHON DARI ALLOWLIST  (keputusan sudah diambil)

src/lib/spawnCompat.ts:26
  const ALLOWLISTED_COMMANDS = new Set(["npx", "node", "python", "python3"]);

Aturan CISO kami absolut: tidak boleh ada Python sama sekali. Hapus "python"
dan "python3".

Sebelum menghapus:
  - Jalankan SELECT DISTINCT command FROM tools dan tunjukkan hasilnya.
    Kalau ada baris yang memakai python, laporkan dulu — jangan langsung
    mematikan tool yang terdaftar.
  - Bersihkan juga komentar di baris 16 dan 161 yang masih menyebut
    "node/python", supaya kode tidak menyesatkan pembaca berikutnya.

Tambahkan test: assertSpawnSafe('python', []) dan ('python3', []) harus throw.

Catat konsekuensinya di docs/security-audit.md: keputusan ini secara permanen
menutup pemakaian MCP server berbasis Python (ekosistem uvx). Itu trade-off
yang diterima, bukan kelalaian.

=========================================================================
2 — PERKETAT JENDELA ANTI-REPLAY HMAC

src/config/env.ts:73
  SIGNATURE_MAX_SKEW_SEC: default 300  (5 menit)

Turunkan default ke 60. Robot kami ada di jaringan bank dengan NTP, jadi
60 detik aman. Tetap konfigurabel lewat env.

Setelah diubah, tambahkan catatan di docs/security-audit.md: 60 detik tanpa
nonce adalah postur sementara yang diterima; HMAC-nonce (finding #7) tetap
di backlog dengan alasannya. Sebutkan juga apa yang harus dipantau setelah
rollout — kalau ada klien sah yang kena signature-expired, naikkan nilainya,
jangan kembalikan ke 300 diam-diam.

=========================================================================
3 — DUA VERIFIKASI YANG BELUM PERNAH DIJAWAB

3a. B2 — apakah err.message ASLI masih masuk log?
    Perbaikan #4 mengganti pesan error ke klien jadi generik + requestId.
    Tunjukkan potongan kode yang membuktikan detail aslinya TETAP tercatat di
    log terstruktur, dengan requestId yang sama dengan yang dikirim ke klien.
    Kalau detailnya ikut hilang, kita menukar kebocoran dengan kebutaan saat
    debug — itu harus diperbaiki, bukan dibiarkan.

3b. B4 — apakah ada tool di database yang mati akibat hardening?
    Sekarang lebih relevan daripada sebelumnya, karena hardenNpxArgs menulis
    ulang `-y` menjadi `--no-install`. Artinya paket MCP harus sudah
    ter-install lokal; kalau belum, tool yang tadinya jalan akan gagal.
    Buktikan:
      - daftar SELECT DISTINCT command, args FROM tools
      - untuk tiap baris ber-command npx: apakah paketnya ada di
        node_modules? Kalau tidak, tool itu AKAN GAGAL setelah hardening.
      - laporkan daftar yang berisiko SEBELUM branch di-merge
    Kalau ada yang berisiko, usulkan: pre-install paketnya sebagai dependency,
    atau nonaktifkan tool itu secara sadar. Jangan biarkan gagal diam-diam.

=========================================================================
4 — A2A: TERAPKAN PENUNDAAN (keputusan sudah diambil, bukan pertanyaan lagi)

Ini menggantikan pertanyaan B3 yang menggantung. Keputusannya: A2A DITUNDA,
kodenya DIPERTAHANKAN, rutenya DIMATIKAN.

Alasan: 5 dari 10 export di services/a2aTasks.ts tidak pernah dipanggil
(a2aEventEmitter, markTaskWorking, markTaskInputRequired, markTaskFailed,
markTaskCompleted), sehingga task bisa submit dan cancel tetapi tidak pernah
bertransisi ke working/completed/failed. Sementara itu empat rute A2A aktif,
dan agent card di routes.ts:173 terdaftar lewat app.get — TANPA autentikasi —
sambil mengiklankan sembilan kapabilitas settlement Trade Finance yang
sebagian ditandai financial. Kontrak publik yang tidak bisa diselesaikan itu
lebih berbahaya daripada dead code.

  4.1 Tambahkan A2A_ENABLED (boolean, DEFAULT OFF) di src/config/env.ts.
  4.2 Di src/orchestrator/routes.ts, JANGAN registrasikan keempat rute saat
      flag off — termasuk agent card publik di baris 173. Jangan sekadar
      mengembalikan 404 dari dalam handler; jangan daftarkan sama sekali.
  4.3 PERTAHANKAN semua file A2A: direktori a2a/, services/a2aTasks.ts, dan
      migrasi 1784000000000_a2a-tasks. Ini penundaan, bukan penghapusan.
  4.4 Komentar header di services/a2aTasks.ts: state machine belum lengkap,
      A2A dinonaktifkan di balik A2A_ENABLED, export tak terpakai SENGAJA
      dipertahankan.
  4.5 docs/refactor-inventory.md: tandai kelima simbol itu
      INTENTIONALLY-RETAINED (deferred feature), bukan dead code.
  4.6 Test: dengan flag off, GET /.well-known/amadeus-agent-card.json
      mengembalikan 404.

  PENGECUALIAN: src/orchestrator/a2a/client.ts (132 baris) tetap DIHAPUS —
  file itu tidak dipakai bahkan oleh permukaan A2A sendiri (0 pemakaian
  A2AClient, tidak di-import siapa pun). Cek dulu apakah ada rencana
  memakainya untuk memanggil agent EKSTERNAL (arah keluar); kalau ada,
  perlakukan sama seperti 4.3.

=========================================================================
5 — RAPIKAN DOKUMEN SEBELUM MERGE

docs/security-audit.md harus mencerminkan kondisi akhir yang jujur:
  - finding #1: sekarang benar-benar tertutup (bypass path absolut + npx).
    Catat bahwa sebelumnya sempat ditandai "fixed" secara keliru, dan kenapa —
    supaya pembaca berikutnya memverifikasi, bukan percaya begitu saja.
  - finding #5 rate limit: sudah per-kelas (global/LLM/login), sebutkan
    nilainya dan bahwa semuanya konfigurabel lewat env.
  - finding #7 HMAC nonce: masih backlog, dengan postur sementara 60 detik.
  - finding #8 trustProxy: selesai, 'loopback'.
  - Python: dihapus dari allowlist, beserta konsekuensinya.
  - Tiga kredensial lokal yang masih ada dan sengaja dibiarkan:
      create_db.sh:2 (PASSWORD 'amadeus_local_dev')
      scripts/migrate_supabase.ts:11 (DSN fallback)
      src/config/env.ts:31 (hanya contoh di pesan error — aman)
    Tulis sebagai keputusan sadar, atau perbaiki. Jangan didiamkan.

=========================================================================
KRITERIA MERGE
  [ ] python/python3 hilang dari allowlist, ada test-nya
  [ ] skew default 60 detik
  [ ] 3a dibuktikan (err.message tetap di log)
  [ ] 3b dibuktikan (tidak ada tool DB yang mati) — kalau ada, dilaporkan
  [ ] A2A off di balik flag, kode dipertahankan, test 404 lulus
  [ ] a2a/client.ts dihapus
  [ ] docs/security-audit.md dan refactor-inventory.md cocok dengan kode
  [ ] tsc --noEmit bersih, semua test lulus

BATASAN
- Jangan menambah cakupan. Sisa pembersihan (unexport 43 simbol, investigasi
  registry, dedup failStep) ada di prompt terpisah.
- Rotasi secret BUKAN pekerjaanmu — ditangani manual.
- Satu commit per nomor.

Mulai dari nomor 3 (verifikasi), karena kalau 3b menemukan tool yang akan
mati, itu mengubah cara kita merge.
```

---

## Yang tetap jadi tugasmu, di luar prompt ini

**Rotasi `client_secret` UiPath.** Ini kredensial **cloud produksi**, beda kelas dari `amadeus_local_dev`. Menghapus filenya tidak menghapusnya dari git history — masih bisa diambil lewat `git show`. Rotasi di UiPath Orchestrator hari ini.

Plus lima yang sebelumnya: `SUPABASE_KEY`, `JWT_SECRET`, `HF_TOKEN`, `MAIAROUTER_API_KEY`, `OPENROUTER_API_KEY`.

Kalau kamu berencana men-*scrub* git history (BFG / filter-repo), lakukan **sebelum** branch security di-push — supaya tidak ada dua sejarah yang harus dibersihkan.
