# Deployment — Amadeus Orchestrator

## 1. Reverse proxy TLS — WAJIB

Service ini **wajib** berjalan di belakang reverse proxy dengan TLS
(Nginx/Traefik on-prem). **Jangan** ekspos HTTP plain, bahkan di dev — ada
kemungkinan payload sungguhan (SWIFT/LC) lewat.

- App bind ke `127.0.0.1` (lihat `HOST` di `.env`). Hanya proxy yang boleh
  menjangkaunya.
- TLS diterminasi di proxy: TLS 1.3, fallback 1.2 dengan cipher sesuai CISO
  API #9 (`TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`, dst).
- Implementasi TLS = tanggung jawab reverse proxy, **di luar scope kode aplikasi**.

Contoh blok Nginx (referensi, sesuaikan dengan standar infra):

```nginx
server {
    listen 443 ssl;
    server_name amadeus.internal.bankmandiri.co.id;
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## 2. Node.js version pin

`package.json` mem-pin `engines.node` (`>=20 <23`) supaya environment
dev/staging/prod konsisten. Gunakan Node LTS 20 atau 22.

## 3. Database on-prem PostgreSQL

- Lokal/dev: `docker compose up -d postgres` (bind `127.0.0.1:5432`).
- Staging/prod: arahkan `DATABASE_URL` ke instance PostgreSQL **on-prem**
  sesuai standar infra. **Bukan** layanan cloud pihak ketiga (env schema
  menolak non-postgres URL).
- Jalankan migration: `npm run migrate:up`.

## 4. Onboarding robot baru (CLI, bukan endpoint)

Tidak ada endpoint HTTP publik untuk mendaftarkan robot (lubang keamanan).
Gunakan CLI internal — hanya operator dengan akses server/DB:

```bash
# robot non-finansial
npm run robot:register -- --name rpa-distributor --company <company_uuid>

# robot finansial (dapat menyelesaikan step mt_converted/swift_released/settled)
npm run robot:register -- --name rpa-mt-converter --company <company_uuid> \
    --types import_lc,skbdn,sblc --financial
```

Output menampilkan `X-Robot-Key` (dan `Signing-Secret` bila `--financial`)
**satu kali saja**. Salin ke UiPath Orchestrator Asset (credential asset).
Lihat `uipath_integration.md`.

## 5. Startup & health

```bash
npm run build && npm start        # produksi
# atau
npm run dev                        # dev (tsx watch)
```

- `GET /health` → 200 + status koneksi DB (untuk liveness Docker/K8s on-prem).
- Env divalidasi fail-fast saat start; bila `DATABASE_URL` belum di-set,
  proses langsung exit dengan pesan jelas.

## 6. Logging → SIEM

Log berformat JSON (Pino) dengan `transaction_id` sebagai correlation id, dan
secret otomatis di-redact. Forwarding ke SIEM = tanggung jawab infra (mis.
Filebeat/Fluentd membaca stdout).
