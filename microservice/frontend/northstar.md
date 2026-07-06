# AMADEUS MULTI-AGENT ORCHESTRATOR — THE NORTH STAR
**Document Version:** 2.0 (MCP-First Architecture)
**Project Mission:** Membangun *Stateful Multi-Agent Orchestrator* yang aman, *CISO-compliant*, dan terukur untuk mengotomatisasi *settlement* Import LC/SKBDN/SBLC di ekosistem perbankan. Menggantikan *handoff* manual menjadi koordinasi mulus antara Agentic AI dan robot RPA (UiPath & Power Automate).

## 1. THE NON-NEGOTIABLES (Batasan Mutlak Sistem)
Ini adalah aturan dasar arsitektur yang tidak boleh dilanggar oleh komponen apa pun yang akan dibangun:
*   **Tech Stack Utama:** TypeScript / Node.js (sebagai pengganti Python FastAPI legacy).
*   **Database:** PostgreSQL (*On-Premise*) dengan *Prepared Statements* wajib.
*   **Kepatuhan Keamanan (CISO Controls):**
    *   *Dual Authentication:* `X-Robot-Key` (Argon2 hash) untuk internal, dan *Signature* `HMAC-SHA512` untuk transaksi finansial (anti-replay).
    *   *Audit Trail:* *Append-only transaction events* yang direkam secara presisi.
    *   *State Integrity:* *Optimistic locking* dan *Idempotency* mutlak untuk mencegah data ganda atau loncatan status tak wajar.
*   **Agnostik & Air-Gapped Ready:** Integrasi LLM harus dirancang agnostik (siap untuk model *on-premise*/lokal).
*   **MCP-First Architecture:** Integrasi ke sistem eksternal (UiPath, Power Automate, OCR, Eximbills) **WAJIB** dibangun sebagai *Standalone MCP Server*, bukan *adapter* yang menyatu dengan *core orchestrator*.

## 2. ARCHITECTURAL BLUEPRINT (Peta Bangunan)
Sistem ini tidak dibangun sekaligus, melainkan berlapis seperti fondasi gedung:

*   **[ SELESAI ] Layer 1: Transaction State Tracker (Sang Wasit)**
    Fondasi *database*, mesin status (*state machine*), *optimistic locking*, dan *middleware* keamanan. Menjamin tidak ada entitas yang bisa mengubah data tanpa izin kriptografis.
*   **[ SELESAI ] Layer 2: A2A Coordination Primitives**
    Protokol *Agent-to-Agent* (A2A). Memastikan *handoff* asinkron dari robot A ke robot B berjalan valid dengan State Tracker sebagai sumber kebenaran.
*   **[ DALAM PROSES ] Layer 3: Enterprise MCP Servers (Lengan Eksekusi)**
    Abstraksi *tools* yang dibungkus dalam *Model Context Protocol* (MCP) untuk memisahkan LLM dari kredensial bank:
    *   `UiPath MCP Server`: Memicu robot via Orchestrator API (mTLS, OAuth2, HMAC-SHA512).
    *   `VisionOCR MCP Server`: Mengubah gambar aplikasi LC menjadi JSON terstruktur.
    *   `Eximbills/SWIFT MCP Server`: Interaksi sistem inti.
*   **[ BACKLOG ] Layer 4: Orchestrator Engine & HITL**
    *Routing* dinamis berbasis LangGraph.js, dan mekanisme *Human-in-the-Loop* (Maker/Checker) terintegrasi OAuth2/JWT untuk *approval* manuasia.

## 3. MASTER PROMPT FOR AI ASSISTANTS
*(Copy-paste blok di bawah ini ke prompt pertama saat membuka sesi AI baru atau menggunakan Claude Code)*

---
**[SYSTEM CONTEXT INJECTION]**
Anda bertindak sebagai Senior Enterprise Architect dan TypeScript/Node.js Expert yang membantu saya membangun "Amadeus Orchestrator" untuk lingkungan perbankan level 1.

**Konteks Proyek:**
Kita sedang me-refactor *codebase* Python *legacy* menjadi infrastruktur TypeScript. Orkestrator ini bertugas menangani alur *settlement* LC/SKBDN (mengkoordinasikan robot UiPath, Power Automate, dan Agen AI). 

**Constraint Wajib:**
1. Hanya gunakan TypeScript/Node.js (TIDAK ADA Python).
2. Terapkan standar *compliance* CISO super ketat: *optimistic locking* di DB (Postgres on-prem), *idempotency*, dan keamanan API berbasis HMAC-SHA512 *signature* serta `X-Robot-Key`.
3. Semua I/O harus bersifat asinkron untuk menjaga skalabilitas.
4. **Wajib menggunakan MCP (Model Context Protocol).** Semua integrasi ke *tools* eksternal (seperti UiPath atau OCR) harus dibangun sebagai *Standalone MCP Server* menggunakan `@modelcontextprotocol/sdk`. Agen AI tidak boleh menembak API eksternal secara langsung.

**Tugas Saat Ini:**
[TULISKAN_TUGAS_SPESIFIK_DI_SINI_MISAL: "Rancang kerangka UiPath MCP Server di TypeScript yang mendaftarkan tool 'trigger_uipath_job', lengkap dengan validasi Zod untuk payload-nya."]
---