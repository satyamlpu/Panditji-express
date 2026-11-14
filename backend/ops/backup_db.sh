#!/usr/bin/env bash
#
# Logical backup of the Pandit Ji Express Postgres database.
#
# Produces a timestamped pg_dump custom-format archive (compressed, restorable
# selectively with pg_restore) and prunes old archives. Designed to run from a
# scheduler (GitHub Actions cron, a cron host, or Supabase scheduled job).
#
# This is the DISASTER-RECOVERY COMPLEMENT to Supabase PITR, not a replacement:
# enable PITR in the Supabase dashboard (see ops/RESTORE_RUNBOOK.md) for
# point-in-time recovery; use these logical dumps for off-provider copies,
# migrations, and restore drills.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./backup_db.sh [out_dir]
#
# Env:
#   DATABASE_URL   required. Accepts postgres://, postgresql://, or the app's
#                  postgresql+psycopg:// form (the +driver suffix is stripped).
#   BACKUP_DIR     output directory (default: ./backups or the [out_dir] arg)
#   RETENTION      how many archives to keep (default: 14)
#
# Requires: pg_dump (postgresql-client) matching the server major version.

set -euo pipefail

OUT_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION="${RETENTION:-14}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 2
fi

# Normalise the SQLAlchemy URL to a libpq-compatible one.
URL="${DATABASE_URL}"
URL="${URL/postgresql+psycopg:\/\//postgresql://}"
URL="${URL/postgresql+asyncpg:\/\//postgresql://}"
URL="${URL/postgres:\/\//postgresql://}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install postgresql-client." >&2
  exit 3
fi

mkdir -p "${OUT_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${OUT_DIR}/panditji_${STAMP}.dump"

echo "[$(date -u +%FT%TZ)] backing up -> ${FILE}"
# -Fc custom format, --no-owner/--no-privileges for portable restores.
pg_dump --dbname="${URL}" -Fc --no-owner --no-privileges --file="${FILE}"

# Integrity check: pg_restore --list must parse the archive.
pg_restore --list "${FILE}" >/dev/null
SIZE="$(du -h "${FILE}" | cut -f1)"
echo "[$(date -u +%FT%TZ)] ok (${SIZE})"

# Retention: keep the newest ${RETENTION} archives, delete the rest.
COUNT="$(ls -1 "${OUT_DIR}"/panditji_*.dump 2>/dev/null | wc -l | tr -d ' ')"
if (( COUNT > RETENTION )); then
  ls -1t "${OUT_DIR}"/panditji_*.dump | tail -n "+$((RETENTION + 1))" | while read -r old; do
    echo "[$(date -u +%FT%TZ)] pruning ${old}"
    rm -f "${old}"
  done
fi

echo "[$(date -u +%FT%TZ)] done; ${OUT_DIR} holds up to ${RETENTION} archives"
