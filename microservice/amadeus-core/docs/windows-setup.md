# Menjalankan di Windows (CMD/PowerShell) — laptop korporat CISO

Panduan ini untuk menjalankan `amadeus-core` + `frontend` **lokal** di Windows
10/11 lewat CMD/PowerShell, di laptop yang terkunci kebijakan CISO (tanpa admin
permanen, proxy TLS-inspection, kemungkinan AppLocker/Defender ASR aktif,
Docker Desktop mungkin diblokir).

Perubahan yang mendukung ini bersifat **additive** — perilaku di Linux/macOS
tidak berubah sama sekali (lihat `src/lib/spawnCompat.ts`).

## 1. Langkah instalasi

1. **Node.js LTS** dalam rentang `engines.node` (`>=20 <23`) — pakai Node 20
   atau 22. Unduh dari nodejs.org (butuh persetujuan IT bila laptop tidak
   punya izin instalasi software).
2. **CA korporat untuk proxy TLS-inspection** — JANGAN matikan verifikasi TLS
   (`NODE_TLS_REJECT_UNAUTHORIZED=0` / `npm config set strict-ssl false`
   dilarang keras). Sebagai gantinya:
   ```cmd
   set NODE_EXTRA_CA_CERTS=C:\path\to\corporate-ca.pem
   npm config set cafile "C:\path\to\corporate-ca.pem"
   ```
   Minta file CA korporat ke IT bila belum ada.
3. **PostgreSQL + pgvector** — dua opsi, pilih sesuai kebijakan:
   - **Opsi A — Docker Desktop** (bila diizinkan): image `pgvector/pgvector:pg16`
     sudah menyertakan extension pgvector, paling sederhana.
     ```cmd
     docker run -d --name amadeus-pg -p 127.0.0.1:5432:5432 ^
       -e POSTGRES_PASSWORD=amadeus_local_dev ^
       -e POSTGRES_DB=amadeus ^
       pgvector/pgvector:pg16
     ```
   - **Opsi B — PostgreSQL native Windows** (bila Docker diblokir): installer
     resmi PostgreSQL untuk Windows **tidak** menyertakan pgvector. Perlu
     compile manual dari source (butuh Visual Studio Build Tools + `nmake`)
     atau memakai binary pgvector pihak ketiga yang sudah di-review IT.
     Konsekuensi: langkah instalasi tambahan dan ketergantungan pada compiler
     yang mungkin tidak tersedia di laptop terkunci — Opsi A jauh lebih
     sederhana bila tersedia.
   - Setelah PostgreSQL siap, verifikasi extension tersedia:
     ```sql
     SELECT * FROM pg_available_extensions WHERE name='vector';
     ```
     (dicek otomatis oleh `npm run preflight`, lihat bawah).
4. **Clone repo, isi `.env`** (lihat variabel di `src/config/env.ts`; minimal
   `DATABASE_URL` wajib diisi). Variabel LLM yang relevan: `OPENROUTER_BASE_URL`
   / `OPENROUTER_API_KEY` (bukan `NETRA_*` atau `DASHSCOPE_*` — provider lama
   sudah dimigrasikan ke OpenRouter, lihat git history).
