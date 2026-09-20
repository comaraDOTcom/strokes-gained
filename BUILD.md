# Implementation contract

Approved plan: `~/.claude/plans/partitioned-dancing-ladybug.md`. This file is the
precise build spec. Work the phases in order. **Do not start a phase until the
previous phase's tests pass.**

Already written (do not regenerate, only extend):
- `src/lib/sg/baseline-scratch.ts` — calibrated scratch baseline. Read its header.
- `src/db/seed-courses.ts` — verified Elm Park + Portmarnock data. Checksums pass.

## Stack

Next.js 15 App Router + TypeScript, SQLite (`better-sqlite3`) + Drizzle ORM,
Tailwind v4, Recharts, Vitest. DB file: `data/rounds.db`.
`next dev -H 0.0.0.0` so it is reachable from a phone on wifi.

---

## Phase 1 — SG engine (headless, test-first)

### `src/lib/sg/interpolate.ts`

```ts
expectedStrokes(lie: Lie, distance: number): number
```
- `distance` is FEET when `lie === 'GREEN'`, YARDS otherwise (`UNIT_BY_LIE`).
- **LINEAR interpolation** between anchors. Not cubic: the anchors are dense, linear
  is monotone by construction, and it keeps tests exactly reproducible.
- Below the first anchor: clamp toward holing out, do not extrapolate to < 1.0.
  For `GREEN` at d <= 1ft return 1.0. For other lies clamp to the first anchor.
- Above the last anchor: linear extrapolation using the final segment's slope.
- `distance === 0` returns 0 (ball is in the hole).

### `src/lib/sg/compute.ts`

```ts
type ShotInput = {
  holeNo: number; shotNo: number;
  startLie: Lie; startDistance: number;      // display units (feet on green)
  endLie: Lie | null; endDistance: number;   // null lie + holed=true when holed
  holed: boolean;
  penaltyStrokes: number;                    // 0 or 1
  penaltyType: null | 'LATERAL' | 'STROKE_AND_DISTANCE';
};

computeHole(shots: ShotInput[], holeYards: number, par: number): ShotSG[]
```

Per shot:
```
SG = E(startLie, startDistance) - E(endLie, endDistance) - 1 - penaltyStrokes
```
- Holed shot: `E(end) = 0`.
- `STROKE_AND_DISTANCE`: end position is forced equal to the start position, so the
  shot costs a full 2.0 strokes. Enforce this in the engine, not just the UI.
- Shot 1 of a hole must have `startLie = 'TEE'`, `startDistance = holeYards`.
- Shot *n*'s start MUST equal shot *n-1*'s end. Throw on a broken chain — silent
  acceptance here is how wrong numbers get produced.

**Invariant (assert in the engine, and property-test it):**
```
sum(SG) === E('TEE', holeYards) - grossScore
grossScore = shots.length + sum(penaltyStrokes)
```

### `src/lib/sg/categorise.ts`

```ts
type Category = 'OFF_THE_TEE' | 'APPROACH' | 'SHORT_GAME' | 'BUNKER' | 'PUTTING' | 'RECOVERY';
```
Resolve in this order (first match wins):
1. `startLie === 'GREEN'` -> `PUTTING`
2. `startLie === 'SAND'` -> `BUNKER` (sub-split `greenside` when startDistance <= 30y, else `fairway`)
3. `startLie === 'RECOVERY'` -> `RECOVERY`
4. `startLie === 'TEE' && par >= 4` -> `OFF_THE_TEE`
5. `startDistance > 30` yards -> `APPROACH`  (includes par-3 tee shots)
6. otherwise -> `SHORT_GAME`

Penalty strokes stay attributed to the causing shot's category AND are reported
separately as `penaltyStrokesLost`, so a blow-up shows as tee damage rather than
inflating approach numbers.

### Required tests — `src/lib/sg/*.test.ts`

Golden hole (Elm Park Blue hole 2, 413y par 4) — assert to 3dp:

| shot | start | end | SG |
|---|---|---|---|
| 1 | TEE 413y | FAIRWAY 150y | +0.032 |
| 2 | FAIRWAY 150y | GREEN 20ft | +0.180 |
| 3 | GREEN 20ft | holed | +0.930 |

