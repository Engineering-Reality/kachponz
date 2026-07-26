#!/usr/bin/env bash
# Scheduled pg_dump backup for the amadeus database. Intended to run via
# cron/systemd timer as the postgres user (or any user with pg_dump access
# to this DB) on the VPS. See docs/vps-deployment.md for the restore
# procedure and cron/timer setup.
#
# Usage: DATABASE_URL=postgres://user:pass@127.0.0.1:5432/amadeus \
#          ./backup-postgres.sh [backup-dir] [retention-days]
set -euo pipefail

BACKUP_DIR="${1:-/opt/amadeus/backups}"
RETENTION_DAYS="${2:-14}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL env var is required}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$BACKUP_DIR/amadeus-$TIMESTAMP.dump"

# Custom format (-Fc): compressed, supports selective/parallel restore via
# pg_restore, unlike a plain SQL dump.
pg_dump "$DATABASE_URL" -Fc -f "$DEST"

# 600: dumps can contain data covered by the same "no real customer data on
# this VPS" constraint as the running app — treat backups with the same care.
chmod 600 "$DEST"

echo "Backup written to $DEST ($(du -h "$DEST" | cut -f1))"

# Prune backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name 'amadeus-*.dump' -mtime "+$RETENTION_DAYS" -print -delete
