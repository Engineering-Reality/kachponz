# Deployment Guide — Amadeus Transaction State Tracker

## ⚠️ TLS Requirement (Non-Negotiable)

**This service MUST run behind a TLS-terminating reverse proxy** (Nginx or Traefik
on-premise) in **all environments**, including development when real LC/SWIFT
payloads are involved.

The application itself does not handle TLS — this is intentional. TLS termination
is the responsibility of the reverse proxy layer. Do not expose port 3000 directly
to the network.

**Minimal Nginx config example** (place in `/etc/nginx/conf.d/tracker.conf`):
```nginx
server {
    listen 443 ssl;
    server_name tracker.internal.yourbank.com;

    ssl_certificate     /etc/ssl/certs/tracker.crt;
    ssl_certificate_key /etc/ssl/private/tracker.key;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

---

## Prerequisites

- **Node.js 20.x** (LTS) installed directly on the server. Pin with `.nvmrc`:
  ```
  20
  ```
  Or install via package manager: `apt install nodejs` / `dnf install nodejs`.
- **PostgreSQL 14+** installed on-premise. No Docker, no Supabase.
- No Python dependency — this service is TypeScript/Node.js only.

---

## PostgreSQL Setup (On-Premise, No Docker)

### 1. Install PostgreSQL (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 2. Create database and user
```bash
sudo -u postgres psql << 'EOF'
CREATE USER amadeus WITH PASSWORD 'change_this_in_prod';
CREATE DATABASE amadeus_tracker OWNER amadeus;
GRANT ALL PRIVILEGES ON DATABASE amadeus_tracker TO amadeus;
EOF
```

### 3. Allow service to connect
In `/etc/postgresql/14/main/pg_hba.conf`, add:
```
host    amadeus_tracker    amadeus    127.0.0.1/32    scram-sha-256
```
Then reload: `sudo systemctl reload postgresql`.

---

## Installation

```bash
# Clone / copy the service to the server
cd /opt/amadeus/transaction_tracker

# Install dependencies
npm install --omit=dev

# Copy and fill in environment variables
cp .env.example .env
nano .env   # Set DATABASE_URL, PORT, LOG_LEVEL
```

### `.env` for production
```bash
DATABASE_URL=postgres://amadeus:change_this_in_prod@127.0.0.1:5432/amadeus_tracker
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
DB_POOL_MAX=10
```

---

## Running Migrations

Run this once after installation, and again after any deployment that includes
a new migration file:

```bash
npm run migrate
```

This uses `node-pg-migrate` with the `DATABASE_URL` from `.env`.

---

## Registering a Robot (Onboarding)

Robots (UiPath / Power Automate Desktop) must be registered by an operator with
direct server access. **There is no public HTTP endpoint for this** — by design.

```bash
# On the server:
npm run robot:register -- --name <robot_name> --company <company_uuid>

# Example:
npm run robot:register -- --name "uipath-settlement-01" --company "a1b2c3d4-..."
```

**What happens:**
1. A 32-byte random API key is generated.
2. It is hashed with argon2id and stored in `service_accounts`.
3. The plaintext key is printed **once** to the terminal.
4. The operator copies the key into UiPath Orchestrator as a **Credential Asset**
   named `AmadeusTrackerKey`.

**The key is never stored in plaintext anywhere.** If lost, the account must be
deactivated and a new one registered:
```sql
UPDATE service_accounts SET is_active = false WHERE robot_name = 'uipath-settlement-01';
```

---

## Running the Service

### Development
```bash
npm run dev      # tsx watch — auto-restarts on file change
```

### Production (systemd)
Create `/etc/systemd/system/amadeus-tracker.service`:
```ini
[Unit]
Description=Amadeus Transaction State Tracker
After=network.target postgresql.service

[Service]
Type=simple
User=amadeus
WorkingDirectory=/opt/amadeus/transaction_tracker
EnvironmentFile=/opt/amadeus/transaction_tracker/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
npm run build           # Compile TypeScript → dist/
sudo systemctl daemon-reload
sudo systemctl enable amadeus-tracker
sudo systemctl start amadeus-tracker
sudo journalctl -u amadeus-tracker -f  # Follow logs
```

---

## Health Check

```bash
curl https://tracker.internal.yourbank.com/health
```

Expected response (HTTP 200):
```json
{ "status": "ok", "db": "connected", "timestamp": "2024-01-01T00:00:00.000Z" }
```

If `db` is `"unreachable"`, check the PostgreSQL service and `DATABASE_URL`.

---

## Node.js Version Pinning

The `engines` field in `package.json` enforces Node.js 20:
```json
"engines": { "node": ">=20.0.0 <21" }
```

Use `nvm`, `fnm`, or the OS package manager to ensure the correct version is
installed on each environment (dev, staging, prod). Inconsistent Node.js versions
are a common source of subtle bugs.

---

## Logging

Logs are structured JSON (Pino). In development, they are pretty-printed.
In production, pipe them to your SIEM or log aggregator (e.g., Elasticsearch,
Loki, Splunk):

```bash
# Forward logs to a file (then ship with Filebeat/Promtail)
sudo journalctl -u amadeus-tracker -o json | your-log-shipper
```

Each log line for a request includes `transaction_id` as a correlation ID,
making it easy to trace the full lifecycle of one transaction.
