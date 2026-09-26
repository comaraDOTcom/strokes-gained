# Strokes Gained — working notes for Claude

Read `README.md` first (it describes every area), then the `BUILD.md` section for whatever you
are touching (the implementation contract: formulas, ordering rules, required tests). Where they
disagree, `BUILD.md` is more current; where either disagrees with the code, the code is the
truth and the disagreement is worth reporting.

## Fast checks (mirror of CI, run before you say "done")

```bash
.claude/skills/verify/scripts/ci-local.sh fast    # typecheck + tests, ~1 min
.claude/skills/verify/scripts/ci-local.sh full    # + build + migration checks, before a push
.claude/skills/verify/scripts/ci-local.sh tests src/lib/sg   # just these tests
```

Quote the PASS/FAIL lines in your report. "Should pass" is not a result.

## Skills

| Skill | Use it when |
|---|---|
| `/how` | Before working in an area you don't know; "how does X work"; architectural critique |
| `/verify` | Before reporting, merging or pushing; after any subagent hands work back |
| `/brigade` | Several independent changes, an audit, or any time you fan out to many subagents |

Subagents that write code work in their own worktree, own a named set of files, and are
checked by a verifier that is not the author. Details in `.claude/skills/brigade/`.

## Quality problems are filed, not mentioned

A data or insight problem a player could notice (a wrong or missing course, a number resting on a
tiny sample, a caveat the page doesn't show) goes in `docs/quality.md` with a confidence grade
and into a GitHub issue with the numbers, in the same session it was found. Where the data is a
committed file, add or extend a ratchet test (`src/lib/directory/data-quality.test.ts` is the
model). A subagent reports it under "Noticed"; the lead files it. Chat is not a store.

## Conventions

- Logic lives in `src/lib/*` as pure functions with a colocated `*.test.ts`; pages and routes
  in `src/app/*` stay thin. DB logic is tested against a real in-memory Postgres via
  `freshDb()` in `src/db/test-helpers.ts`, never mocked.
- Every id from a URL goes through `src/lib/auth/guards.ts`. Non-owners get 404, not 403.
- Schema changes ship with their migration: `pnpm db:generate`, commit `drizzle/`. One schema
  change at a time.
- Distances are stored in yards; feet only at the display boundary (`src/lib/units.ts`).
- UI uses the semantic classes in `src/app/globals.css`, not raw Tailwind palette colours.
- A shipped feature or fix gets a `CHANGELOG.md` entry and a `package.json` version bump, once
  per release, by whoever integrates, not per subagent.
- Never commit `.env*`, `benchmarks-raw/`, or a real connection string.
- Scratch and intermediate files go in `archive/` (git-ignored), never the working tree root.
