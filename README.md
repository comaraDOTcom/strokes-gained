# Strokes Gained

A personal golf strokes-gained app: log shots hole-by-hole, get real strokes-gained
numbers (Broadie method) against a scratch baseline, and see where practice time
actually pays off — instead of guessing from score, putts and GIR.

**Start here, in order:**
1. [`PLAN.md`](./PLAN.md) — the approved plan. Why each decision was made, the SG
   model, the worked recovery-shot example, the baseline provenance/caveats.
2. [`BUILD.md`](./BUILD.md) — the precise implementation contract. Exact formulas,
   file-by-file scope per phase, required test cases with worked expected values.
   **Read this in full before writing or changing code.** If something here and
   in `BUILD.md` disagree, `BUILD.md` is more current — it gets amended as issues
   are found (see "Known issues already fixed" below).

If you're a fresh session (including a cloud session resuming this work): don't
assume any phase is complete just because a file exists. Verify with `pnpm test`,
`pnpm tsc --noEmit`, and by reading the actual code against `BUILD.md`'s spec.

## Status

| Phase | What | Status |
|---|---|---|
| 1 | SG engine (baseline, interpolation, categorisation, compute) | ✅ Done, full test suite green |
| 2 | Schema, course seed, `.xlsx` import, `/courses` editor | ✅ Done |
| 3 | Round entry (`/rounds/new`, `/rounds/[roundId]`) | ✅ Built. Last full end-to-end validation pass was interrupted mid-way (session teardown) — re-verify against `BUILD.md`'s Phase 3 checklist before trusting it blindly |
| 4 | Dashboard (`/insights`), incl. derived GIR/putts/fairways/sand-saves/up-and-downs | 🔄 In progress at time of last handoff |
| 5 | Trends + practice priority, cross-course difficulty caveat | 🔄 In progress at time of last handoff |

**Design direction**: two mockups (landing + dashboard) are published at
<https://claude.ai/artifact/5xuDRDUxDhpTwrbsYixSLB> — analytical/data-tool
aesthetic (IBM Plex Sans + Plex Mono, steel-blue accent, sharp corners, an
18-hole SG heatmap strip, a Portmarnock/Elm Park course filter). Static HTML,
not real app code, but should inform Phase 4's actual implementation — including
the course filter, which isn't yet speced into `BUILD.md` and should be added to
Phase 4 if not already there.

### Known issues already fixed (don't reintroduce)

- **SAND vs RECOVERY baseline crossover**: `src/lib/sg/baseline-scratch.ts`'s
  `RECOVERY` curve used to dip below `SAND` between 254–260y (a long fairway
  bunker briefly reading as worse than being fully blocked out — wrong). Fixed
  by widening the RECOVERY tail anchors; see the comment right above the
  `RECOVERY` array in that file for the numbers and reasoning.
- **Portmarnock hole 16, Green tees**: the source spreadsheet said 517y; the
  club's own card and its nine-hole checksum only reconcile at 512y. `512` is
  what's seeded in `src/db/seed-courses.ts` — see its header comment.

### Not yet resolved

- Portmarnock has no course rating on file (only Elm Park does), so the
  cross-course `difficultyAdjustment` in Phase 5 has nothing to calibrate
  against yet and must stay off/labelled until Conor supplies it.
- The dev DB (`data/rounds.db*`) is gitignored and not in this repo — a fresh
  clone needs `pnpm db:seed` to repopulate courses/tees before anything else
  works.

## Running it

```bash
pnpm install
pnpm db:seed        # loads Elm Park + Portmarnock from src/db/seed-courses.ts, fails loudly on any checksum mismatch
pnpm test           # engine + import tests
pnpm tsc --noEmit
pnpm dev            # next dev -H 0.0.0.0, reachable from a phone on the same wifi
```

## Stack

Next.js 15 (App Router) + TypeScript · SQLite (`better-sqlite3`) + Drizzle ORM ·
Tailwind v4 · Recharts · Vitest. DB is a single file at `data/rounds.db`, not
committed — back it up yourself, or migrate to hosted Postgres later (schema is
written to be portable).

## Data provenance

Course data in `src/db/seed-courses.ts` is verified against each club's own
scorecard (out/in/total yardage checksums, stroke-index permutation check) — see
that file's header for exactly what was checked and against what source. The
baseline expected-strokes table (`src/lib/sg/baseline-scratch.ts`) is calibrated
to Elm Park's own course rating; see its header for the calibration numbers and
the explicit limitation (it's length-only, so it understates a links course like
Portmarnock).
