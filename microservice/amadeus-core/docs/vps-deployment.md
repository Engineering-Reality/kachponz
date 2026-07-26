# VPS Deployment — 2 vCPU / 4 GB (demo/staging only)

> **This deployment target is for demo/staging with SYNTHETIC DATA ONLY.**
> It is not approved for real customer/transaction data: the VPS is a public
> cloud KVM instance with no on-prem network isolation, and `OPENROUTER_*`
> (OpenRouter, routing to third-party model providers) is an external
> third-party inference API — neither meets the on-prem/CISO posture required
> for real financial data. See `docs/deployment.md` for the on-prem production
> posture.

## Minimum spec

- 2 vCPU, 4 GB RAM, ~60 GB NVMe SSD, root access, Ubuntu 22.04 or 24.04.
- One VPS runs the whole stack: amadeus-core, its MCP AutoManager daemon,
  the frontend, PostgreSQL + pgvector, and Nginx.

## Measured footprint (this informed the sizing below)

Using `npm run measure` (`scripts/measure-footprint.mjs`) against this repo's
own dev machine:

| Component | Dev mode (`npm run dev`) | Production mode (build + start) |
|---|---|---|
| Fastify server | 376.5 MB (tsx watch) | 288.2 MB (compiled) |
| mcpAutoManager | 276 MB (2 instances — dev-only quirk, see below) | 73 MB (1 instance) |
| Frontend | 1528.3 MB (`next dev` + Turbopack) | 95.3 MB (standalone) |
| PostgreSQL (idle) | 30.4 MB | 30.3 MB |
| MCP tool child ×2 | 152 MB | 184.3 MB |
| **Total (idle)** | **~2.36 GB** | **~671 MB** |

Never deploy in dev mode (`npm run dev`/`next dev`) on the VPS — beyond the
doc's own warning that `tsx watch` is a dev-time tool, it also measures
~3.5x heavier than the production path, almost entirely from Next.js dev
tooling (Turbopack, HMR, source maps). The dev-mode mcpAutoManager number is
inflated further by an unrelated dev-only quirk: `src/server.ts` auto-spawns
its own `mcpAutoManager.ts` copy when `NODE_ENV=development`, on top of the
one `npm run dev`'s `concurrently` already starts — harmless in dev, but not
representative of production, where that guard means only one instance ever
runs.

~671 MB idle leaves ample headroom in 4 GB for PostgreSQL, OS, Nginx, swap
safety margin, and concurrent request handling — see "Capacity ceiling"
below for what that headroom is actually good for.

## Port table

| Port | Service | Exposed to |
|---|---|---|
| 443 | Nginx (TLS) | Public internet |
| 3000 | Frontend (Next.js standalone) | 127.0.0.1 only (via Nginx) |
| 8080 (or `PORT` in `.env`) | amadeus-core Fastify API | 127.0.0.1 only (via Nginx) |
| 5432 | PostgreSQL | 127.0.0.1 only, never exposed |
| 10000-11999 | MCP tool child processes (`config/port_range.json`) | 127.0.0.1 only, never exposed — internal to amadeus-core/mcpAutoManager |

`HOST=127.0.0.1` in amadeus-core's `.env` and `HOSTNAME=127.0.0.1` in the
frontend's systemd unit are both load-bearing for this — nothing binds
`0.0.0.0`; Nginx is the only public listener.

## Install from zero

