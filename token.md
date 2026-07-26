# PROMPT — Ukur Token & Aproksimasi Memori GPU (Amadeus × Netra Runtime)

**Revisi:** pengukuran dilakukan memakai **Qwen yang sama (3.6) via OpenRouter**, karena Netra baru tersedia on-premise nanti. Prompt ini sudah memuat pengaman agar angkanya tetap valid saat dipindah ke Netra on-prem.

Tempel ke Claude Code, dijalankan di root repo `kachponz-main`.

Tujuan akhir: menjawab pertanyaan Rifky (Netra) dengan angka, bukan tebakan —
**"berapa maksimum token dalam satu batch: C concurrent × (I input + O output)?"**

---

## Yang portabel dan yang TIDAK portabel dari OpenRouter ke Netra on-prem

Ini alasan kenapa mengukur di OpenRouter itu sah — asalkan modelnya Qwen yang sama:

| Besaran | Portabel? | Alasan |
|---|---|---|
| Jumlah token prompt & completion | ✅ Ya | Ditentukan tokenizer model, bukan hardware |
| Peak context per request | ✅ Ya | Fungsi dari prompt + schema tools + hasil tool |
| Jumlah iterasi ReAct | ✅ Ya | Ditentukan logika agent |
| `C × (I + O)` untuk sizing | ✅ Ya | Turunan dari tiga baris di atas |
| Throughput (tok/s), TTFT, latensi | ❌ Tidak | Bergantung engine, GPU, batching |
| Kebutuhan VRAM & KV cache | ❌ Tidak langsung | Bergantung presisi (FP8/FP4) & config engine |
| Biaya per token | ❌ Tidak | Model bisnis berbeda (per-token vs langganan) |

Konsekuensinya: hasil pengukuran ini dipakai untuk **sizing memori**, bukan untuk mengklaim performa.

---

