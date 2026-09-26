#!/usr/bin/env bash
# Runs the same gates as .github/workflows/ci.yml, locally, in the same order.
# A change that passes `ci-local.sh full` should pass CI; if it doesn't, fix this script.
#
#   ci-local.sh fast            typecheck + full test suite            (~1 min)
#   ci-local.sh full            fast + production build + migration checks  (~3 min)
#   ci-local.sh tests <path…>   just vitest on the given files/dirs   (seconds)
#   ci-local.sh skills          the skills under .claude/ still match the repo (seconds)
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

skills_in_sync() {
  # Skills are code: every file path and pnpm script they cite must exist, and every gate this
  # script runs must be one CI runs. A rename that leaves a skill pointing at nothing fails here.
  local ok=0
  local skill_files
  skill_files=$(find .claude/skills CLAUDE.md -name '*.md' 2>/dev/null)
  # Paths: anything that looks like src/..., scripts/..., docs/..., drizzle/..., .github/...
  # inside backticks. Globs (**, *) are skipped.
  for ref in $(grep -ohE '`(src|scripts|docs|drizzle|\.github|\.claude|public)/[A-Za-z0-9_./\[\]-]+`' $skill_files | tr -d '`' | sort -u); do
    case "$ref" in *'*'*) continue;; esac
    if [ ! -e "$ref" ]; then
      echo "stale path in a skill: $ref"; ok=1
    fi
  done
  # pnpm scripts: `pnpm <name>` must be a script in package.json (or tsc/vitest, which are bins).
  for script in $(grep -ohE 'pnpm [a-z][a-z0-9:-]*' $skill_files | awk '{print $2}' | sort -u); do
    case "$script" in tsc|vitest|install) continue;; esac
    if ! node -e "process.exit(require('./package.json').scripts['$script'] ? 0 : 1)"; then
      echo "skill cites 'pnpm $script' but package.json has no such script"; ok=1
    fi
  done
  # Gates: each pnpm command this script runs must appear in ci.yml.
  for cmd in 'pnpm tsc --noEmit' 'pnpm test' 'pnpm build' 'pnpm db:generate' 'pnpm db:migrate'; do
    if ! grep -qF "$cmd" .github/workflows/ci.yml; then
      echo "ci-local runs '$cmd' but .github/workflows/ci.yml does not"; ok=1
    fi
  done
  return $ok
}

case "$mode" in
  skills)
    gate "skills in sync with the repo" skills_in_sync
    ;;
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
      gate "skills in sync with the repo" skills_in_sync
    fi
    ;;
  *)
    echo "usage: $0 [fast|full|skills|tests <paths…>]" >&2; exit 2
    ;;
esac

echo
echo "── ci-local ($mode) on $(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain)" ] && echo ' + uncommitted changes')"
printf '%s\n' "${results[@]}"
exit $status