`E(TEE,413) = 4.142`, total SG `= +1.142 = 4.142 - 3`.

Recovery test — 300y par 4, drive leaves 60y:
- ends `RECOVERY 60y`: `SG = 3.67 - 3.36 - 1 = -0.69`
- ends `FAIRWAY 60y`:  `SG = 3.67 - 2.81 - 1 = -0.14`
- **assert the recovery finish is strictly worse by ~0.55** — this is the feature
  that charges a blocked position to the shot that caused it.

Penalty test — OB tee shot, stroke and distance: `SG === -2.0` exactly.

Baseline structural tests:
- every curve strictly increasing in distance
- `E(GREEN, 1) === 1.0`; two-putt crossover `E(GREEN, d) = 2.0` at 24-26 ft
- at equal distance: `FAIRWAY < ROUGH < SAND < RECOVERY`
- calibration: `sum(E('TEE', holeYards))` over 18 holes is within **1.5** of the
  tee's `courseRating` — passes for both Elm Park tees. Portmarnock has no rating
  in the seed, so skip it there rather than asserting.

---

## Phase 2 — Schema, seed, import, course editor

`src/db/schema.ts` (Drizzle, SQLite, Postgres-portable — no SQLite-only types):

```
courses    id, name, location
tees       id, course_id, name, gender, distance_unit, course_rating, slope_rating
tee_holes  id, tee_id, hole_no, par, stroke_index (nullable), yards
rounds     id, course_id, tee_id, played_on, weather, notes
shots      id, round_id, hole_no, shot_no,
           start_lie, start_yards, end_lie, end_yards, holed,
           penalty_strokes, penalty_type,
           sg, category, baseline_id      -- derived
```
- **Canonical storage unit is yards** (`REAL`) for every lie including GREEN.
  Convert feet -> yards on write, yards -> feet on display. One conversion point.
- `sg`/`category` denormalised so SG is queryable in plain SQL. Refresh via
  `recomputeRound(roundId)` on every mutation; `pnpm sg:recompute --all` rebuilds
  everything after a baseline edit.
- Hole score is always derived from shots. Never stored as an input.

`pnpm db:seed` loads `seed-courses.ts` and **fails loudly** if any tee's summed
yardage != `expectedTotalYards` or summed par != `expectedPar`.

`scripts/import-courses.ts` + `/import` page: accept `.xlsx`/`.csv`, show detected
columns and a preview, map to courses/tees/tee_holes. Reject on failed checksum with
a row-by-row report. Conor's sheet format is `hole | white tees | greens tees | par`
(long-ish wide layout, one column per tee) — support that and a long layout.

`/courses` editor: 18-row grid (par, stroke index, yards) with live out/in/total
sums against the tee total, so a typo is visible immediately.

---

## Phase 3 — Round entry

`/rounds/new` -> course, tee, date. Then hole-by-hole mobile-first flow:
- shot 1 pre-filled `TEE` + hole yardage from `tee_holes`
- per shot the user taps the **result only**: one of six lie buttons + distance on a
  numeric keypad (auto-switch to feet when `GREEN`), or **Holed**
- `RECOVERY` button must carry its definition inline: *"no realistic shot at the
  green — must play sideways, out or lay up"*. Consistency of this label over time
  matters more than any other input.
- penalty toggle offering `LATERAL` (enter drop position) and `STROKE_AND_DISTANCE`
  (end auto-set to start)
- running hole SG displayed live; derived score shown to check against the card
- resume a part-entered round; edit any past shot
Target 60-90s per hole. Verify at 375px width.

---

## Phase 4 — Dashboard

### Traditional stats, derived — not entered

Conor wants the familiar scorecard stats (GIR, putts, fairways hit, sand saves,
up-and-downs) alongside SG. They cost zero extra taps: every one of them is a pure
function of the shots already being logged in Phase 3. Do not add input fields for
any of these, and do not let them silently disagree with the shots — same rule as
hole score.

`src/lib/insights/traditional-stats.ts`, computed per hole from `ShotInput[]`:

- **GIR** (green in regulation): true iff some shot has `endLie === 'GREEN'` (or is
  holed directly onto/into the green) with `shotNo <= par - 2`. Par 3 requires the
  tee shot itself; par 5 allows 3 shots.
- **Putts**: `count(shots where startLie === 'GREEN')`.
- **Fairway hit**: only defined for par 4/5 holes (par 3 has no fairway stat, report
  `null`). True iff the tee shot's `endLie === 'FAIRWAY'`.
- **Up-and-down**: only attempted when `GIR` is false. True iff, from the first shot
  with `startLie !== 'GREEN'` after missing the green, the hole is completed in
  exactly 2 more shots (chip/pitch + 1 putt, or straight in) **and** gross score on
  that hole is par or better. Track attempted vs converted, not just a percentage.
- **Sand save**: the up-and-down subset where the shot right after missing the
  green started in `SAND`. Same par-or-better condition. Report attempted/converted
  so a 1-for-1 round doesn't misleadingly show "100%".

Round and multi-round aggregates (GIR%, putts/round, fairways hit %, sand save %,
up-and-down %) are plain averages over these per-hole booleans/counts — no new DB
columns, computed on read alongside the SG aggregates.

### Dashboard views

`/` round list + SG summary, with the traditional stats above showing as a compact
row per round (GIR X/18, Putts N, Fairways X/14, Sand saves x/y, Up-and-down x/y) —
recognisable at a glance next to the SG numbers, not replacing them.

`/insights`:
- SG by category: latest round vs mean of prior 3 (grouped bars)
- SG per round over time per category, 3-round rolling average
- Putting: SG and make% by band 0-3, 3-6, 6-10, 10-20, 20-30, 30ft+ vs baseline make%,
  plus putts/round trend
- Short game: SG by band 0-10, 10-20, 20-30y and by lie
- Bunker: greenside vs fairway, SG per shot, sand save % (from traditional-stats)
- Approach: SG by band <100, 100-150, 150-200, 200y+ and by start lie, plus GIR%
  and fairways-hit% trend
- Strokes lost to penalties and recovery, by hole
- Up-and-down % trend, split from sand-save % (they overlap but are not the same
  stat — sand save is the subset starting in sand)

Load the `dataviz` skill before writing any chart code.

---

## Phase 5 — Trends and practice focus

`src/lib/insights/trends.ts`. Show two things, and never conflate them:
- **Trend**: latest round vs mean of prior 3, per category, with a signal-strength
  indicator from shot count and variance. 4 rounds is ~120 putts but maybe 6 bunker
  shots — a 0.3-stroke move on 6 shots must be labelled noise, not improvement.
- **Practice priority**: ranked by *cumulative* SG lost over the last 4 rounds drilled
  to the band, e.g. "Putting 6-10ft: -1.8 strokes over 4 rounds (38 attempts)".

State plainly how many rounds are in the DB and what is not yet meaningful. With
fewer than 4 rounds, say so instead of drawing a trend line.

### Cross-course caveat — must be surfaced in the UI

The baseline is length-only. It calibrates to within 0.25 strokes at Elm Park
(parkland, known rating) but understates Portmarnock (links: wind, gorse, width) by
several shots. So raw SG at Portmarnock reads worse for identical quality of golf.

Implement `difficultyAdjustment(teeId)` = `(courseRating - sum(E(TEE, holeYards))) / 18`,
applied per hole, **off by default and clearly labelled**. It needs a course rating,
which Portmarnock's seed lacks — ask Conor for the CR/SR box on his card. Until then,
group trends by course, or warn when a comparison mixes courses.

---

## Verification

1. `pnpm test` — all Phase 1 tests green, including the invariant property test.
2. `pnpm db:seed` — checksums pass for all four tee sets.
3. `pnpm db:seed:demo` — synthetic 18-hole round with hand-computed totals; assert
   dashboard aggregates match.
4. `pnpm dev` — drive it in the browser pane: log a hole containing a bunker shot, a
   recovery punch-out and an OB penalty; confirm derived score == shot count +
   penalties and the SG breakdown is sane. Screenshot back to Conor.
5. Check the entry flow at 375px.

## Out of scope

Auth, GPS tracking, cloud deploy, handicap calculation, course maps, offline PWA sync.
