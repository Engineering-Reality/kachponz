ext
(c) dulu, lalu (b). Rotasi #2 aku kerjakan paralel di sisiku — jangan tunggu itu.

REVIEW — 4 pertanyaan, mulai dari yang paling berisiko regresi:

1. #1 allowlist stdio: apa isi allowlist-nya persis? Tabel `tools` kita
   menyimpan command "npx" (lihat migrasi 1792000000000_normalize_mcp_commands).
   Kalau allowlist cuma mengizinkan "node", SEMUA MCP tool stdio yang ada
   sekarang mati. Tunjukkan: (a) daftar command yang diizinkan, (b) hasil
   query `SELECT DISTINCT command FROM tools`, (c) bukti tiap command yang
   ada di DB lolos allowlist. Kalau ada yang tidak lolos, itu breaking change
   dan harus dibahas dulu.

2. #1 + spawnCompat: keduanya menyentuh jalur spawn yang sama. Konfirmasi
   keduanya sudah tersambung di DUA lokasi — scripts/mcpAutoManager.ts dan
   src/orchestrator/engine.ts (dua tempat StdioClientTransport dibangun),
   bukan cuma satu. Ini pertanyaan FASE 1C yang belum kamu jawab.

3. #4 error generik: pastikan `err.message` masih masuk LOG (dengan requestId
   yang sama yang dikirim ke klien), bukan ikut hilang. Kalau detailnya hilang
   dari log juga, kita menukar kebocoran dengan kebutaan saat debug.

4. FASE 1: kesimpulanmu soal a2aTasks apa? 6 dari 10 export tak terpanggil,
   dan task tidak pernah bertransisi ke working/completed/failed. Itu bug
   atau ditangani di tempat lain? Jangan lanjut FASE 2 sebelum ini terjawab —
   kalau bug, menghapusnya berarti menghapus bukti lubang.

KEPUTUSAN untuk yang kamu tunda:

#3 SSRF — UiPath kita on-prem, jadi RFC1918 memang harus tetap jalan.
   Kompromimu benar. Tapi naikkan satu tingkat: allowlist HOST spesifik
   (dari env, bukan hardcode) alih-alih seluruh range privat. Sisakan
   fallback ke RFC1918 kalau env kosong, supaya tidak ada yang patah.

#5 rate-limit — pisah per kelas route, jangan satu angka global:
   - route yang memanggil LLM (invoke, architect, ingest): ketat
   - route polling/read frontend: longgar
   - /auth/login: paling ketat, per IP
   Semua threshold lewat env supaya bisa disetel tanpa deploy ulang.
   Default-nya pilih yang konservatif dulu, kita perketat setelah lihat
   trafik nyata.

#8 trustProxy — set ke loopback saja. Per docs/deployment.md aplikasi bind
   127.0.0.1 di belakang reverse proxy di host yang sama, jadi
   trustProxy: 'loopback' (bukan true) sudah tepat dan tidak bisa dipalsukan
   dari luar.

#7 HMAC nonce — tunda, tapi jawab dulu: berapa jendela skew timestamp
   sekarang? Kalau ≤60 detik, risiko replay-nya terbatas dan ini bisa masuk
   backlog. Kalau menit-an, naikkan prioritasnya.

SETELAH review di atas beres: lanjut FASE 2 lalu FASE 3.
Untuk FASE 2, jangan hapus a2aTasks dan spawnCompat sampai pertanyaan 2 dan 4
terjawab. Sisanya (crypto aesGcm*, linearOrder, runRecipe jadi non-export)
silakan jalan.

Dua catatan untukmu di luar pesan itu:

Jangan push branch-nya sebelum rotasi. Push tidak memperburuk (history-nya sudah ada), tapi kalau kamu berencana scrub history dengan BFG/filter-repo, lakukan itu sebelum ada branch baru yang menggantung di remote — supaya tidak ada dua sejarah yang harus dibersihkan.

Poin nomor 1 itu yang paling berpotensi menggigit. Perbaikan RCE-nya benar, tapi kalau allowlist-nya terlalu sempit, semua tool MCP kamu mati diam-diam — dan itu persis komponen yang akan kamu demokan.
