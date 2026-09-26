# Corrections ledger

Every correction to how Claude or a subagent works on this repo, and where it landed on the
ladder (1 codebase, 2 static analysis, 3 rules/hooks, 4 skills, 5 style guide; lower is
stronger). Before fixing a mistake for a second time, search here: if the rule is already
listed, the fix is to push it down a level, not to add another line. Maintained by `/correct`.

| Date | Rule | Level | Lives in | Commit | Prompted by |
|---|---|---|---|---|---|
| 2026-09-26 | A subagent's "tests pass" must quote the gate line and commit; unquoted claims are unverified | 4 | `.claude/skills/verify/SKILL.md`, `references/return-contract.md` | 1d6adc9 | Verification goal for multi-agent sessions |
| 2026-09-26 | The author of a change never verifies it; a separate verifier checks claims against evidence | 4 | `.claude/skills/verify/references/verifier-prompt.md`, `/brigade` "the pass" | 1d6adc9 | Same |
| 2026-09-26 | Local checks are the CI checks, in the same order, with one command | 2 | `.claude/skills/verify/scripts/ci-local.sh` | 1d6adc9 | Same |
| 2026-09-26 | Only one schema/migration change at a time; `schema.ts` and `drizzle/` are lead-only | 4 | `.claude/skills/brigade/references/stations.md` | 1d6adc9 | Two parallel `db:generate` runs would collide on the migration number |
| 2026-09-26 | Skills cite paths and commands that must exist; drift fails the gate | 2 | `ci-local.sh skills` | (this commit) | Rigour for updating skills with code |
| 2026-09-26 | Commit the skills before spawning cooks: a worktree branches from HEAD, so an uncommitted `.claude/skills/` is missing inside it | 4 | `/brigade` "Mise en place" step 1 | (this commit) | First cook had to call `ci-local.sh` by absolute path |

## Open: corrections found but not yet landed

Found by the `/how` run on shot saving. Each is a candidate for level 1 or 2; none has been
made yet. Delete a row when it lands and add it to the table above.

| Rule | Proposed level | Proposed mechanism | Found at |
|---|---|---|---|
| The shots API validates `endLie`, `penaltyType`, `penaltyStrokes`, `endDistance` before persistence | 1 | `parseShotBody()` in `src/lib/rounds/entry.ts`, used by the route, tested | `src/app/api/rounds/[roundId]/shots/route.ts` casts `req.json()` |
| Route handlers are testable | 1 | `resolve.alias` for `@/` in `vitest.config.ts` | `save-shot.ts` header explains the workaround |
| Feet/yards conversion happens only in `src/lib/units.ts` | 2 | Lint rule or a test that greps for `* 3` / `/ 3` outside `units.ts` | `describeEntry` in `entry.ts` does it inline |
| The SG invariant is property-tested with stroke-and-distance shots | 2 | Extend the fast-check generator in `compute.test.ts` | Generator never emits `STROKE_AND_DISTANCE` |
| Malformed JSON is a 400 on every route, not a 500 on some | 1 | One `readJson()` helper in `guards.ts` used by all routes | Shots routes vs the round PATCH route |
| Tail-tag fallback normalises putt tags too | 1 | Fix in `save-shot.ts` with a test | `save-shot.ts` fallback nulls only `missDirection` |
| Comments that point at a function name it | 2 | (small) | `baseline-scratch.ts` says `difficultyAdjustment` is in `compute.ts`; it's in `insights/trends.ts` |