1. **OS packages**: `sudo apt update && sudo apt install -y nginx postgresql-16 postgresql-16-pgvector nodejs npm` (Ubuntu 24.04 ships `postgresql-16-pgvector` directly in `universe` — confirmed via `apt-cache policy`. On 22.04, if it's not available, add the PGDG apt repo first.) Pin Node to the `engines.node` range (`>=20 <23`) via nvm or NodeSource if the distro package is newer.
2. **Service user**: `sudo useradd --system --home /opt/amadeus --shell /usr/sbin/nologin amadeus`, then `sudo mkdir -p /opt/amadeus && sudo chown amadeus:amadeus /opt/amadeus`.
3. **Deploy code**: build on CI/locally, ship the built artifacts (not source + devDependencies) to `/opt/amadeus`:
   - amadeus-core: `npm ci --omit=dev && npm run build`, then ship `dist/`, `node_modules/` (production only), `package.json`, `migrations/`, `db/`, `config/`, `.env` (created on the VPS, never committed).
   - frontend: `npm ci && npm run build` (Next.js needs devDependencies to build — build elsewhere or accept building once on the VPS with swap as a safety net, per the "don't build Next.js on a 4GB VPS if avoidable" guidance), then ship `.next/standalone/`, and **copy** `.next/static` → `.next/standalone/.next/static` and `public/` → `.next/standalone/public/` (the standalone output does not include these on its own — verified while measuring footprint above; the server fails to serve assets without this step).
4. **Database**: `sudo -u postgres createuser amadeus --pwprompt`, `sudo -u postgres createdb amadeus -O amadeus`, apply `db/postgresql-vps-tuning.conf` (copy to `/etc/postgresql/16/main/conf.d/`, then `sudo systemctl reload postgresql`), then from `/opt/amadeus/microservice/amadeus-core`: `npm run migrate:up`.
5. **`.env` files** (mode 600, owned by `amadeus`, never in git):
   - `/opt/amadeus/microservice/amadeus-core/.env` — see required vars below.
   - `/opt/amadeus/microservice/frontend/.next/standalone/.env.local` — `AMADEUS_API_URL=http://127.0.0.1:8080`, `AMADEUS_JWT_SECRET` (must match amadeus-core's `OAUTH2_JWT_SECRET`).
6. **systemd units**: copy `deploy/systemd/*.service` to `/etc/systemd/system/`, adjust `WorkingDirectory`/paths if not using `/opt/amadeus`, then:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now amadeus-core amadeus-mcp-manager amadeus-frontend
   ```
7. **Nginx**: copy `deploy/nginx/amadeus.conf` to `/etc/nginx/sites-available/`, symlink into `sites-enabled`, adjust `server_name`/cert paths, `sudo nginx -t && sudo systemctl reload nginx`.
8. **Swap** (safety net, not a substitute for the sizing above):
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   sudo sysctl vm.swappiness=10 && echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
   ```
9. **Backups**: `deploy/scripts/backup-postgres.sh` via cron, e.g. `0 3 * * * DATABASE_URL=postgres://amadeus:***@127.0.0.1/amadeus /opt/amadeus/deploy/scripts/backup-postgres.sh /opt/amadeus/backups 14` (as the `amadeus` user, or any user with local `pg_dump` access). Restore with `pg_restore -d amadeus /opt/amadeus/backups/amadeus-<timestamp>.dump` (run migrations afterward if the backup predates schema changes).
10. **Verify**: `curl https://amadeus.internal.example.com/` (frontend), `curl https://api.amadeus.internal.example.com/health` (backend — expect `{"status":"ok","db":"up",...}`), `journalctl -u amadeus-core -u amadeus-mcp-manager -u amadeus-frontend -f`.

## Required `.env` vars (amadeus-core)

| Var | Notes |
|---|---|
| `DATABASE_URL` | `postgres://amadeus:***@127.0.0.1:5432/amadeus` |
| `HOST` | Leave as `127.0.0.1` — do not change |
| `OAUTH2_JWT_SECRET` | Must match the frontend's `AMADEUS_JWT_SECRET` |
| `OPENROUTER_API_KEY` | OpenRouter key (see `src/config/env.ts` — `OPENROUTER_BASE_URL`/`_VL_MODEL`/`_LLM_MODEL` have sane Qwen defaults) |
| `PG_POOL_MAX` | Default 10 — keep ≤ (`max_connections` in `db/postgresql-vps-tuning.conf`, minus headroom) |
| `MCP_MAX_LIVE_TOOLS` | Optional — cap concurrent `'sse'` MCP tools, see "Capacity ceiling" |
| `MCP_IDLE_TIMEOUT_MS` | Optional — stop unused `'sse'` tools after N ms, respawns on next use (~10s + startup latency) |

Anything else in `EnvSchema` (`src/config/env.ts`) not listed here has a
working default or is optional (UiPath/PAD/SMTP integrations — only needed
if those integrations are actually used).

## Update / rollback procedure

```bash
# Update: build new artifacts off-VPS, then on the VPS —
sudo systemctl stop amadeus-core amadeus-mcp-manager amadeus-frontend
# swap in new dist/, node_modules/, .next/standalone/ (keep the previous
# ones alongside under a versioned dir, e.g. releases/<git-sha>/, symlinked
# from /opt/amadeus/current, for an easy rollback)
cd /opt/amadeus/microservice/amadeus-core && npm run migrate:up
sudo systemctl start amadeus-core amadeus-mcp-manager amadeus-frontend

# Rollback: repoint the /opt/amadeus/current symlink at the previous
# releases/<git-sha>/ directory, restart the three units. Only run
# `migrate:down` if the new release's migration is confirmed safe to
# reverse (check the migration file's down() — some, like
# 1795000000000_add_rag.ts, drop data on the way down).
```

## Capacity ceiling (honest numbers, not assumptions)

- Idle footprint (~671 MB) leaves roughly 2.5-3 GB of headroom on a 4 GB box
  after PostgreSQL (~256 MB shared_buffers + connection overhead) and OS/Nginx
  (~300-500 MB) — but MCP tool children add ~90 MB *each* while running (see
  measured table above), and each concurrent agent invocation adds its own
  transient memory for the LangGraph run + any `'stdio'` tool spawned
  on-demand for that request.
- With no `MCP_MAX_LIVE_TOOLS` cap, every `'sse'`-method tool marked `Online`
  stays running permanently — on a 4 GB box, budget for roughly **4-6
  concurrent live `'sse'` tools** (~90MB each) before other headroom gets
  tight; set `MCP_MAX_LIVE_TOOLS` explicitly rather than relying on however
  many tools happen to be marked Online.
- `MCP_IDLE_TIMEOUT_MS` trades a cold-start latency (confirmed in testing:
  the manager's next sync tick, ≤10s, plus ~1-3s for the tool to report
  live — `src/orchestrator/engine.ts`'s SSE ready-wait absorbs some but not
  all of this) for not paying the ~90MB/tool cost for tools that aren't
  actively in use. Reasonable for a demo box with sporadic traffic; not
  recommended if you need consistently low first-call latency.
- Concurrent agent invocations aren't free either — each holds a LangGraph
  run in memory for the duration of the request (`AGENT_WALL_CLOCK_TIMEOUT_MS`,
  default 15 min, caps the worst case) plus, for `'stdio'`-method tools, a
  freshly spawned child process per connection (closed when the client
  disconnects, per `runAgenticStep`'s `finally` block) — this wasn't
  independently measured under load in this pass; treat 2-3 concurrent
  invocations as a reasonable starting assumption for 2 vCPU and re-measure
  with `npm run measure -- --label during-invoke` under real traffic before
  trusting a higher number.
- Symptoms when the ceiling is hit: OOM-killed processes (check
  `dmesg`/`journalctl -k` for `oom-kill` entries naming `node`), or — before
  it gets that far — the 2GB swap filling up and everything getting
  noticeably slower (swap I/O on top of NVMe is still far slower than RAM).
  systemd's `Restart=on-failure` will bring a killed service back, but that's
  a recovery mechanism, not a capacity plan — if you see repeated restarts
  in `journalctl`, that's the signal to lower `MCP_MAX_LIVE_TOOLS`, add
  `MCP_IDLE_TIMEOUT_MS`, or move to a bigger box.
