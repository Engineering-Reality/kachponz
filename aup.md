# Claude Code Prompt — AML/CFT Detection Knowledge Base + Agent

## Konteks
Amadeus (`ponzgen` / `kachponz-main`) butuh fitur baru: agent yang mendeteksi
indikasi APU-PPT (AML/CFT) dari pesan transaksi — MT103, MT202, dan ISO 20022
`pacs.008`. Agent ini butuh RAG knowledge base (misalnya SDN list, daftar
negara berisiko tinggi, daftar bank tersanksi) sebagai referensi saat
melakukan screening.

## Keputusan Arsitektur (ikuti ini, jangan improvisasi ulang)

1. **UI Knowledge Base menyatu di dalam Agent Creator — TIDAK bikin
   halaman/nav item baru.** Revisi dari draf awal: awalnya direncanakan
   halaman `/knowledge-base` terpisah, tapi diputuskan itu berlebihan
   untuk kebutuhan sekarang — cukup section upload/manage dokumen yang
   muncul (expand/collapse) di dalam form `agent-creator/page.tsx` saat
   toggle "agent ini pakai knowledge base" dinyalakan. Jangan tambah
   entry baru di `AppShell.tsx` nav.

2. **Tapi data model backend-nya TETAP entity terpisah (bukan field
   mentah di tabel `agents`), supaya reusable lintas agent.** SDN list
   adalah data referensi yang berpotensi dipakai lebih dari satu agent
   ke depan — kalau disimpan sebagai field per-agent, update SDN list
   harus diulang manual di tiap agent dan berisiko data agent tak sinkron.
   Jadi: `knowledge_bases` + `kb_documents` tetap tabel sendiri (lihat
   Task 1), agent hanya menyimpan referensi via `knowledge_base_ids:
   string[]` — sama pola seperti field `tools` yang sudah ada di schema
   agent. UI create/upload KB tinggal dipanggil dari dalam Agent Creator,
   bukan dari halaman terpisah.

3. **Format input dokumen: PDF, image, TXT.**
   - Endpoint ingestion KB baru terima ketiganya dari awal.
   - Playground (`playground/page.tsx` baris ~1329, `accept="image/*,.pdf"`)
     ditambah `.txt` ke accept list untuk chat attachment biasa (terpisah
     dari flow ingestion KB).

4. **Queue ke bot email: pakai Postgres outbox table, bukan Redis/BullMQ.**
   Konsisten dengan constraint 2GB RAM VPS dan pola in-memory EventEmitter
   yang sudah dipakai untuk SSE — jangan tambah dependency broker baru kecuali
   memang diminta belakangan.

## Task 1 — Migration: tabel Knowledge Base

Buat migration baru (`microservice/amadeus-core/migrations/`) mengikuti pola
migration yang sudah ada (lihat `1796000000000_add_feature_sharing.ts` untuk
gaya penulisan):

- `knowledge_bases` (kb_id uuid pk, company_id, name, description, created_at)
- `kb_documents` (doc_id uuid pk, kb_id fk, filename, file_type enum
  ['pdf','image','txt'], raw_text, embedding vector, uploaded_at, status
  ['processing','ready','failed'])
- `agent_knowledge_bases` (agent_id fk, kb_id fk) — tabel junction, karena
  satu agent bisa pakai lebih dari satu KB (mis. SDN list + daftar negara
  berisiko sekaligus)
- `alert_outbox` (alert_id uuid pk, transaction_ref, payload jsonb,
  status ['pending','sent','failed'], created_at, sent_at)

Semua multi-statement write pakai RPC function via `callFn()` sesuai
konvensi codebase yang sudah ada — jangan raw multi-query di route handler.

## Task 2 — Backend: routes Knowledge Base

