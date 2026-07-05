# AMADEUS MULTI-AGENT ORCHESTRATOR — THE NORTH STAR
**Document Version:** 1.0
**Project Mission:** Membangun *Stateful Multi-Agent Orchestrator* yang aman, *CISO-compliant*, dan terukur untuk mengotomatisasi *settlement* Import LC/SKBDN/SBLC, menggantikan *handoff* manual menjadi koordinasi mulus antara Agentic AI dan robot RPA (UiPath & Power Automate).

## 1. THE NON-NEGOTIABLES (Batasan Mutlak Sistem)
Ini adalah aturan dasar arsitektur yang tidak boleh dilanggar oleh komponen apa pun yang akan dibangun:
*   **Tech Stack Utama:** TypeScript / Node.js (sebagai pengganti Python FastAPI legacy).
*   **Database:** PostgreSQL (*On-Premise*) dengan *Prepared Statements* wajib.
*   **Kepatuhan Keamanan (CISO Controls):**
    *   *Dual Authentication:* `X-Robot-Key` (Argon2 hash) untuk internal, dan *Signature* `HMAC-SHA512` untuk transaksi finansial (anti-replay).
    *   *Audit Trail:* *Append-only transaction events* yang direkam secara presisi.
    *   *State Integrity:* *Optimistic locking* dan *Idempotency* mutlak untuk mencegah data ganda atau loncatan status tak wajar.
*   **Agnostik & Air-Gapped Ready:** Integrasi LLM harus dirancang agnostik (siap untuk model *on-premise*/lokal) dan menggunakan protokol komunikasi terstandar seperti MCP (Model Context Protocol).

## 2. ARCHITECTURAL BLUEPRINT (Peta Bangunan)
Sistem ini tidak dibangun sekaligus, melainkan berlapis seperti fondasi gedung:

*   **[ SELESAI ] Layer 1: Transaction State Tracker (Sang Wasit)**
    Fondasi *database*, mesin status (*state machine*), *optimistic locking*, dan *middleware* keamanan. Menjamin tidak ada robot yang bisa mengubah data tanpa izin.
*   **[ SELESAI ] Layer 2: A2A Coordination Primitives**
    Protokol *Agent-to-Agent* (A2A). Memastikan *handoff* asinkron dari robot A ke robot B (misal: RPA 1 -> CTO -> RPA 2 -> Agentic AI) berjalan valid.
*   **[ DALAM PROSES ] Layer 3: Enterprise Adapters (Jalur Komunikasi)**
    Abstraksi *gateway* (*mTLS, Signature*) untuk berinteraksi aman dengan:
    *   Model Vision/OCR (untuk *Document Examination*).
    *   Sistem Core (Eximbills, SWIFT, EMAS, dll).
    *   RPA Trigger (UiPath Orchestrator API / Power Automate Webhook).
*   **[ BACKLOG ] Layer 4: Orchestrator Engine & HITL**
    *Routing* dinamis berbasis LangGraph.js, dan mekanisme *Human-in-the-Loop* (Maker/Checker) terintegrasi OAuth2/JWT untuk *approval* manusia.

## 3. MASTER PROMPT FOR AI ASSISTANTS
*(Copy-paste blok di bawah ini ke prompt pertama saat membuka sesi AI baru atau menggunakan Claude Code)*

---
**[SYSTEM CONTEXT INJECTION]**
Anda bertindak sebagai Senior Enterprise Architect dan TypeScript/Node.js Expert yang membantu saya (seorang Software Engineer ODP IT) membangun "Amadeus Orchestrator". 

**Konteks Proyek:**
Kita sedang me-refactor *codebase* Python *legacy* menjadi infrastruktur TypeScript yang siap masuk ke ranah *production* bank level 1. Orkestrator ini bertugas menangani alur *settlement* LC/SKBDN (mengkoordinasikan robot UiPath, Power Automate, dan Agen AI). 

**Constraint Wajib:**
1. Hanya gunakan TypeScript/Node.js (TIDAK ADA Python).
2. Terapkan standar *compliance* perbankan super ketat: gunakan *optimistic locking* di DB (Postgres on-prem), *idempotency*, dan keamanan API berbasis HMAC-SHA512 *signature* serta `X-Robot-Key`.
3. Semua I/O harus bersifat asinkron untuk menjaga skalabilitas.
4. Desain agen harus mendukung LangGraph.js dan infrastruktur MCP (*Model Context Protocol*), serta siap untuk skenario LLM lokal (*air-gapped*).

**Tugas Saat Ini:**
[TULISKAN_TUGAS_SPESIFIK_DI_SINI_MISAL: "Buat kerangka Enterprise Adapter untuk modul Vision/OCR yang mengubah gambar menjadi JSON, tanpa melanggar struktur CISO di atas."]
---