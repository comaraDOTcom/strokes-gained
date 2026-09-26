#!/usr/bin/env bash
# Runs the same gates as .github/workflows/ci.yml, locally, in the same order.
# A change that passes `ci-local.sh full` should pass CI; if it doesn't, fix this script.
#
#   ci-local.sh fast            typecheck + full test suite            (~1 min)
#   ci-local.sh full            fast + production build + migration checks  (~3 min)
#   ci-local.sh tests <path…>   just vitest on the given files/dirs   (seconds)
#
# Output ends with one line per gate: PASS/FAIL, so a verifier can quote it as evidence.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

mode="${1:-fast}"; shift || true
results=()
status=0

gate() {
  local name="$1"; shift
  local start=$SECONDS
  echo "── $name"
  if "$@"; then
    results+=("PASS  $name  ($((SECONDS-start))s)")
  else
    results+=("FAIL  $name  ($((SECONDS-start))s)")
    status=1
  fi
}

drizzle_clean() {
  # CI: `pnpm db:generate` must not change anything under drizzle/.
  pnpm db:generate >/dev/null
  local diff
  diff="$(git status --porcelain -- drizzle)"
  if [ -n "$diff" ]; then
    echo "src/db/schema.ts changed without a migration. Run 'pnpm db:generate' and commit the new files in drizzle/:"
    echo "$diff"
    return 1
  fi
}

case "$mode" in
  tests)
    gate "vitest $*" pnpm vitest run "$@"
    ;;
  fast|full)
    gate "typecheck (pnpm tsc --noEmit)" pnpm tsc --noEmit
    gate "tests (pnpm test)" pnpm test
    if [ "$mode" = full ]; then
      gate "production build (pnpm build)" env BETTER_AUTH_SECRET=ci-build-only-not-a-secret-ci-build-only pnpm build
      gate "migrations complete (db:generate is a no-op)" drizzle_clean
      gate "migrations apply to a fresh database" env PGLITE_DIR='memory://' pnpm db:migrate
    fi
    ;;
  *)
    echo "usage: $0 [fast|full|tests <paths…>]" >&2; exit 2
    ;;
esac

echo
echo "── ci-local ($mode) on $(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain)" ] && echo ' + uncommitted changes')"
printf '%s\n' "${results[@]}"
exit $status