Route baru `microservice/amadeus-core/src/routes/knowledgeBase.ts`:
- `POST /knowledge-bases` — create KB
- `GET /knowledge-bases` — list per company
- `POST /knowledge-bases/:id/documents` — upload dokumen (multipart, terima
  pdf/image/txt), extract text (untuk pdf pakai lib yang sudah ada di
  project kalau ada, untuk image pakai OCR ringan — cek dulu apakah ada
  dependency OCR yang sudah terpasang sebelum nambah baru), lalu generate
  embedding dan simpan.
- `DELETE /knowledge-bases/:id/documents/:docId`

**Penting soal embedding**: JANGAN pakai ulang pendekatan legacy Python (CLIP
ViT-Large, 768-dim, self-hosted) — itu sudah diputuskan terlalu berat untuk
target 2GB RAM. Pakai embedding API dari Netra Runtime (OpenAI-compatible)
yang sudah dipakai project ini, bukan model lokal baru.

## Task 3 — Frontend: section Knowledge Base di dalam Agent Creator

Tidak bikin halaman baru. Di `agent-creator/page.tsx`, tambah:
- Toggle "Gunakan Knowledge Base" pada form agent.
- Kalau aktif, muncul section (bisa collapsible) berisi: pilih KB yang
  sudah ada (`knowledge_base_ids`, multi-select, fetch dari `GET
  /knowledge-bases`) ATAU buat KB baru + upload dokumen langsung dari
  situ (accept `.pdf,image/*,.txt`), tampilkan status
  processing/ready/failed per dokumen.
- Taruh section ini berdampingan dengan field `tools` yang sudah ada,
  jangan bikin section UI yang terlalu mencolok/berat — tetap ringkas,
  konsisten sama density form yang sudah ada.

## Task 3b — Tool retrieval KB (WAJIB, jangan skip)

System prompt saja TIDAK membuat agent otomatis retrieve dari knowledge
base — itu cuma instruksi behavior. Tanpa tool nyata, LLM akan menjawab dari
pengetahuan umum, bukan dari isi SDN list yang di-upload. Maka:

- Daftarkan tool baru `search_knowledge_base(query: string, kb_id: string)`
  yang melakukan similarity search ke `kb_documents` (embedding via Netra
  Runtime) dan mengembalikan potongan teks relevan.
- Tool ini auto-registered per-agent berdasarkan `knowledge_base_ids` yang
  di-attach di Agent Creator — pola registrasinya ikuti cara tools lain
  di-load per-agent (lihat `loadMcpTools` di `engine.ts`), bukan tool
  global yang tersedia untuk semua agent.
- Sebelum agent memberi verdict, dia harus memanggil tool ini untuk
  setiap nama pihak (ordering customer, beneficiary, ordering institution,
  beneficiary institution, intermediary) yang terdeteksi di pesan transaksi
  input, baru hasilnya dipakai sebagai grounding untuk verdict.
- Kalau flow eksekusi Playground saat ini belum mendukung tool-calling loop
  (baca hasil tool, lanjut mikir, baru jawab akhir) untuk agent non-UiPath,
  itu prasyarat yang harus dicek/dibenerin dulu sebelum fitur ini dianggap
  selesai — jangan biarkan system prompt "retrieval" jalan tanpa tool asli.

## Task 4 — System prompt untuk agent deteksi APU-PPT

Simpan sebagai default `agent_style` yang bisa dipilih saat create agent
tipe "AML/CFT Screening". Agent ini WAJIB retrieve dari knowledge base yang
di-attach (SDN list, negara berisiko, bank tersanksi) sebelum memberi
verdict — jangan biarkan dia menjawab dari pengetahuan umum saja.

