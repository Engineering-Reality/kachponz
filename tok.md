# PROMPT — Ukur Token Qwen di OpenRouter → Angka Sizing untuk Netra

**Revisi 3.** Disesuaikan dengan konfirmasi langsung dari Rifky (Netra):

> **Firania:** "Even though I am now calculating it based on Qwen model by OpenRouter, but as long as it's the same Qwen that I used at Netra API key it is still valid right?"
> **Rifky:** "yupp — netra's Qwen actually have higher accuracy due to less quantization than OpenRouter's."

Artinya: mengukur di OpenRouter **sah**, syaratnya satu — **model Qwen-nya harus sama** dengan yang dilayani Netra. Karena itu pendekatan "dua track" di revisi sebelumnya diganti jadi **satu track dengan penyelarasan model**.

---

## Kaitannya dengan obrolanmu dengan Rifky

Yang berasal dari obrolan itu **tetap berlaku** dan jadi spesifikasi keluaran:

| Dari Rifky | Status di prompt ini |
|---|---|
| Butuh angka `C × (I + O)` untuk sizing GPU | Jadi keluaran utama Fase 4 |
| Prod: ~90% VRAM untuk model + KV cache (bisa 60–70% bila GPU dipakai beban lain) | Dipakai di Fase 4 |
| Minimum VRAM = ukuran file model | Dipakai di Fase 4 |
| "Lihat token maksimum per call di observability tool" | Jadi Fase 2 (telemetri) |
| Tokenmu terbakar di MCP tool calling + thinking, bukan chat biasa | Jadi prinsip pengukuran |
| Qwen di Netra lebih sedikit kuantisasi → akurasi lebih tinggi | Dipakai di Fase 0.5 & 4 (lihat implikasinya) |

Yang berubah cuma **alat ukurnya**: dulu diasumsikan Netra, sekarang OpenRouter — karena itu memang runtime kamu hari ini.

---

