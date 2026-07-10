# Prompt: Decoupling MCP Servers from the Amadeus Monorepo

**Context & Kesadaran Baru (The Epiphany):**
Saat mengevaluasi cara kerja `powerautomate-mcp`, kita menyadari sebuah kesalahan arsitektur fundamental yang terbawa dari *legacy code* (Python). Saat ini, *source code* dari MCP Server milik kita (`microservice/mcp-uipath` dan `microservice/amadeus-mcp`) masih bersarang di dalam *codebase* utama Amadeus (monorepo). 

Padahal, filosofi utama dari **Model Context Protocol (MCP)** adalah **decoupling ekstrim**. Amadeus sebagai "MCP Host/Orchestrator" seharusnya **TIDAK PERNAH** menyimpan atau mempedulikan *source code* dari alat (tools) yang ia panggil. Amadeus seharusnya hanya menjalankan perintah CLI sederhana seperti `npx -y uipath-mcp@latest` dan langsung terhubung melalui `stdio` atau `SSE`.

**Tujuan Refactoring (Goal):**
Tolong buatkan *action plan* dan eksekusi refactoring untuk memecah arsitektur ini agar Amadeus murni menjadi *Orchestrator* yang dinamis.

---

### Instruksi Refactoring (Action Items):

#### 1. Ekstraksi Repositori (Memisahkan MCP Servers)
- Pisahkan folder `microservice/mcp-uipath` dan `microservice/amadeus-mcp` menjadi *repository* Git yang sepenuhnya berdiri sendiri (terpisah dari repo `ponzgen`).
- Pastikan kedua repo tersebut memiliki `package.json` yang dikonfigurasi sebagai *executable* CLI (memiliki *field* `"bin"`), sehingga nantinya bisa di-*publish* ke NPM (atau *private registry*) dan bisa dipanggil menggunakan `npx`.

#### 2. Refactor Amadeus Backend (`mcpAutoManager.ts`)
- Saat ini, `mcpAutoManager.ts` kemungkinan masih melakukan proses *spawn* dengan mengeksekusi *file* lokal (seperti `node ../mcp-uipath/build/index.js`).
- Ubah logikanya agar Amadeus membaca konfigurasi perintah (`command` dan `args`) dari *database* (tabel `tools`).
- Contoh implementasi baru: Jika mendaftarkan UiPath MCP di *database*, Amadeus hanya perlu melakukan spawn:
  ```json
  {
    "command": "npx",
    "args": ["-y", "amadeus-uipath-mcp@latest"]
  }
  ```
- Pastikan manajemen *Environment Variables* (seperti `UIPATH_CLIENT_ID`, kredensial, dll) tetap aman. Kredensial ini harus disuntikkan secara dinamis (via ENV parameter ke proses *child*) oleh Amadeus saat ia menjalankan `npx`, sehingga *package* MCP di NPM tetap sepenuhnya *stateless* dan aman.

#### 3. Pembersihan Codebase (Purging)
- Hapus folder `microservice/mcp-uipath` dan `microservice/amadeus-mcp` dari repositori utama `ponzgen` Amadeus.
- Bersihkan semua *hardcoded path* yang mengarah ke *folder-folder* tersebut di dalam repositori utama.

---

**Pertanyaan/Ekspektasi Output:**
Tolong berikan kode untuk modifikasi `mcpAutoManager.ts` agar mendukung pola eksekusi *command* dinamis ini, dan berikan petunjuk singkat tentang apa saja *field* `package.json` yang harus saya tambahkan ke `mcp-uipath` agar dia *npx-ready*. Mari kita bersihkan sisa-sisa arsitektur monolitik ini!