```text
KONTEKS
Repo: kachponz-main, service microservice/amadeus-core (Fastify + LangGraph + MCP).
Inferensi lewat endpoint OpenAI-compatible: env NETRA_BASE_URL + NETRA_LLM_MODEL
(src/config/env.ts baris 72 & 78; default model 'qwen3.6-35b').

RENCANA: Netra Runtime akan dipakai ON-PREMISE nanti (saat ini vendor kehabisan GPU).
Untuk sekarang pengukuran dilakukan lewat OpenRouter DENGAN MODEL QWEN YANG SAMA (seri 3.6),
supaya jumlah token yang terukur tetap valid ketika nanti dipindah ke Netra on-prem.

Vendor meminta satu angka untuk sizing GPU:
  max token per batch = C × (I + O)
  C = request bersamaan, I = rata-rata token input, O = rata-rata token output.
Aturan sizing vendor: di produksi ~90% VRAM untuk bobot model + KV cache
(diturunkan ke 60–70% bila GPU dipakai beban lain); minimum VRAM = ukuran file model.

PRINSIP YANG HARUS DIPEGANG
Yang portabel dari OpenRouter ke on-prem HANYA jumlah token (prompt/completion/peak context)
dan jumlah iterasi ReAct. Throughput, latensi, VRAM, dan biaya TIDAK portabel.
Setiap tabel keluaran wajib menandai mana yang portabel dan mana yang tidak.

MASALAH KHUSUS APLIKASI INI (jangan pakai asumsi chatbot biasa)
Token di aplikasi ini tidak didominasi prompt user, melainkan:
  1. Schema seluruh MCP tool yang di-inject ke context setiap panggilan.
  2. Loop ReAct: tiap iterasi mengirim ULANG seluruh percakapan + hasil tool sebelumnya.
  3. Hasil tool (retrieval knowledge base, output UiPath) yang bisa besar.
  4. Thinking / reasoning tokens.
Karena itu WAJIB dibedakan, jangan dicampur:
  A. PEAK CONTEXT per request = token RESIDEN pada iterasi terakhir
     (system prompt + schema tools + history + semua observasi tool + output)
     → menentukan KV cache / memori. Ini yang dipakai sebagai I.
  B. TOTAL TOKEN PROCESSED per request = penjumlahan seluruh iterasi ReAct
     → menentukan throughput dan biaya.

YANG SUDAH ADA DI KODE (verifikasi dulu, jangan percaya begitu saja)
- src/orchestrator/executors/netraClient.ts sudah mem-parse `usage`
  (prompt_tokens / completion_tokens / total_tokens) sekitar baris 60–63 dan 137–143,
  tetapi tampaknya tidak disimpan ke mana pun.
- Jalur agent utama memakai ChatOpenAI + LangGraph di src/orchestrator/engine.ts
  (runAgenticStep / runAgenticStepStream) — periksa apakah usage metadata ditangkap di sana.
  Untuk respons streaming, usage umumnya baru muncul bila stream_options.include_usage aktif.
- Belum ada tabel telemetri token (migrations hanya punya uipath_job_trace).
- max_tokens sudah dipatok di beberapa executor: recommendationClient 150, chatTitleClient 20,
  autofillClient 200, qwenDocExamExecutor 1024 — masukkan ke inventaris.

=========================================================================
FASE 0 — Inventaris titik panggilan LLM
Daftarkan SEMUA lokasi kode yang memanggil LLM (file:baris); untuk masing-masing catat:
streaming atau tidak, bagian dari loop ReAct atau bukan, tools ter-attach atau tidak, max_tokens.
Sajikan sebagai tabel. Jangan lanjut sebelum tabel ini lengkap.

=========================================================================
FASE 0.5 — PARITAS MODEL & TOKENIZER  (WAJIB, jangan dilewati)
Ini yang menentukan apakah hasil pengukuran boleh dipakai untuk sizing on-prem.

1) Cari di katalog OpenRouter model Qwen seri 3.6 yang paling dekat dengan target on-prem
   (target vendor: Qwen3.6-35B-A3B; default di kode: 'qwen3.6-35b').
   Laporkan slug persisnya. JANGAN mengarang slug — verifikasi ke katalog/API OpenRouter.
   Bila varian A3B tidak tersedia, pilih Qwen seri 3.6 terdekat dan CATAT perbedaannya.

2) Buktikan tokenizer-nya identik, jangan diasumsikan:
   - Ambil tokenizer resmi model target (tokenizer.json / tokenizer_config.json).
   - Siapkan 10 sampel teks yang mewakili beban nyata: potongan pesan MT, JSON schema tool,
     hasil retrieval KB, teks Indonesia, teks campur Inggris-Indonesia, angka & kode.
   - Hitung token tiap sampel dengan tokenizer lokal, lalu bandingkan dengan `usage.prompt_tokens`
     yang dilaporkan OpenRouter untuk prompt yang sama persis.
   - Sajikan tabel selisih (absolut & persen). Bila selisih > 2%, JANGAN lanjut:
     laporkan dan usulkan model pengganti. Selisih besar berarti tokenizer atau
     normalisasi accounting-nya berbeda, sehingga angka sizing jadi tidak valid.

3) Kunci provider di OpenRouter:
   OpenRouter adalah agregator — satu slug bisa dilayani beberapa provider dengan
   context limit, kuantisasi, dan cara menghitung usage yang berbeda.
   Karena itu: pin provider secara eksplisit dan matikan fallback
   (mis. body `provider: { order: [...], allow_fallbacks: false }`),
   lalu catat provider mana yang dipakai di setiap baris telemetri.
   Tanpa ini, distribusi token bisa berubah di tengah pengukuran tanpa disadari.

4) Samakan parameter yang memengaruhi jumlah token:
   - reasoning/thinking: catat apakah aktif dan pada level apa; bila endpoint melaporkan
     reasoning_tokens terpisah, simpan sendiri. Perbedaan mode thinking mengubah O secara drastis.
   - max_tokens, temperature, dan apakah tool-calling native atau lewat prompt.
   Dokumentasikan semuanya; nanti parameter yang sama harus dipakai saat validasi di Netra.

5) Tulis file docs/model-parity.md berisi: slug OpenRouter, provider yang dipin,
   model target on-prem, hasil uji tokenizer, dan daftar perbedaan yang tersisa.

=========================================================================
FASE 1 — Overhead statis (tanpa menjalankan aplikasi)
Pakai tokenizer Qwen yang sudah diverifikasi di Fase 0.5. Hitung token untuk:
  - system prompt dasar + ANTI_HALLUCINATION_SUFFIX (engine.ts)
  - persona agent terpanjang yang ada di database / agentTemplates
  - JSON schema SELURUH MCP tool yang biasa ter-attach — per tool DAN totalnya
  - schema output verdict (AmlVerdictSchema) bila dikirim sebagai instruksi
  - satu hasil retrieval knowledge base (ukuran chunk × top-k yang dipakai kbClient)
  - satu contoh pesan MT (MT103/MT202) berukuran wajar
Output: tabel "komponen → token" + subtotal "overhead tetap per panggilan".
Overhead tetap ini dikalikan jumlah iterasi ReAct, jadi dampaknya besar.

=========================================================================
FASE 2 — Instrumentasi runtime (inti pekerjaan)
Buat migrasi tabel `llm_usage_events` minimal berisi:
  id, created_at, request_id, agent_id, thread_id, step_index (iterasi ReAct ke-berapa),
  call_site ('engine.react' / 'chatTitle' / 'autofill' / dst),
  model_slug, provider (untuk OpenRouter), runtime_mode ('openrouter' | 'netra_onprem'),
  prompt_tokens, completion_tokens, total_tokens, reasoning_tokens,
  tool_calls_count, tools_attached_count, tool_result_tokens,
  latency_ms, finish_reason, stream (bool), estimated (bool)
Kolom runtime_mode penting: nanti saat PoC Netra on-prem, pengukuran yang sama
bisa dijalankan ulang dan dibandingkan langsung dalam satu tabel.

ATURAN PRIVASI — WAJIB:
  JANGAN menyimpan isi prompt, isi pesan MT, nama counterparty, atau hasil tool.
  Hanya ANGKA. Bila perlu korelasi, simpan hash SHA-256 yang tidak bisa dibalik.
  Ini konsisten dengan larangan egress data di netraClient.ts dan lampiran Security Requirement.

Implementasi:
  - Tangkap usage dari respons non-streaming (sudah ada di netraClient).
  - Untuk ChatOpenAI/LangGraph: aktifkan pengambilan usage metadata; untuk streaming
    aktifkan stream_options.include_usage bila endpoint mendukung.
  - Bila endpoint tidak mengembalikan usage, hitung dengan tokenizer lokal dan tandai
    estimated = true. Jangan mencampur angka terukur dan estimasi tanpa penanda.
  - Catat SETIAP iterasi ReAct sebagai baris terpisah (step_index).
  - Sediakan agregat peak context per request (maks prompt_tokens dalam satu request).

=========================================================================
FASE 3 — Skenario nyata & distribusi
Jalankan minimal 4 skenario, masing-masing ≥20 kali:
  S1. Investigasi sanction list, 1 pesan MT, KB aktif (use case utama)
  S2. Investigasi batch, file berisi ~50 transaksi
  S3. Recipe / Loop Mode CX100 (jalur deterministik — buktikan token LLM-nya minim)
  S4. Chat biasa di Playground tanpa tool
Laporkan per skenario: jumlah iterasi ReAct (p50/p95/maks),
PEAK CONTEXT (p50/p95/maks), TOTAL TOKEN PROCESSED (p50/p95/maks),
dan proporsi token dari schema tools vs hasil tool vs output vs reasoning.

=========================================================================
FASE 4 — Angka untuk vendor
1) Tentukan C (concurrent) dari asumsi bisnis yang DITULIS EKSPLISIT
   (jumlah investigator aktif bersamaan saat jam sibuk). Tandai sebagai input bisnis,
   bukan hasil pengukuran. Sediakan 3 nilai: konservatif / ekspektasi / puncak.
2) Hitung max token per batch = C × (I + O), dengan I = p95 PEAK CONTEXT
   dan O = p95 completion tokens (termasuk reasoning tokens). Jelaskan kenapa p95, bukan rata-rata.
3) Estimasi KV cache dengan rumus eksplisit beserta variabelnya:
      KV_bytes = 2 × L × H_kv × D_head × bytes_per_element × T_total
   L = jumlah layer, H_kv = jumlah KV head (perhatikan GQA), D_head = dimensi per head,
   bytes_per_element sesuai presisi KV (FP8 = 1, FP16 = 2), T_total = C × (I + O).
   Ambil L / H_kv / D_head dari config model target. Bila tidak dapat diakses, buat TABEL
   PARAMETRIK dan tandai sebagai asumsi yang harus dikonfirmasi ke vendor.
   INGAT: bagian ini TIDAK bisa divalidasi lewat OpenRouter — ini estimasi untuk on-prem.
4) Total VRAM ≈ bobot model + KV cache + overhead runtime; bandingkan dengan aturan
   90% VRAM untuk LLM dan versi 60–70% (karena GPU dipakai beban lain juga).
   Tabel: skenario C → T_total → KV → total VRAM → muat di GPU apa.
5) Arah sebaliknya: bila hanya X GB VRAM tersedia untuk LLM, berapa C maksimum yang bisa dilayani.

=========================================================================
FASE 5 — Optimasi berbasis data (usulkan, jangan langsung terapkan)
Urutkan berdasarkan dampak menurut angka Fase 3, mis.:
  - kurangi jumlah tool ter-attach per agent (schema dikirim ulang tiap iterasi)
  - ringkas/potong hasil tool sebelum masuk context
  - batasi jumlah iterasi ReAct
  - pindahkan alur mekanis ke Recipe/Loop Mode yang tidak memanggil LLM
  - atur max_tokens per call-site
  - evaluasi mode thinking: berapa token yang dihabiskan dan apakah sepadan
Setiap usulan wajib disertai estimasi penghematan token dari data Fase 3.

=========================================================================
FASE 6 — Keluaran akhir
Buat docs/token-and-memory-sizing.md berisi:
  - metodologi: model slug OpenRouter + provider yang dipin, tokenizer, tanggal, jumlah sampel,
    dan pernyataan tegas bahwa pengukuran dilakukan di OpenRouter sebagai proksi tokenizer
  - tabel Fase 1, 3, 4
  - satu halaman ringkas siap dikirim ke vendor: nilai C, I, O, C × (I + O),
    estimasi memori, dan seluruh asumsi
  - pemisahan tegas: ANGKA TERUKUR (token) vs ESTIMASI (VRAM) vs ASUMSI BISNIS (C)
  - checklist "yang harus diukur ulang saat PoC Netra on-prem": throughput, TTFT,
    latensi, VRAM aktual, dan verifikasi bahwa jumlah token benar-benar sama

BATASAN
- Jangan menyimpan atau mencetak isi payload; hanya angka dan hash.
- Jangan mengubah perilaku agent; instrumentasi pasif dan bisa dimatikan lewat env
  (LLM_USAGE_TELEMETRY=on|off, default off di produksi).
- Jangan memakai data nasabah asli; pakai data sintetis berukuran realistis.
  (OpenRouter adalah layanan cloud — mengirim data nasabah ke sana melanggar
  POJK 11/2022, POJK 4/2023, dan SWIFT CSP sebagaimana dicatat di netraClient.ts.)
- Jangan mengklaim performa Netra berdasarkan hasil OpenRouter.
- Jangan mengarang angka. Bila tidak terukur, tulis "tidak terukur" beserta alasannya.

Kerjakan FASE 0 dan FASE 0.5 lebih dulu, tunjukkan hasil uji tokenizer,
dan TUNGGU konfirmasi sebelum membuat migrasi apa pun di FASE 2.
```

---

## Catatan pemakaian

- **Kunci keberhasilannya ada di Fase 0.5.** Kalau tokenizer OpenRouter dan model on-prem tidak sama, seluruh angka sizing jadi tidak valid — karena itu ada gerbang "selisih > 2% → berhenti".
- **Pin provider di OpenRouter.** Satu slug bisa dilayani beberapa provider dengan kuantisasi dan cara menghitung usage berbeda; tanpa dipin, distribusi tokenmu bisa berubah di tengah pengukuran.
- **Mode thinking wajib disamakan.** Ini variabel yang paling mudah membuat `O` meleset jauh, dan di aplikasimu thinking termasuk pembakar token utama.
- Kolom `runtime_mode` disiapkan supaya saat PoC gratis Netra 1 bulan nanti, kamu tinggal menjalankan skenario yang sama dan membandingkannya dalam satu tabel.