```text
KONTEKS
Repo: monorepo (lokal: ~/Downloads/ponzgen). Service: microservice/amadeus-core
(Fastify + LangGraph + MCP). Runtime LLM SAAT INI = OpenRouter (OpenAI-compatible).

PENTING — repo ini bergerak cepat. Semua rujukan file/baris di bawah berasal dari
snapshot dan MUNGKIN SUDAH BASI. Perlakukan sebagai petunjuk, bukan fakta:
verifikasi ke working tree (git log, git status, grep) sebelum mengandalkannya.
Bila ada yang tidak cocok, LAPORKAN dulu, jangan diam-diam menyesuaikan.

KONDISI YANG TERAKHIR DIKETAHUI (verifikasi ulang)
- src/config/env.ts (~baris 72–76):
    OPENROUTER_BASE_URL   default 'https://openrouter.ai/api/v1'
    OPENROUTER_API_KEY
    OPENROUTER_LLM_MODEL  default 'qwen/qwen-plus'
    OPENROUTER_VL_MODEL   default 'qwen/qwen3-vl-235b-a22b-instruct'
    OPENROUTER_TIMEOUT_MS default 60000
- src/orchestrator/executors/openrouterClient.ts — klien OpenAI-compatible; sudah
  mem-parse `usage` (prompt_tokens/completion_tokens) di ~baris 41–43 dan 114–115,
  tetapi tampaknya TIDAK disimpan ke mana pun.
- src/orchestrator/engine.ts — DUA lokasi membangun ChatOpenAI (~baris 1007 dan ~1249,
  jalur non-streaming dan streaming). Model dipilih:
    requiresVision ? OPENROUTER_VL_MODEL : OPENROUTER_LLM_MODEL
- src/orchestrator/executors/visionExtract.ts — ekstraksi teks dari gambar untuk ingest
  knowledge base memakai model vision (tidak ada OCR library di repo).
- src/orchestrator/executors/router.ts — pemilihan executor; bila tidak ada preference,
  dipilih costUnit TERKECIL. Relevan untuk biaya token.
- max_tokens yang sudah dipatok: chatTitleClient 20, recommendationClient 150,
  autofillClient 200, qwenDocExamExecutor 1024 dan 512.
- BELUM ADA migrasi/tabel telemetri token (cek: ls migrations | grep -i usage).

TUJUAN
1. (Utama, bisa dikerjakan sekarang) Ukur konsumsi token nyata sistem ini di OpenRouter.
2. (Turunan) Hasilkan angka `C × (I + O)` + estimasi memori untuk dikirim ke vendor
   inference on-prem (Netra) sebagai bahan sizing GPU saat PoC nanti.

DUA MODEL, JANGAN DICAMPUR
Sistem ini memakai dua model berbeda: model teks (OPENROUTER_LLM_MODEL) dan model
vision (OPENROUTER_VL_MODEL). Token gambar dihitung dengan cara berbeda dari teks
(ubin/tile, bukan kata). Ukur dan laporkan keduanya TERPISAH, jangan dijumlahkan begitu saja.

DUA BESARAN, JANGAN DICAMPUR
Token di aplikasi ini tidak didominasi prompt user, melainkan schema MCP tool yang
di-inject tiap panggilan, hasil tool, loop ReAct yang mengirim ULANG seluruh percakapan
tiap iterasi, dan thinking tokens. Karena itu bedakan:
  A. PEAK CONTEXT per request = token RESIDEN pada iterasi terakhir
     → menentukan KV cache/memori. Ini yang dipakai sebagai I.
  B. TOTAL TOKEN PROCESSED per request = jumlah seluruh iterasi ReAct
     → menentukan biaya OpenRouter dan lama proses.

=========================================================================
FASE 0 — Potret kondisi saat ini (jangan percaya prompt ini)
  a. Jalankan git log --oneline -20 dan git status --short. Laporkan perubahan yang
     belum di-commit yang menyentuh jalur LLM.
  b. Daftarkan SEMUA lokasi kode yang memanggil LLM (file:baris). Untuk masing-masing:
     model apa (teks/vision, dari env yang mana), streaming atau tidak, bagian dari
     loop ReAct atau bukan, tools ter-attach atau tidak, max_tokens.
  c. Catat setiap ketidakcocokan antara prompt ini dan kode nyata.
Sajikan sebagai tabel. Jangan lanjut sebelum tabel ini lengkap dan aku konfirmasi.

=========================================================================
FASE 0.5 — Selaraskan model dengan Netra (WAJIB, jangan dilewati)

Vendor sudah mengonfirmasi: pengukuran di OpenRouter valid ASALKAN model Qwen-nya sama
dengan yang dilayani Netra. Jadi tugas fase ini adalah memastikan kesamaan itu.

1) Pastikan model Netra-nya apa.
   Tanyakan/konfirmasi ke vendor: model Qwen persis apa (nama + versi + ukuran) yang
   dilayani API key Netra dan yang akan dipakai on-prem nanti.
   Bila jawabannya belum ada, TULIS sebagai blocker terbuka — jangan menebak.

2) Cari slug yang cocok di OpenRouter.
   Verifikasi ke katalog/API OpenRouter, laporkan slug persisnya. JANGAN mengarang slug.
   PERHATIAN: default di kode saat ini OPENROUTER_LLM_MODEL = 'qwen/qwen-plus', yaitu
   Qwen berpemilik yang dilayani sebagai API — kemungkinan besar BUKAN model yang sama
   dengan yang dilayani Netra. Bila memang berbeda, gunakan slug yang cocok untuk
   pengukuran, dan usulkan (jangan langsung terapkan) agar aplikasi memakai model yang
   sama demi paritas dev/prod.
   Bila model yang persis sama tidak tersedia di OpenRouter, pilih yang terdekat,
   CATAT perbedaannya, dan tandai seluruh angka turunannya sebagai perkiraan.

3) Uji sanity tokenizer (cepat, bukan proyek terpisah).
   Ambil tokenizer resmi model tersebut. Siapkan 10 sampel yang mewakili beban nyata:
   potongan pesan MT, JSON schema tool, hasil retrieval KB, teks Indonesia, campur
   Inggris-Indonesia, angka & kode. Hitung dengan tokenizer lokal, bandingkan dengan
   usage.prompt_tokens dari OpenRouter untuk prompt yang sama persis.
   Tabelkan selisihnya. Selisih kecil (<2%) = wajar. Selisih besar = sinyal modelnya
   tidak sepadan atau accounting provider berbeda → laporkan sebelum lanjut.

4) IMPLIKASI KUANTISASI — penting, jangan dilewatkan.
   Vendor menyatakan Qwen di Netra lebih sedikit kuantisasinya dibanding yang dilayani
   OpenRouter. Konsekuensinya harus ditulis eksplisit di laporan:
     a. JUMLAH TOKEN TIDAK TERPENGARUH. Kuantisasi mengubah presisi bobot, bukan
        tokenizer. Jadi angka I, O, dan C × (I + O) tetap valid untuk sizing.
     b. AKURASI di OpenRouter adalah BATAS BAWAH. Bila kualitas verdict sudah memadai
        saat diukur di sini, di Netra semestinya sama atau lebih baik. Jangan dibalik:
        jangan mengklaim akurasi Netra berdasarkan hasil OpenRouter.
     c. MEMORI BOBOT JUSTRU LEBIH BESAR di Netra. Kuantisasi lebih sedikit = byte per
        parameter lebih banyak. Karena itu di Fase 4, ukuran bobot model WAJIB dihitung
        memakai presisi yang benar-benar dipakai Netra (konfirmasi ke vendor), BUKAN
        presisi provider OpenRouter. Sajikan minimal dua skenario presisi bila belum pasti.

5) Kunci provider di OpenRouter.
   OpenRouter adalah agregator — satu slug bisa dilayani beberapa provider dengan
   kuantisasi, context limit, dan cara menghitung usage berbeda. Pin provider secara
   eksplisit dan matikan fallback (body: provider { order: [...], allow_fallbacks: false }),
   catat provider di setiap baris telemetri. Tanpa ini, distribusi token bisa berubah
   di tengah pengukuran tanpa disadari.

6) Samakan parameter yang memengaruhi jumlah token: mode thinking/reasoning (aktif? level?),
   max_tokens, dan apakah tool-calling native atau lewat prompt. Dokumentasikan, karena
   parameter yang sama harus dipakai saat validasi di Netra nanti.

Keluaran: docs/model-parity.md — model Netra (atau status blocker-nya), slug OpenRouter
yang dipakai, provider yang dipin, hasil uji tokenizer, presisi/kuantisasi kedua sisi,
dan daftar perbedaan yang tersisa.

=========================================================================
FASE 1 — Overhead statis (tanpa menjalankan aplikasi)
Pakai tokenizer yang sudah diverifikasi. Hitung token untuk:
  - system prompt dasar + aturan integritas anti-hallucination (engine.ts)
  - persona agent terpanjang di database / agentTemplates
  - JSON schema SELURUH MCP tool yang biasa ter-attach — per tool DAN totalnya
  - schema output verdict (AmlVerdictSchema) bila dikirim sebagai instruksi
  - satu hasil retrieval knowledge base (ukuran chunk × top-k yang dipakai kbClient)
  - satu contoh pesan MT (MT103/MT202) berukuran wajar
  - satu gambar dokumen ukuran wajar → berapa token di model vision (jalur visionExtract)
Output: tabel "komponen → token" + subtotal "overhead tetap per panggilan".
Overhead tetap ini dikalikan jumlah iterasi ReAct, jadi dampaknya besar.

=========================================================================
FASE 2 — Instrumentasi runtime (inti pekerjaan)
Buat migrasi tabel `llm_usage_events`, minimal:
  id, created_at, request_id, agent_id, thread_id, step_index (iterasi ReAct ke-berapa),
  call_site ('engine.react.stream' / 'engine.react' / 'chatTitle' / 'autofill' /
             'visionExtract' / 'qwenDocExam' / dst),
  model_slug, model_kind ('text' | 'vision'), provider, quantization (bila diketahui),
  runtime_mode ('openrouter' | 'netra_onprem'),
  prompt_tokens, completion_tokens, total_tokens, reasoning_tokens,
  image_count, image_tokens,
  tool_calls_count, tools_attached_count, tool_result_tokens,
  latency_ms, finish_reason, stream (bool), estimated (bool)
Kolom runtime_mode penting: saat PoC Netra on-prem nanti, skenario yang sama bisa
dijalankan ulang dan dibandingkan langsung dalam satu tabel.

ATURAN PRIVASI — WAJIB:
  JANGAN menyimpan isi prompt, isi pesan MT, nama counterparty, atau hasil tool.
  Hanya ANGKA. Bila perlu korelasi, simpan hash SHA-256 yang tidak bisa dibalik.
  Ini konsisten dengan aturan di env.ts (DATABASE_URL wajib PostgreSQL on-prem,
  bukan layanan cloud) dan lampiran Security Requirement.

Implementasi:
  - Tangkap usage dari respons non-streaming (sudah tersedia di openrouterClient).
  - Untuk ChatOpenAI/LangGraph di engine.ts (~1007 dan ~1249): aktifkan pengambilan
    usage metadata; untuk streaming aktifkan stream_options.include_usage.
  - Bila endpoint tidak mengembalikan usage, hitung dengan tokenizer lokal dan tandai
    estimated = true. Jangan mencampur angka terukur dan estimasi tanpa penanda.
  - Catat SETIAP iterasi ReAct sebagai baris terpisah (step_index).
  - Sediakan agregat peak context per request (maks prompt_tokens dalam satu request).
  - Pastikan jalur vision tercatat dengan image_count/image_tokens terpisah.

=========================================================================
FASE 3 — Skenario nyata & distribusi
Jalankan minimal 5 skenario, masing-masing >=20 kali, memakai model yang sudah
diselaraskan di Fase 0.5:
  S1. Investigasi sanction list, 1 pesan MT, KB aktif (use case utama)
  S2. Investigasi batch, file berisi ~50 transaksi
  S3. Ingest dokumen KB berupa gambar/scan (jalur visionExtract)
  S4. Recipe / Loop Mode (jalur deterministik — buktikan token LLM-nya minim)
  S5. Chat biasa di Playground tanpa tool
Laporkan per skenario: jumlah iterasi ReAct (p50/p95/maks), PEAK CONTEXT (p50/p95/maks),
TOTAL TOKEN PROCESSED (p50/p95/maks), dan proporsi token dari schema tools vs hasil tool
vs output vs reasoning vs image.

=========================================================================
FASE 4 — Keluaran untuk vendor
1) Tentukan C (concurrent) dari asumsi bisnis yang DITULIS EKSPLISIT (jumlah investigator
   aktif bersamaan saat jam sibuk). Tandai sebagai input bisnis, bukan hasil pengukuran.
   Sediakan 3 nilai: konservatif / ekspektasi / puncak.
2) max token per batch = C × (I + O), dengan I = p95 PEAK CONTEXT dan
   O = p95 completion tokens (termasuk reasoning). Jelaskan kenapa p95, bukan rata-rata.
3) Estimasi KV cache, tampilkan rumus dan variabelnya:
      KV_bytes = 2 × L × H_kv × D_head × bytes_per_element × T_total
   L = jumlah layer, H_kv = jumlah KV head (perhatikan GQA), D_head = dimensi per head,
   bytes_per_element sesuai presisi KV (FP8 = 1, FP16 = 2), T_total = C × (I + O).
   Ambil L/H_kv/D_head dari config model target; bila tidak dapat diakses, buat TABEL
   PARAMETRIK dan tandai sebagai asumsi yang harus dikonfirmasi ke vendor.
   CATATAN: bagian ini TIDAK dapat divalidasi lewat OpenRouter — murni estimasi on-prem.
4) Total VRAM ≈ bobot model + KV cache + overhead runtime. Bandingkan dengan aturan vendor
   90% VRAM untuk LLM, dan versi 60–70% karena GPU juga dipakai beban lain.
   Tabel: skenario C → T_total → KV → total VRAM → muat di GPU apa.
5) Arah sebaliknya: bila hanya X GB VRAM tersedia untuk LLM, berapa C maksimum yang dilayani.

=========================================================================
FASE 5 — Optimasi berbasis data (usulkan, jangan langsung terapkan)
Urutkan berdasarkan dampak menurut angka Fase 3:
  - kurangi jumlah tool ter-attach per agent (schema dikirim ulang tiap iterasi)
  - ringkas/potong hasil tool sebelum masuk context
  - batasi jumlah iterasi ReAct
  - pindahkan alur mekanis ke Recipe/Loop Mode yang tidak memanggil LLM
  - atur max_tokens per call-site
  - evaluasi mode thinking: berapa token yang dihabiskan, apakah sepadan
  - jalur vision: turunkan resolusi/tile bila memungkinkan
Setiap usulan wajib disertai estimasi penghematan token dari data Fase 3.

=========================================================================
FASE 6 — Keluaran akhir
Buat docs/token-and-memory-sizing.md berisi:
  - metodologi: slug OpenRouter, provider yang dipin, tokenizer, presisi/kuantisasi,
    tanggal, jumlah sampel
  - tabel Fase 1, 3, 4
  - satu halaman ringkas siap dikirim ke vendor: C, I, O, C × (I + O), estimasi memori,
    dan seluruh asumsi
  - pemisahan tegas: ANGKA TERUKUR (token) vs ESTIMASI (VRAM) vs ASUMSI BISNIS (C)
  - biaya OpenRouter per skenario (relevan untuk anggaran selama masa transisi ini)
  - checklist "yang harus diukur ulang saat PoC Netra on-prem": throughput, TTFT,
    latensi, VRAM aktual, dan verifikasi jumlah token benar-benar sama

BATASAN
- Jangan menyimpan atau mencetak isi payload; hanya angka dan hash.
- Instrumentasi harus pasif dan bisa dimatikan lewat env
  (LLM_USAGE_TELEMETRY=on|off, default off di produksi). Jangan mengubah perilaku agent.
- Jangan memakai data nasabah asli. OpenRouter adalah layanan cloud pihak ketiga;
  pakai data sintetis berukuran realistis.
- Jangan mengarang slug model, angka, maupun config. Bila tidak terukur, tulis
  "tidak terukur" beserta alasannya.

Kerjakan FASE 0 dan FASE 0.5 lebih dulu, tunjukkan tabel ketidakcocokan dan hasil uji
tokenizer, lalu TUNGGU konfirmasi sebelum membuat migrasi apa pun di FASE 2.
```

