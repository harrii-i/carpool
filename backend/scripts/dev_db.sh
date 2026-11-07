#!/bin/sh
# Manage a local PostgreSQL+PostGIS cluster for development without Docker.
#
# Usage:
#   scripts/dev_db.sh up      # start (creates the cluster on first run)
#   scripts/dev_db.sh down    # stop
#   scripts/dev_db.sh status  # check if it's running
#
# Requires the PostgreSQL 15 binaries (initdb/pg_ctl/createdb/psql) with the
# PostGIS extension available. On this machine that's the /Library/PostgreSQL/15
# install; adjust PG_BIN below if yours lives elsewhere (e.g. via Homebrew:
# /opt/homebrew/opt/postgresql@15/bin).
set -e

PG_BIN="${PG_BIN:-/Library/PostgreSQL/15/bin}"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATADIR="$BACKEND_DIR/.devdata/pgdata"
SOCKDIR="/tmp/carpool-pg"
PORT=5544
DB=carpool

export PATH="$PG_BIN:$PATH"

case "$1" in
  up)
    mkdir -p "$SOCKDIR"
    if [ ! -d "$DATADIR" ]; then
      echo "Initializing new cluster at $DATADIR"
      initdb -D "$DATADIR" -U postgres --auth=trust -E UTF8
    fi
    if pg_isready -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
      echo "Already running on port $PORT."
    else
      pg_ctl -D "$DATADIR" -o "-p $PORT -k $SOCKDIR -c listen_addresses=127.0.0.1" \
        -l "$DATADIR/../pg.log" -w start
      # Create the database + PostGIS extension on first boot.
      if ! psql -h 127.0.0.1 -p "$PORT" -U postgres -lqt | cut -d'|' -f1 | grep -qw "$DB"; then
        createdb -h 127.0.0.1 -p "$PORT" -U postgres "$DB"
        psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
      fi
    fi
    echo "Postgres+PostGIS ready at postgis://postgres@127.0.0.1:$PORT/$DB"
    ;;
  down)
    pg_ctl -D "$DATADIR" stop -m fast 2>&1 || echo "Not running."
    ;;
  status)
    pg_isready -h 127.0.0.1 -p "$PORT" || true
    ;;
  *)
    echo "Usage: $0 {up|down|status}"
    exit 1
    ;;
esac
