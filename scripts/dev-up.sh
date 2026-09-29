#!/usr/bin/env bash
# Local dev stack WITHOUT docker: Postgres 16 + a locally built GoTrue (Supabase Auth).
# Idempotent. Usage: bash scripts/dev-up.sh [--reset]   (--reset rebuilds the database + reseeds)
# Requires: postgresql-16 installed, Go >= 1.24, run as root (uses `su postgres`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB=academyos_dev
GOTRUE_BIN=/tmp/gobin/gotrue
GOTRUE_SRC=/tmp/authgit

pg_ctlcluster 16 main start 2>/dev/null || true
until pg_isready -q; do sleep 1; done
psql_pg() { su postgres -c "psql -v ON_ERROR_STOP=1 -q $*"; }

if [ ! -x "$GOTRUE_BIN" ]; then
  echo ">> building GoTrue from source (one-time, ~1 min)"
  [ -d "$GOTRUE_SRC" ] || git clone --depth 1 https://github.com/supabase/auth "$GOTRUE_SRC"
  mkdir -p "$(dirname "$GOTRUE_BIN")"
  (cd "$GOTRUE_SRC" && go build -o "$GOTRUE_BIN" .)
fi

cat > /tmp/gotrue.env <<ENV
GOTRUE_DB_DRIVER=postgres
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/$DB?sslmode=disable&search_path=auth,public"
GOTRUE_DB_NAMESPACE=auth
DB_NAMESPACE=auth
GOTRUE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_SITE_URL=http://localhost:3000
API_EXTERNAL_URL=http://localhost:9999
GOTRUE_API_HOST=127.0.0.1
PORT=9999
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_MAILER_AUTOCONFIRM=true
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_SMTP_HOST=127.0.0.1
ENV

if [ "${1:-}" = "--reset" ] || ! su postgres -c "psql -Atc \"select 1 from pg_database where datname='$DB'\"" | grep -q 1; then
  echo ">> (re)creating database $DB"
  pkill -x gotrue 2>/dev/null || true
  psql_pg -c "\"alter user postgres password 'postgres'\"" -c "\"drop database if exists $DB with (force)\"" -c "\"create database $DB\""
  psql_pg $DB -f "$ROOT/supabase/tests/roles_stub.sql"
  (set -a; . /tmp/gotrue.env; set +a; cd "$GOTRUE_SRC" && "$GOTRUE_BIN" migrate)
  for f in "$ROOT"/supabase/migrations/*.sql "$ROOT"/supabase/seed.sql; do psql_pg $DB -f "$f" >/dev/null; done
fi

if ! curl -sf -m 2 localhost:9999/health >/dev/null; then
  echo ">> starting GoTrue on :9999"
  (set -a; . /tmp/gotrue.env; set +a; cd "$GOTRUE_SRC" && setsid nohup "$GOTRUE_BIN" serve > /tmp/gotrue.log 2>&1 < /dev/null &)
  for _ in $(seq 1 20); do curl -sf -m 2 localhost:9999/health >/dev/null && break; sleep 1; done
fi
echo ">> ready. Next: cp .env.example .env.local (see README 'Local development'), then npm run dev"
