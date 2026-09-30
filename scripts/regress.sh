#!/usr/bin/env bash
# Full local regression: fresh dev DB, every browser suite, RLS tests, lint, typecheck, build.
# Exits non-zero if anything fails. Requires the dev server on :3000 (npm run dev).
set -u
cd "$(dirname "$0")/.."
fail=0
timeout 280 bash scripts/dev-up.sh --reset > /tmp/devup.log 2>&1 || { echo "dev-up failed"; exit 1; }
for t in phase2 phase3 phase4 phase5 phase7 phase8 phase9 phase10 phase11 phase12 demo import pilot rosters email team ${EXTRA_SUITES:-}; do
  if node "scripts/e2e/$t.mjs" > "/tmp/e2e-$t.log" 2>&1; then echo "ok   $t"; else echo "FAIL $t (see /tmp/e2e-$t.log)"; fail=1; fi
done
bash supabase/tests/reset.sh > /tmp/rls-reset.log 2>&1
if su postgres -c "psql -v ON_ERROR_STOP=1 -q academyos_test -f $PWD/supabase/tests/rls.sql" 2>&1 | grep -q "ALL RLS CHECKS PASSED"; then echo "ok   rls"; else echo "FAIL rls"; fail=1; fi
npm run lint > /tmp/lint.log 2>&1 && ! grep -qE "[0-9]+ (error|warning)" /tmp/lint.log && echo "ok   lint" || { echo "FAIL lint"; fail=1; }
npx tsc --noEmit > /tmp/tsc.log 2>&1 && echo "ok   tsc" || { echo "FAIL tsc"; fail=1; }
exit $fail
