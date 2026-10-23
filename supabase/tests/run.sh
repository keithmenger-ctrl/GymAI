#!/usr/bin/env bash
# Rebuild the test DB and run the RLS checks. Fails unless the pass marker is printed.
set -uo pipefail
cd "$(dirname "$0")/../.."
bash supabase/tests/reset.sh > /tmp/rls-reset.log 2>&1 || { echo "FAIL rls reset (see /tmp/rls-reset.log)"; exit 1; }
out=$(su postgres -c "psql -v ON_ERROR_STOP=1 -q academyos_test -f $PWD/supabase/tests/rls.sql" 2>&1)
status=$?
echo "$out"
[ $status -eq 0 ] && grep -q "ALL RLS CHECKS PASSED" <<<"$out"
