# Strokes Gained App — MVP Plan

## Context

You want to know which parts of your golf game are actually costing you shots, and whether practice is
working. Scorecard stats (putts, GIR) can't answer that: two putts from 40ft is good, two putts from 4ft
is awful, and both show as "2 putts". Strokes gained (Mark Broadie's method, from *Every Shot Counts*)
fixes this by comparing every shot against the expected number of strokes to hole out from where it
started versus where it finished.

This is a greenfield build in `/Users/conoromara/strokes-gained` (currently empty). The deliverable is a
mobile-friendly web app you enter rounds into, a SQLite database you own, and a dashboard that tells you
where you're losing shots and what to practise.

**Decisions locked from our Q&A:**

| Decision | Choice |
|---|---|
| Entry detail | Full shot-by-shot (lie + distance per shot) — true SG, including approach |
| Baseline | Scratch golfer (0 handicap), stored so Tour/handicap baselines can be swapped in |
| Hosting | Local Next.js + SQLite file you keep; Postgres-portable schema; reachable from phone on wifi |
| Course data | You enter it via an in-app course/tee editor |

> Note: my shell `cd` moved this session's primary working directory to the scratchpad. All work goes in
> `/Users/conoromara/strokes-gained` using absolute paths; I'll reset the directory first.

---

## The core model

### Expected strokes

`E(lie, distance)` = expected strokes to hole out for a scratch golfer. Six lies:
`TEE`, `FAIRWAY`, `ROUGH`, `SAND`, `RECOVERY`, `GREEN`.

### Strokes gained per shot

```
SG(shot) = E(start_lie, start_dist) − E(end_lie, end_dist) − 1 − penalty_strokes
```

A holed shot has `E(end) = 0`. Each shot's start position *is* the previous shot's end position, so the
UI only ever asks you for the **result** of a shot — the chain gives you the rest.

**Invariant that makes this testable:** summing SG across a hole must equal
`E(TEE, hole_yardage) − gross_score`. This becomes an assertion in the engine and a property test — if
data entry or the maths is wrong, it fails loudly rather than producing plausible-but-wrong numbers.

### Scoring categories

Broadie/PGA Tour convention, with sand pulled out into its own category because you asked for bunker as
a scoring area:

| Category | Definition |
|---|---|
| Off the tee | Tee shots on par 4s and 5s |
| Approach | Non-tee shots from > 30 yards (plus par-3 tee shots), non-sand |
| Short game | Shots from ≤ 30 yards, not on green, not sand |
| Bunker | All `SAND` shots, sub-split greenside (≤ 30y) vs fairway (> 30y) |
| Putting | Shots with `start_lie = GREEN` |
| Recovery & penalty | `RECOVERY` shots and all penalty strokes (also attributed to the causing shot) |

Deviating from Tour convention on sand is deliberate and will be labelled in the UI, so a published
SG-Approach number stays comparable if you ever want it.

### Recovery shots and penalties (requirement 4)

Two distinct mechanisms, both needed:

1. **`RECOVERY` as a real lie with its own baseline curve.** `E(RECOVERY, 180y)` is meaningfully higher
   than `E(ROUGH, 180y)` — no shot at the green, you have to punch out. This matters twice: the *previous*
   shot correctly absorbs the cost of putting you in the trees, and the recovery shot itself is not
   unfairly punished for advancing only 90 yards. Without a recovery lie, punch-outs read as terrible
   approach shots and the real error (the drive) goes unpunished.
2. **Explicit penalty strokes**, entered per shot, with drop handling for the two cases that differ:
   - *Lateral / drop*: `penalty_strokes = 1`, you enter the drop position as the shot's end.
   - *Stroke and distance* (OB, lost ball): `penalty_strokes = 1`, end position auto-set back to the
     start position — so the shot costs a full 2 strokes of SG, which is correct.

Penalties are attributed to the category of the shot that caused them, and also reported separately, so
a blow-up hole shows up as "off the tee" damage rather than silently inflating your approach numbers.

**Worked example — the recovery penalty lands on the preceding shot.** 300y par 4, 240y drive leaving
60y but in a recovery position:

| | Drive ends in `RECOVERY` at 60y | Drive ends in `FAIRWAY` at 60y |
|---|---|---|
| `E(TEE, 300)` | 3.85 | 3.85 |
| `E(end)` | `E(RECOVERY, 60)` ≈ 3.10 | `E(FAIRWAY, 60)` ≈ 2.65 |
| SG(drive) | **−0.25** | **+0.20** |

Same distance gained, ~0.45 strokes of difference, charged to the drive. This is not a special rule — it
falls straight out of `SG = E(start) − E(end) − 1`, because the drive is scored on the position it left.
The punch-out then starts from that same 3.10 expectation, so it is judged fairly instead of reading as a
terrible 60-yard approach. **This becomes an explicit engine test case**, asserting the drive's SG is
strictly lower for a recovery finish than a fairway finish at identical distance.

Two consequences worth being upfront about:

1. **The size of that penalty is entirely a property of the baseline table** — specifically how far the
   `RECOVERY` curve sits above `FAIRWAY`/`ROUGH` at the *same* distance. The gap is widest at short
   distances (60y recovery is nearly as bad as 60y is good from the fairway), which is exactly where
   punch-outs happen. This is the single most important part of the table to get right for your game, and
   another reason it's isolated in one reviewable file.
2. **`RECOVERY` is a judgement call at entry time, so the definition must be tight and consistent.** The
   UI will define it as: *no realistic shot at the green — you must play sideways, out, or lay up.* If it
   drifts to meaning "a bit awkward", your off-the-tee numbers get quietly punished. The entry screen will
   show that one-line definition next to the button, and a "trees/blocked" hint, so the label means the
   same thing in round 1 and round 30.

### Baseline data — the one real accuracy risk

The expected-strokes table is the foundation; a wrong table makes every number wrong in a way that still
*looks* reasonable. Being straight with you: I do not have Broadie's published tables memorised to two
decimal places, so I will not pretend to.

Approach:
- Encode anchor points per lie at standard distances in **one** file, `src/lib/sg/baseline-scratch.ts`,
  with source attribution per row and monotone cubic interpolation between anchors.
- Validate with a test suite of structural invariants rather than trusting the numbers blind:
  monotonic increasing in distance, `E(GREEN, 2ft) ≈ 1.0`, two-putt crossover (`E = 2.0`) around 30–33ft,
  `E(SAND) > E(ROUGH) > E(FAIRWAY)` at equal distance, `E(RECOVERY) > E(SAND)`, and a scratch round
  totalling roughly level par on a course of known rating.
- Because it is one isolated file, correcting a value later is a one-line change plus
  `pnpm sg:recompute` — every stored SG number re-derives. I'll flag the table for your eyeball before
  we rely on the output.

---

## Stack

- **Next.js 15** (App Router) + TypeScript — one app serving UI and API, mobile-first
- **SQLite** via `better-sqlite3` + **Drizzle ORM** — DB at `data/rounds.db`, a single file you can copy,
  back up or commit. Drizzle keeps the schema Postgres-portable if you later deploy.
- **Tailwind** — fast thumb-friendly UI
- **Recharts** — dashboard charts
- **Vitest** — engine tests (this is where the value is; the maths gets real coverage)

Phone access on home wifi via `next dev -H 0.0.0.0` at `http://<mac-ip>:3000`.

---

## Schema

`src/db/schema.ts`:

```
courses         id, name, location
tees            id, course_id, name, gender, distance_unit, course_rating, slope_rating
tee_holes       id, tee_id, hole_no, par, stroke_index, yards
rounds          id, course_id, tee_id, played_on, weather, notes
shots           id, round_id, hole_no, shot_no,
                start_lie, start_yards,
                end_lie, end_yards, holed,
                penalty_strokes, penalty_type,
                sg, category            -- derived, refreshed on write
```

Notes:
- **Canonical distance unit is yards** everywhere (`REAL`). Putts are stored in yards and displayed in
  feet. `tees.distance_unit` exists because Irish cards are often in metres — Elm Park and Portmarnock
  both publish yards, so no conversion for these two, but the field prevents a silent unit bug later.
- `shots.sg` / `shots.category` are denormalised so you can query SG directly in SQL, and refreshed by
  `recomputeRound()` on every mutation. `pnpm sg:recompute --all` rebuilds everything after a baseline
  change.
- Score per hole is derived (`shot count + penalties`), never entered — so it can't disagree with the shots.

---

## Build phases

### Phase 1 — Engine first (headless, fully tested)
Files: `src/lib/sg/baseline-scratch.ts`, `interpolate.ts`, `categorise.ts`, `compute.ts`, plus
`src/db/schema.ts` and migrations.

The pure SG engine with no UI: `computeHole(shots, holeYards, par) → ShotSG[]`. Tests cover the
per-hole invariant, a hand-computed worked hole, penalties (both types), recovery lies, and the baseline
structural invariants. **Nothing else gets built until this is green** — every downstream number depends
on it.

### Phase 2 — Course import + tee editor (requirement 5)

You're supplying a spreadsheet, so this phase is **import-first**:

- **Importer** (`scripts/import-courses.ts`, plus an `/import` upload page): accepts `.xlsx`/`.csv`, reads
  the sheet, prints the detected columns and a preview, then maps them to
  `courses` / `tees` / `tee_holes`. I'll write the mapping against your actual file rather than guessing a
  format — wide (one column per tee) and long (one row per hole per tee) layouts are both easy to handle
  once I can see it.
- **Validation on import**, because a silent yardage typo corrupts every SG number downstream: per-nine
  and total yardage checksums against the card totals, par sums, and a check that stroke indexes are a
  complete 1–18 permutation. Anything that fails is reported row-by-row and rejected, not imported.
- **Editor** (`/courses`) still gets built: the 18-row grid (par, stroke index, yards) with live out/in/total
  sums, for fixing anything the import got wrong and for adding courses later without a spreadsheet.

Target state: Elm Park (Blue, White) and Portmarnock Championship — Red + Blue nines, White and Green tees
you play, with Blue and Yellow stored too.

The spreadsheet is course/tee data only, so there is no historical-round import: SG history starts with
your first logged round. Phases 4 and 5 will be built and verified against a synthetic seed round, and the
latest-vs-prior-3 comparison becomes live once you've logged 4 rounds. The dashboard will state plainly
how many rounds are in and what isn't meaningful yet, rather than drawing confident trend lines from one round.

> I did read Elm Park's card while checking feasibility and have Blue/White verified against its own
> out/in/total and stroke-index checksums. If your spreadsheet doesn't cover it, I can pre-fill it.

### Phase 3 — Round entry (requirement 1)
`/rounds/new` → pick course, tee, date. Then a hole-by-hole mobile flow:
- Shot 1 pre-filled from the card (`TEE`, hole yardage)
- Per shot you tap **result only**: one of six big lie buttons + distance on a numeric keypad
  (auto-switches to feet on the green), or **Holed**
- Penalty toggle with the two drop types
- Running SG for the hole shown live — instant feedback and it catches entry errors on the spot
- Resume a part-entered round; edit any past shot

Target ~60–90s per hole, and the derived score is displayed so you can check it against your card.

### Phase 4 — Dashboard (requirement 3)

Also derives the traditional scorecard stats — GIR, putts, fairways hit, sand
saves, up-and-downs — since every one is a pure function of the shots already
logged in Phase 3. No new inputs, no chance of disagreeing with the shot log.
Exact derivation rules are in `BUILD.md`.

`/` — round list and SG summary. `/insights`:
- SG by category, latest round vs prior-3 average (grouped bars)
- SG per round over time, per category, with 3-round rolling average
- **Putting**: SG and make% by distance band (0–3, 3–6, 6–10, 10–20, 20–30, 30ft+) against baseline make%
- **Short game**: SG by band (0–10, 10–20, 20–30y) and by lie
- **Bunker**: greenside vs fairway, SG per shot, up-and-down %
- **Approach**: SG by band (<100, 100–150, 150–200, 200y+) and by start lie
- Strokes lost to penalties and recovery, by hole

Arccos-style presentation: category totals up top, drill into bands underneath.

### Phase 5 — Trends and practice focus (requirement 6)
`src/lib/insights/trends.ts` — latest round vs mean of previous 3, per category and per band.

One deliberate design point: a single round is a small sample, and 4 rounds of putting is ~120 shots but
4 rounds of bunker play might be 6 shots. So the page shows two separate things and does not conflate
them:
- **Trend** — the latest-vs-prior-3 delta, with a signal-strength indicator from shot count and variance.
  A 0.3-shot move on 6 bunker shots is labelled as noise, not improvement.
- **Practice priority** — ranked by *cumulative* SG lost across the last 4 rounds drilled to the specific
  band, e.g. "Putting 6–10ft: −1.8 strokes over 4 rounds (38 attempts)". That is a stable signal worth
  acting on.

This keeps the app honest instead of telling you you've fixed your bunker play because of one lucky splash.

---

## Verification

1. `pnpm test` — engine unit + property tests, including the per-hole SG invariant and baseline checks.
2. `pnpm db:seed:demo` — loads a synthetic 18-hole round with a known hand-computed answer; asserts the
   dashboard aggregates match. Covers the charts without needing you to enter real rounds first.
3. `pnpm dev` — I'll drive the app in the browser pane: create a course, enter a tee, log a full hole
   including a bunker shot, a recovery punch-out and an OB penalty, and confirm the derived score matches
   the shot count and the SG breakdown reads sensibly. Screenshots back to you.
4. Mobile check at 375px viewport for the entry flow, since that's where you'll actually use it.
5. Then you enter one real round and we sanity-check the output together before trusting the trends.

## Out of scope for MVP

GPS shot tracking, handicap calculation, course maps, offline PWA sync. (Multi-user/auth and cloud deploy were originally out of scope; see BUILD.md Phase 6.)
The schema and the baseline abstraction leave room for all of them.
