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

### Course filter

`/` and `/insights` both need a course filter — a control switching between
Conor's courses (Portmarnock Championship, Elm Park), since "vs prior 3" and the
rolling-average chart only make sense within one course (see the cross-course
caveat in Phase 5). Default to the course of the most recent round. The filter lists only
courses the player has logged a round on (the library is shared — since 0.0.9 unplayed
courses are left out); with no rounds at all there is no filter, just the empty state
("No rounds logged yet" + a log-round CTA). See the design mock's course-filter row
(https://claude.ai/artifact/5xuDRDUxDhpTwrbsYixSLB, Dashboard screen) for the
intended shape — two named buttons with a round count, not a generic dropdown.

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

### What to work on (roadmap) — replaces "Practice priority" on `/trends`

`src/lib/insights/roadmap.ts` (pure, tested), with Broadie's weights in
`src/lib/insights/importance-broadie.ts` (one reviewable data file, like the baseline).
Each area (the same buckets practice priority used: putting / short-game / approach
bands, bunker greenside / fairway, off the tee, recovery) gets three numbers, kept apart:

- **Importance**: Broadie's share of scoring differences for the area's part of the game
  (driving / approach > 100y / short game ≤ 100y / putting — *his* 100-yard line, so the
  app's "Approach <100y" band counts as short game), split across bands by how often you
  hit each one, over all rounds. `weight` = share × 4, so an average part of the game is 1.
  Tiers: high ≥ 1.2, mid ≥ 0.8, else lower.
- **Opportunity**: strokes lost to scratch per 18 holes over the last 8 rounds,
  `max(0, −ΣSG × 18 / holes played)`. Low < 0.25, medium < 0.75, high ≥ 0.75. Fewer than 10
  shots = "treat it as a hint".
- **Trend**: the later half of those rounds vs the earlier half, per-shot SG, labelled with
  the same `classifySignalStrength` gate. A change under 0.1 strokes per 18 is flat.

Ranked by **priority = importance weight × opportunity**. The group weight, not the band's
share, because opportunity already counts how often you hit the shot. Penalty strokes stay
inside the SG of the shot that caused them, so they are not an area of their own; each area
reports its penalty count in its sentence. The importance shares are placeholders
(`status: 'placeholder'`) until transcribed from the book, and the page says so.

### Cross-course caveat — must be surfaced in the UI

The baseline is length-only. It calibrates to within 0.25 strokes at Elm Park
(parkland, known rating) but understates Portmarnock (links: wind, gorse, width) by
several shots. So raw SG at Portmarnock reads worse for identical quality of golf.

Implement `difficultyAdjustment(teeId)` = `(courseRating - sum(E(TEE, holeYards))) / 18`,
applied per hole, **off by default and clearly labelled**. It needs a course rating,
which Portmarnock's seed lacks — ask Conor for the CR/SR box on his card. Until then,
group trends by course, or warn when a comparison mixes courses.

---

## Phase 6 — Postgres, accounts, invite-only multiplayer

**Goal:** friends sign in from a WhatsApp link, log their own rounds, share a course library and see each other's scores. Hosting: Vercel Hobby + Neon Postgres, $0.

- **Database:** Postgres via Drizzle `pg-core`. Production = Neon serverless **Pool** (interactive transactions; not the HTTP driver). Local and tests = PGlite. Every float is `doublePrecision` (pg `real` is float4 and corrupts fractional-yard green distances). All queries are async; `recomputeRound(roundId, tx?)` joins the caller's transaction so a shot save and its SG commit atomically. Migrations are `pnpm db:migrate` (run by `vercel-build`), never on import.
- **Auth:** Better Auth, Google only. Tables `user/session/account/verification`. Sessions cookie-cached 5 minutes.
- **Invite gate:** `/join/<INVITE_TOKEN>` sets an HttpOnly, SameSite=Lax, one-day cookie; the `user.create.before` hook calls `mayCreateAccount` and returns `false` unless the cookie matches or the verified admin is signing up. Unset `INVITE_TOKEN` closes sign-up.
- **Ownership:** `rounds.user_id` and `courses.created_by_user_id` (both nullable — null = legacy/seeded). `claimLegacyData` gives ownerless rounds to the admin at first sign-in.
- **Authorization:** one module, `src/lib/auth/guards.ts`, built on the pure rules in `permissions.ts`. Rounds: private — owner reads and writes; the admin alone may also read any round (read-only, no notes/ratings) and list players; ownerless rounds are admin-only. (Until 0.0.7 any signed-in user could read; changed after alpha feedback.) Courses/tees: creator or admin, locked to admin once another player has a round on the tee. Not visible to you → 404 (never 403, so ids can't be probed); visible but not yours (admin) → 403 on write. Every insights query takes a `userId`.
- **Yardage edits:** `applyTeeHoleEdits` re-bases shot 1 (and re-derives each hole's chain via `propagateChain`) for every round on the tee, then recomputes them, in one transaction. Previously an edit made every existing round on the tee unrecomputable (`computeHole` throws if shot 1's start ≠ the hole's yardage).
- **Data migration:** `scripts/migrate-sqlite-to-pg.ts` — one transaction, preserves ids, resets identity sequences, recomputes SG and asserts each round's gross score and SG total equal the SQLite values or rolls everything back.
- **Tests required:** golden SG values unchanged on Postgres; invite gate through the real Better Auth sign-up path (stranger rejected, invited accepted, unverified "admin" not admin, fails closed with no token); guard matrix (owner / other player / admin / ownerless / missing); tee-edit cascade incl. stroke-and-distance and rollback; `claimLegacyData` idempotent.

## Phase 7 — Course directory, courses played, map (issue #3)

**Goal:** every golf course on the island of Ireland (18- and 9-hole, North and South) on a map; each
player ticks off the ones they've played and gets a private "courses played" profile. Start with
Ireland; other countries later as more data files.

**Directory ≠ scorecard library.** A directory entry is just "this course exists, here" (name,
county, position, hole count, website). The scorecard library (`courses`/`tees`/`tee_holes`) stays
as it is: SG needs verified yardages, which the directory never has. The two are joined by
`courses.directory_key` (admin sets it on `/courses`), so a logged round ticks its course off
automatically.

- **Data:** OpenStreetMap (`leisure=golf_course`), ODbL — attribution shown on `/profile` and in the map.
  `scripts/fetch-course-directory.ts` (`pnpm directory:fetch`) queries Overpass and writes
  `src/lib/directory/data/ireland.json`, one course per line so refreshes diff cleanly. The
  **Course directory** workflow runs it on GitHub Actions (Overpass isn't reachable from every
  sandbox) and commits the result: on its own branch, or to `course-directory-refresh` when run
  from `main` (never straight to `main`, which deploys).
- **Static, not a table:** the directory is bundled JSON (`src/lib/directory/index.ts`). No seed
  step; a refresh ships with the next deploy.
- **Builder** (`src/lib/directory/build.ts`, pure, tested):
  - drop unnamed features, pitch & putt, driving ranges/practice areas/mini golf (by name or tag),
    and outlines under 250 m corner to corner;
  - merge the same club mapped twice (same name, or one name extending the other word-for-word,
    within 3 km), keeping the biggest outline;
  - county = the first administrative area containing the course that normalises to one of the 32
    traditional counties (`normaliseCounty`: "Fingal" → Dublin, "Cork City" → Cork, bilingual names…),
    else `addr:county`;
  - holes = a `holes` tag, else `golf=hole` ways inside the course's bounding box (smallest box
    wins; distinct `ref`s) — trusted only when it's a whole number of nines;
  - websites only if http(s);
  - `data/overrides.json`: `exclude` (key → reason), `set` (key → corrected fields), `add`
    (courses OSM lacks; keys `manual:<slug>`).
- **Stable keys:** `osm:<type>/<id>` / `manual:<slug>`, stored in `played_courses`. A key that
  disappears from OSM is carried over flagged `stale` (`mergeWithPrevious`) rather than breaking
  anyone's list; only an explicit `exclude` removes it.
- **Schema:** `played_courses (user_id, course_key, added_at)`, PK (user, key); `courses.directory_key`.
- **Played =** ticked in `played_courses` OR a round on a linked course (`buildPlayedProfile`,
  pure). Only ticked ones can be un-ticked; a round is proof.
- **API:** `PUT /api/played-courses {key, played}` (own list only; key must be in the directory);
  `PATCH /api/courses/[courseId] {directoryKey | null}` (admin only, 404 otherwise).
- **UI:** `/profile` (nav "Played"): stat tiles (played / total, counties / 32, 18-hole, 9-hole);
  Leaflet map (CARTO Positron basemap, green dot = played, tap for details and a toggle;
  wheel-zoom only after a click); search + county filter with Played toggles (optimistic);
  "Your courses" grouped by county. Private to the player, like rounds.
- **Tests required:** `normaliseCounty` table; website sanitising; hole counting (smallest box,
  distinct refs, unnumbered fallback); filters; duplicate merge vs. near-name neighbours;
  overrides incl. refusing a bad `add` key or non-county; `mergeWithPrevious` stale/un-stale/exclude;
  `buildPlayedProfile` (ticked ∪ rounds, per-county, unknown keys); DB: tick/untick idempotent and
  per player; only the player's rounds on linked courses count.

- **Data-quality rules learned from the first fetches:** Overpass `out tags center bb` returns
  only bounds for ways (use the box middle); a 200 response can carry PARTIAL results plus a
  `remark` (treat as a failure and retry); a known hole count never reverts to unknown on refresh;
  "Links" names a separate course (Portmarnock Links ≠ Portmarnock GC) so only generic extra words
  ("& Sports", "Estate") merge names; par-3 courses are excluded like pitch & putt; a tiny outline
  named "… Golf Club" is the clubhouse standing in for the course, so it's kept; features with no
  name fall back to `official_name`/`operator`, and the rest are listed so an override can name one.
  Courses OSM doesn't tag at all (Lahinch) go in `overrides.json` `add`.
- **Top 100 challenge** (`src/lib/directory/top100.ts`, tested): `data/top100.json`
  `{title, year, source, entries: [{rank, name, key|null}]}`. `matchTop100` scores ranked names
  against directory names (share of the ranked name's significant words found, minus 0.05 per extra
  word; parenthesised course names like "(Old)" ignored); a match needs ≥ 0.75, must beat the
  runner-up outright, and must not already be ranked — otherwise it's left `null` with guesses.
  `validateTop100` (duplicate ranks/keys, unknown keys) runs as a test against the committed files.
  UI: gold `#n` badge, gold map ring, "Top 100" stat tile, "Top 100 only, in rank order" filter —
  all hidden while the list is empty.

**Not built yet (follow-ups):** sharing a profile with friends; other countries; a per-county
"completion" view; letting players suggest directory fixes in-app (today: course requests →
admin edits `overrides.json`).

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

GPS tracking, handicap calculation, hole-level course maps, offline PWA sync. (Auth and cloud deploy were out of scope for Phases 1–5 and are the subject of Phase 6.)