```
Anda adalah agent screening AML/CFT (Anti Pencucian Uang dan Pencegahan
Pendanaan Terorisme) untuk Bank Mandiri. Tugas Anda menganalisis satu pesan
transaksi (format MT103, MT202, atau ISO 20022 pacs.008) dan menentukan
apakah transaksi tersebut mengandung indikasi risiko APU-PPT, dengan
merujuk pada knowledge base yang tersedia (SDN list, daftar negara
berisiko tinggi, daftar bank/entitas tersanksi).

ATURAN:
1. Selalu lakukan retrieval ke knowledge base untuk setiap nama pihak
   (ordering customer, beneficiary, ordering institution, beneficiary
   institution, intermediary) yang muncul di pesan sebelum memberi
   kesimpulan. Jangan menjawab berdasar ingatan umum soal sanksi.
2. Periksa hal-hal berikut secara eksplisit:
   - Kecocokan nama/alias pihak dengan entri SDN atau daftar sanksi lain
     di knowledge base (termasuk kemiripan ejaan/transliterasi)
   - Yurisdiksi asal/tujuan dana termasuk negara berisiko tinggi
   - Bank koresponden/perantara yang termasuk entitas tersanksi
   - Pola indikasi structuring (nominal dipecah, mendekati ambang laporan)
   - Ketidaksesuaian antara nilai transaksi, deskripsi barang/jasa (field
     :72 atau RmtInf), dan profil pihak yang terlibat
   - Penggunaan badan hukum/alamat yang lazim dipakai untuk shell company
3. Jangan pernah menyimpulkan "clean" hanya karena tidak ada exact-match
   nama di knowledge base — evaluasi juga red flag kontekstual di atas.
4. Jika data pihak tidak cukup untuk memastikan (mis. nama terpotong,
   alamat tidak lengkap), gunakan verdict "needs_review", jangan
   dipaksakan "clean" atau "hit".

OUTPUT: HANYA JSON valid, tanpa teks lain, dengan schema persis berikut:

{
  "transaction_id": string,
  "message_format": "MT103" | "MT202" | "pacs.008",
  "verdict": "hit" | "clean" | "needs_review",
  "risk_score": number,        // 0-100
  "matched_entities": [
    {
      "party_role": string,     // mis. "beneficiary", "ordering_institution"
      "matched_name": string,
      "kb_source": string,      // dokumen KB mana yang match
      "match_confidence": number // 0-1
    }
  ],
  "red_flags": string[],       // daftar singkat alasan kontekstual (poin 2)
  "reasoning": string,         // 1-3 kalimat, tanpa membocorkan isi KB verbatim
  "recommended_action": "escalate_to_compliance" | "auto_clear" | "manual_review"
}
```

## Task 5 — Queue producer + email bot

Setelah agent mengembalikan JSON:
1. Insert ke `alert_outbox` (status `pending`) — bukan langsung kirim email
   dari request handler, biar transaksional dan bisa retry.
2. Worker terpisah (polling ringan tiap beberapa detik, pola mirip worker
   lain yang sudah ada di project — cek dulu apakah sudah ada worker loop
   yang bisa dipakai bareng sebelum bikin proses baru) yang:
   - Ambil baris `pending`
   - Kirim email sesuai `verdict`:
     - `hit` → email ke compliance dengan isi ringkas dari `red_flags` dan
       `matched_entities`
     - `needs_review` → email ke tim ops untuk manual check
     - `clean` → tidak usah kirim email (atau log saja, sesuaikan kebutuhan
       — konfirmasi ke Jandy dulu kalau ambigu)
   - Update status jadi `sent` atau `failed`

## Verifikasi sebelum selesai
- Jalankan lint/build project seperti biasa.
- Uji ingestion dengan 1 file PDF, 1 image, 1 txt — pastikan ketiganya
  ke-parse dan embed dengan benar.
- Uji end-to-end pakai beberapa entri dari `swift.txt` (ada label TRUE/FALSE
  HIT di situ) untuk sanity-check verdict agent sebelum dianggap selesai.
- JANGAN modifikasi `buildSystemPrompt` global di `engine.ts` — system
  prompt AML/CFT ini harus jadi `agent_style` per-agent, bukan global
  (sesuai keputusan yang sudah pernah ditegaskan untuk kasus Danantara
  CX100).
