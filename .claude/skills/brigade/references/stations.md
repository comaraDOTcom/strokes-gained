# Stations

What each part of the codebase is, the invariant it owns, and how it's tested. A ticket names
one station. When a change spans stations, split it, or give it to the chef.

Verify any line here against the code before relying on it: this map was written at commit
`c1b6617` (v0.0.35) and the code moves faster than the map.

| Station | Lives in | Owns the invariant | Tested how |
|---|---|---|---|
| **SG engine** | `src/lib/sg/` | `sum(SG) === E(TEE, holeYards) − grossScore` on a finished hole; chain continuity; stroke-and-distance costs exactly 2.0; baseline curves monotone and ordered FAIRWAY < ROUGH < SAND < RECOVERY | Pure: `compute.test.ts` (golden hole + fast-check property test), `interpolate`, `categorise`, `baseline-structural`. DB: `recompute.test.ts` |
| **Rounds** | `src/lib/rounds/`, `src/app/rounds/`, `src/app/api/rounds/` | The shot chain (server derives every start; an edit re-derives later starts; Holed deletes later shots); tags never feed SG; a shot is never committed without its SG (one transaction) | DB via `freshDb()`: `save-shot`, `tee-edit`. Pure: `chain`, `entry`, `details`. Route handlers and `.tsx` have **no** tests |
| **Insights** | `src/lib/insights/`, `src/app/{insights,trends,scoring,learn}/`, `src/app/rounds/[roundId]/recap/` | Pure functions over `EnrichedShot`; null SG rows are dropped, never counted as 0; every query takes a `userId`; benchmark data stays anonymised | Pure tests per module; `queries.test.ts` against PGlite; `benchmarks.test.ts` enforces anonymisation |
| **Auth** | `src/lib/auth/`, `src/middleware.ts`, `src/app/api/auth/`, `src/app/login/`, `src/app/join/` | Every id from a URL goes through `guards.ts`; non-owners get 404 not 403; invite-only sign-up; middleware is optimistic only | `guards.test.ts` (DB), `policy.test.ts`, `invite-gate.test.ts`. **Lead-only.** |
| **DB** | `src/db/`, `drizzle/` | Schema and migrations move together (`db:generate` is a no-op in CI); seed checksums; every distance stored in yards | `checksum.test.ts`; CI migration job. **Lead-only; one schema ticket at a time.** |
| **Courses & import** | `src/lib/courses/`, `src/lib/import/`, `src/app/courses/`, `src/app/import/`, `src/app/api/{courses,tees,course-requests,import}/` | Course checksums validate before insert; a yardage edit re-bases every round on the tee (`tee-edit.ts`) | `parse-course-sheet`, `golfcourseapi`, `requests` tests; `tee-edit.test.ts` |
| **Directory** | `src/lib/directory/`, `scripts/fetch-course-directory.ts`, `.github/workflows/course-directory.yml` | Keys never silently dropped; overrides applied; top-100 file consistent with the directory | `build`, `queries`, `profile`, `top100` tests |
| **Learn & onboarding** | `src/lib/learn/`, `src/app/{learn,welcome}/`, `src/app/getting-started.tsx` | The tour runs the real engine so it can't drift | `tour`, `explain`, `onboarding` tests |
| **Voice** | `src/lib/voice/`, `src/app/voice/`, `src/app/api/voice/` | Transcripts snap to golf vocabulary | `transcribe`, `vocabulary` tests |
| **Design system & shell** | `src/app/globals.css`, `src/app/layout.tsx`, `src/app/logo.tsx`, `src/app/icon.svg`, `public/` | Semantic classes only (`bg-paper`, `text-neg`…); logo files kept in sync; scene per season | `scene.test.ts`, `chart-colors.test.ts`. **Lead-only.** |
| **Release** | `CHANGELOG.md`, `package.json` version, `.github/workflows/` | One entry and one bump per release; the Release workflow refuses otherwise | Workflow itself. **Lead-only.** |

## Lead-only files

Never in a cook's ticket. The chef edits them once, after merging.

`src/db/schema.ts`, `drizzle/**`, `package.json`, `pnpm-lock.yaml`, `CHANGELOG.md`, `README.md`,
`BUILD.md`, `PLAN.md`, `.github/**`, `src/app/layout.tsx`, `src/app/globals.css`,
`src/middleware.ts`, `src/lib/auth/**`, `.claude/**`, `vercel.json`, `next.config.ts`,
`tsconfig.json`, `vitest.config.ts`.

## Conventions every cook follows

- Logic in `src/lib/*` as pure functions with a colocated `*.test.ts`; pages and routes in
  `src/app/*` stay thin. Anything that touches the DB is tested through `freshDb()` in
  `src/db/test-helpers.ts`, never mocked.
- Route handlers can't be imported by vitest (no `@/` alias in tests), so testable logic is
  moved into `src/lib/*` (the `save-shot.ts` pattern).
- Distances are stored in yards; feet only at the display boundary via `src/lib/units.ts`.
- Errors at API boundaries are `HttpError` → `toErrorResponse`; anything else is a real bug
  and becomes a 500 on purpose.
- Module header comments say *why*. Keep them true when you change the module.
- `noUncheckedIndexedAccess` is on: `arr[0]!` only when you've proven it exists.
