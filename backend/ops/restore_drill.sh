#!/usr/bin/env bash
#
# Restore drill: proves backup_db.sh produces a RESTORABLE archive, end to end,
# against a throwaway local PostgreSQL cluster — never a real database.
#
# It spins up a temporary cluster on a high TCP port, seeds a tiny table, runs
# backup_db.sh, restores the dump into a fresh database, and verifies the row
# count survived. Use it locally or in CI to catch a backup that dumps but does
# not restore. Requires local postgres tooling (initdb, pg_ctl, pg_dump,
# pg_restore, psql) matching the server major version.
#
# Usage:  bash backend/ops/restore_drill.sh [port]
# Exit 0 = PASS, non-zero = FAIL. Cleans up the temp cluster on exit.

set -euo pipefail

PORT="${1:-55432}"
WORK="$(mktemp -d)"
export LC_ALL="${LC_ALL:-C}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  pg_ctl -D "$WORK/data" stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

for bin in initdb pg_ctl pg_dump pg_restore psql; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ERROR: $bin not found (install postgresql-client)."; exit 3; }
done

echo "[drill] initdb + start on 127.0.0.1:$PORT"
initdb -D "$WORK/data" -U postgres --locale=C -E UTF8 >/dev/null 2>&1
pg_ctl -D "$WORK/data" \
  -o "-p $PORT -c listen_addresses='127.0.0.1' -c unix_socket_directories=''" \
  -l "$WORK/log" start >/dev/null 2>&1
export PGHOST=127.0.0.1 PGPORT="$PORT"
# Wait for readiness.
for _ in $(seq 1 20); do pg_isready -q -h 127.0.0.1 -p "$PORT" && break; sleep 0.5; done

echo "[drill] seed source database"
psql -U postgres -d postgres -q -c "CREATE DATABASE drill_src;"
psql -U postgres -d drill_src -q -c \
  "CREATE TABLE sample(id int primary key, v text); INSERT INTO sample VALUES (1,'a'),(2,'b'),(3,'c');"

echo "[drill] run backup_db.sh"
DATABASE_URL="postgresql://postgres@127.0.0.1:$PORT/drill_src" \
  BACKUP_DIR="$WORK/out" RETENTION=3 bash "$HERE/backup_db.sh" "$WORK/out"
DUMP="$(ls "$WORK/out"/panditji_*.dump | head -1)"

echo "[drill] restore into fresh database"
psql -U postgres -d postgres -q -c "CREATE DATABASE drill_dst;"
pg_restore --no-owner --no-privileges -U postgres -d drill_dst "$DUMP" >/dev/null 2>&1
N="$(psql -U postgres -d drill_dst -tAc "SELECT count(*) FROM sample;" | tr -d ' ')"

if [ "$N" = "3" ]; then
  echo "[drill] PASS — backup restored with all rows intact"
  exit 0
fi
echo "[drill] FAIL — restored row count=$N (expected 3)"
exit 1