---

## Catatan

- **Satu syarat yang menentukan segalanya: modelnya harus sama.** Rifky sudah mengonfirmasi pengukuran di OpenRouter valid asal Qwen-nya sama dengan yang dilayani Netra. Masalahnya, default di kode sekarang `qwen/qwen-plus` — Qwen berpemilik yang dilayani sebagai API, yang kemungkinan bukan model yang sama. Konfirmasi dulu ke Rifky model persisnya, baru pilih slug OpenRouter yang cocok.
- **Kuantisasi berbeda, dan itu ada untungnya.** Netra memakai kuantisasi lebih sedikit → akurasi lebih tinggi. Efeknya: jumlah token tidak berubah (tokenizer sama, jadi angka sizing tetap valid), akurasi yang kamu ukur di OpenRouter jadi batas bawah, tetapi **memori bobot di Netra justru lebih besar** — jadi hitungan VRAM wajib memakai presisi Netra, bukan presisi provider OpenRouter.
- **Jalur vision itu baru dan mudah terlewat.** `visionExtract.ts` memakai model VL untuk ingest dokumen gambar ke knowledge base. Token gambar dihitung per tile, jadi tidak boleh dijumlahkan begitu saja dengan token teks.
- **Pin provider di OpenRouter**, kalau tidak distribusi tokenmu bisa berubah diam-diam di tengah pengukuran.
