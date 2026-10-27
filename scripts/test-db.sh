#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres (no Docker needed) and
# runs the RLS smoke test. Requires postgres/initdb/pg_ctl/psql on PATH.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
cleanup() { pg_ctl -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
initdb -D "$DIR/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DIR/data" -o "-p $PORT -k '' -c listen_addresses=localhost" -l "$DIR/log" -w start >/dev/null
p() { psql -h localhost -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 "$@"; }
p -f "$ROOT/supabase/tests/stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do p -f "$f"; echo "applied $(basename "$f")"; done
OUT="$(psql -h localhost -p "$PORT" -U postgres -At -f "$ROOT/supabase/tests/rls_smoke.sql" 2>&1)"
echo "$OUT" | grep -q "row-level security policy \"collection_items: own rows\"" || { echo "$OUT"; echo "FAIL: cross-user collection link allowed"; exit 1; }
echo "$OUT" | grep -q "violates row-level security policy for table \"objects\"" || { echo "$OUT"; echo "FAIL: cross-user upload allowed"; exit 1; }
echo "$OUT" | grep -q "violates row-level security policy for table \"saved_items\"" || { echo "$OUT"; echo "FAIL: owner spoof allowed"; exit 1; }
[ "$(echo "$OUT" | tail -1)" = "Dua for patience" ] || { echo "$OUT"; echo "FAIL: cross-user update succeeded"; exit 1; }
echo "RLS smoke test passed"
