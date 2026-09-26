---
name: verify
description: Verify a change to this repo before it is reported, merged or pushed. Runs the same gates as CI locally (typecheck, tests, build, migration checks) and, for work done by a subagent or another session, spawns an independent verifier that checks every claim against evidence. Use before "done", before a push, after a subagent hands back, or when asked "is this right?".
argument-hint: "[fast|full] [what to verify, or a ticket/report to check]"
---

# Verify

The pass in a kitchen: nothing leaves until someone other than the cook has checked the plate.
Two layers, used together:

1. **Gates**: the repo's own checks, run the way CI runs them.
2. **The verifier**: an independent subagent that checks a claimed result against the code,
   the tests and the ticket. The author of a change never verifies it.

## 1. Gates

`scripts/ci-local.sh` (in this skill's directory) mirrors `.github/workflows/ci.yml`, in the
same order, and ends with a PASS/FAIL line per gate you can quote as evidence.

```bash
.claude/skills/verify/scripts/ci-local.sh fast                 # typecheck + full test suite, ~1 min
.claude/skills/verify/scripts/ci-local.sh full                 # + production build + migration checks, ~3 min
.claude/skills/verify/scripts/ci-local.sh tests src/lib/sg     # only these tests, seconds
```

Measured in a cloud session on a clean checkout: typecheck ~9s, 463 tests ~43s (DB-backed
tests each boot an in-memory Postgres). Run `fast` for every change; `full` before a push or
whenever `src/db/schema.ts`, `drizzle/`, `next.config.ts`, `package.json` or anything under
`src/app/` changed (the build is what catches a server/client component mistake).

What each gate protects, so you know what a failure means:

| Gate | Catches |
|---|---|
| `pnpm tsc --noEmit` | Type errors, including `noUncheckedIndexedAccess` misses |
| `pnpm test` | Behaviour, the SG chain invariant, seed checksums, benchmark anonymisation, DB-backed round logic |
| `pnpm build` | Server/client component boundaries, route typing, anything Next only checks at build |
| `db:generate` is a no-op | A schema change without its migration (Vercel migrates on every deploy) |
| `db:migrate` on `memory://` | Migrations that don't apply in order to a fresh database |

Not mirrored: the trufflehog secret scan (CI only). Never commit `.env*`, `benchmarks-raw/`,
or a real connection string; `git diff --cached` before every commit.

The gates run in the working tree. When verifying a subagent's work, run them **in that
subagent's worktree or branch**, not in yours.

## 2. The verifier

When work was done by someone else (a subagent, another session, a pull request), spawn one
verifier per ticket with `references/verifier-prompt.md`:

- `subagent_type`: `general-purpose` (it needs Bash to run gates; it must not edit)
- `model`: inherit; `sonnet` is fine for a small, well-scoped ticket
- `isolation`: `worktree` if the change is on a branch you haven't checked out; otherwise
  point it at the existing worktree path

The verifier gets the **ticket** (what was asked, scope, acceptance criteria), the **report**
(what the author claims), and the **diff** (`git diff <base>...<head>`). It returns a claims
table and a verdict:

```
| # | Claim (from the report) | Evidence checked | Result |
|---|---|---|---|
| 1 | "Added a test for holed edit removing later shots" | src/lib/rounds/save-shot.test.ts:212 exists, asserts count; ci-local tests → PASS | CONFIRMED |
| 2 | "No behaviour change to recompute" | diff touches src/lib/sg/recompute.ts:61 (new branch) | CONTRADICTED |

Verdict: FAIL — claim 2 is false; recompute now skips holes with zero shots (unrequested).
```

Verdicts: **PASS** (every claim confirmed, gates green, scope respected), **PASS WITH NOTES**
(confirmed, but something the lead should know), **FAIL** (a contradicted claim, a red gate, an
out-of-scope change, or a claim with no evidence). A claim the verifier couldn't check is
**UNVERIFIED** and makes the verdict at best PASS WITH NOTES, never PASS.

## What "verified" means in a report

When you report your own work as done, use the same standard on yourself:

- Every claim of behaviour points at `path:line` or a test name.
- Every "tests pass" quotes the gate line (`PASS  tests (pnpm test)  (43s)`) and the commit it
  ran on. "Should pass" is not a result.
- Skipped gates are named as skipped, with the reason.
- The diff is the diff: `git diff --stat` in the report, and nothing changed outside the ticket's
  scope without saying so.

## Repo-specific checks the verifier always makes

- **Contract**: does the change match the relevant `BUILD.md` section and the `README.md`
  description of the area? If the change alters documented behaviour, was the doc updated in
  the same change?
- **Invariants**: SG engine changes keep `sum(SG) === E(TEE, holeYards) − grossScore`
  (`src/lib/sg/compute.test.ts` property test); round edits keep the chain (`chain.test.ts`);
  seed data keeps its checksums; migrations are complete.
- **Guards**: a new route or page that takes an id from the URL goes through
  `src/lib/auth/guards.ts`; insights queries take a `userId`.
- **Tests with the code**: a new pure function in `src/lib/*` has a colocated `*.test.ts`;
  DB-touching logic is tested through `freshDb()` in `src/db/test-helpers.ts`.
- **Release hygiene**: a shipped feature or fix has a `CHANGELOG.md` entry and a `package.json`
  version bump (one per release, done once by the lead, not by each ticket).
- **Design system**: new UI uses the semantic classes from `src/app/globals.css`, not raw
  Tailwind palette colours.