5. `npm install` — bila gagal dengan `SELF_SIGNED_CERT_IN_CHAIN` /
   `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, kembali ke langkah 2 (CA korporat
   belum benar terpasang).

## 2. Menjalankan

```cmd
npm run preflight
npm run migrate:up
npm run dev
```

Tanda sukses:
- `npm run preflight` tidak menampilkan baris `FAIL` pada blocker inti
  (`node-version`, `resolve:node`, `resolve:npx`, `argon2-binding`,
  `database-url`, `pgvector-extension`).
- Salah satu tool MCP bermetode `'sse'` (mis. `amadeus-mcp`) berstatus
  `running` di `mcp_runtime_state` beberapa detik setelah `npm run dev`
  (lihat log `mcpAutoManager.ts` di terminal yang sama — proses ini berjalan
  concurrently dengan server lewat `concurrently`, lihat catatan di
  `MEMORY.md` proyek: log daemon ini hanya tampak di terminal yang menjalankan
  `npm run dev`).
- Satu invoke agent (lewat frontend atau `curl` ke endpoint agent) berhasil
  memanggil sebuah tool tanpa error `ENOENT`/`EINVAL` di log.
- Windows Firewall mungkin memunculkan prompt izin saat pertama kali listen —
  ini normal (`HOST` tetap `127.0.0.1`, jangan ubah), izinkan untuk jaringan privat.

## 3. Kenapa ini sebelumnya gagal di Windows

- `scripts/mcpAutoManager.ts` men-spawn tool bermetode `'sse'` lewat
  `child_process.spawn(command, args, { shell: false })` — bila `command`
  adalah `npx` (shim `.cmd` di Windows), Node tidak bisa mengeksekusinya
  langsung tanpa shell (ENOENT, atau EINVAL pada Node ≥18.20.2/20.12 setelah
  perbaikan CVE-2024-27980). **Ini sudah diperbaiki** lewat
  `src/lib/spawnCompat.ts`'s `resolveSpawnTarget()`, dipanggil sebelum
  `spawn()` di `startSseTool()`.
- Tool bermetode `'stdio'` (di-spawn per-invocation lewat `StdioClientTransport`
  di `src/orchestrator/engine.ts`) **tidak** punya masalah yang sama — SDK
  `@modelcontextprotocol/sdk` men-spawn lewat dependency `cross-spawn`
  miliknya sendiri, yang sudah menangani shim `.cmd`/`.bat` dengan benar di
  Windows. Tidak ada perubahan yang diperlukan di `engine.ts`.
- `command` di tabel `tools` tidak selalu `"npx"` — juga bisa `"node"` (path
  lokal, mis. UiPath/amadeus-mcp) atau `"python"`. `resolveSpawnTarget()`
  menangani ketiganya: `node`/`python` diresolusi ke path absolut lewat PATH
  (tanpa `cmd.exe`), sementara shim (`npx`/`npm`/`pnpm`/`yarn`) dibungkus lewat
  `cmd.exe /d /s /c` dengan quoting manual (`windowsVerbatimArguments: true`)
  — **bukan** `shell: true`, supaya tidak membuka celah shell-injection.

## 4. Mode offline/local untuk MCP tool (bila registry npm diblokir)

`npx -y <paket>` mengunduh paket **saat runtime**, bukan saat install — jadi
walau `npm install` berhasil, tool bisa gagal saat dipakai kalau proxy
memblokir egress ke registry npm saat runtime (lihat baris `npm-registry` di
`npm run preflight`).

Solusi: install paket MCP tersebut sekali secara manual/offline ke sebuah
folder lokal, lalu pindahkan tool itu ke mode `node <path lokal>`:

```cmd
npm run tool:set-local-mode -- --tool-id <uuid> --entry C:\path\ke\entry\index.js
```

Jalankan tanpa `--yes` dulu untuk melihat before/after (dry run, tidak
menyimpan apa pun); tambahkan `--yes` setelah yakin. Script ini ada di
`scripts/setToolLocalMode.ts`.

## 5. Checklist persetujuan IT/CISO

- [ ] Instalasi Node.js LTS (20 atau 22)
- [ ] Instalasi PostgreSQL (native atau via Docker Desktop) + pgvector
- [ ] File CA korporat untuk `NODE_EXTRA_CA_CERTS` / `npm config set cafile`
- [ ] Akses registry `registry.npmjs.org` (untuk `npm install`; idealnya juga
      untuk `npx -y` saat runtime — bila tidak, pakai mode offline di §4)
- [ ] Exception AppLocker/Defender ASR bila proses child dari
      `%LOCALAPPDATA%\npm-cache\_npx` diblokir eksekusinya
- [ ] Firewall inbound untuk `127.0.0.1` (biasanya otomatis, tidak perlu rule
      khusus karena tidak bind `0.0.0.0`)

## 6. Troubleshooting

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `spawn npx ENOENT` atau `EINVAL` saat tool `'sse'` start | `.cmd` shim tidak bisa dieksekusi tanpa shell | Pastikan sudah pull versi terbaru (`spawnCompat.ts` sudah menangani ini); jalankan `npm run preflight` untuk konfirmasi `resolve:npx` PASS |
| `npm install` gagal `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` | Proxy TLS-inspection korporat, CA belum terpasang | Set `NODE_EXTRA_CA_CERTS` + `npm config set cafile` ke CA korporat (§1.2). Jangan pernah pakai `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `argon2` gagal saat `npm install` (build native gagal) | Tidak ada prebuilt binary untuk versi Node ini, dan Visual Studio Build Tools + Python tidak tersedia | Pakai versi Node yang punya prebuilt binary (cek `npm run preflight` → `argon2-binding`), atau minta IT memasang Build Tools |
| `pgvector-extension: FAIL` di preflight | Extension `vector` belum ada di instance PostgreSQL | Pakai image `pgvector/pgvector:pg16` (Docker) atau compile pgvector manual untuk PostgreSQL native (§1.3 Opsi B) |
| Tool `npx -y <pkg>` gagal di runtime meski install sukses | Egress ke registry npm diblokir saat runtime (proxy/firewall) | Pindahkan tool ke mode lokal, lihat §4 |
| Windows Firewall prompt saat `npm run dev` pertama kali | Normal — proses baru listen di `127.0.0.1` | Izinkan untuk jaringan privat; jangan ubah `HOST` menjadi `0.0.0.0` |
| Proses child MCP tidak mati saat `Ctrl+C` | `process.on('SIGTERM', ...)` tidak selalu berlaku di Windows (bukan sinyal POSIX asli) | `Ctrl+C` (SIGINT) tetap bekerja dan memicu `shutdown()`; bila ada proses menggantung, hentikan manual lewat Task Manager sebagai langkah terakhir |

## 7. Batasan yang tetap berlaku

Sama seperti di Linux/macOS: tidak ada bypass TLS global, `HOST` tetap
`127.0.0.1`, `src/middleware/auth.ts` dan validasi Zod tidak diubah, tidak ada
secret di repo (semua lewat `.env`, pastikan ter-`.gitignore`), dan jangan
jalankan dengan data nasabah asli di laptop lokal — pakai data sintetis untuk
uji coba.
