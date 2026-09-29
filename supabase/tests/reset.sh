#!/usr/bin/env bash
# Rebuild the local test database (plain Postgres + auth stub) and load migrations + seed.
set -euo pipefail
DB=${1:-academyos_test}
cd "$(dirname "$0")/../.."
run() { su postgres -c "psql -v ON_ERROR_STOP=1 -q $DB -f $PWD/$1"; }
su postgres -c "psql -q -c 'drop database if exists $DB' -c 'create database $DB'"
run supabase/tests/auth_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
