# Quality register

The one place where the state of every feature's data and insight quality is written down, so a
problem a player would notice is never only in a chat. Read it before demoing, before a release,
and before starting work on a station. Update it in the same commit as the code or data that
changes it. Each open item links a GitHub issue, and where a check exists in code it's named:
a row with a check can't drift, a row without one is a promise.

Confidence: **A** verified by a test or gate on the committed data · **B** verified by hand, no
check · **C** known gap, labelled in the UI · **D** known gap, not labelled in the UI.

| Feature | Data or logic it rests on | Confidence | Known issues | Check | Issue |
|---|---|---|---|---|---|
| Strokes-gained engine | Scratch baseline calibrated to Elm Park's rating; length-only | A | Understates a links course; Portmarnock has no rating | `baseline-structural.test.ts`, `compute.test.ts` property test | #39 |
| Shot entry and editing | Server-derived chain; whole-round recompute in one transaction | A | A shot entered as **0 ft / 0 yd and not holed** is scored as holed: ~1.9 strokes move from putting to approach with no invariant firing (found by `/how --critique`, reproduced on the golden hole: +2.110 / −1.000 instead of +0.180 / +0.930). Body fields `endLie`, `penaltyType`, `penaltyStrokes` not validated at the API. Tail-tag fallback keeps putt tags on a non-putt. | `save-shot.test.ts`, `chain.test.ts` (none for the 0-distance case yet) | #40 |
| Insights: SG tables, recap, quality badge | Stored `shots.sg`; null rows dropped in queries | A | Quality badge fades under 10 shots (labelled) | `queries.test.ts`, `quality.test.ts` | — |
| Scoring: holes vs scratch benchmark | `benchmark-data/scratch.json` | D | **2 players, 33 rounds**; `docs/benchmarks.md` says "about 5" | `benchmarks.test.ts` (anonymisation only, not size) | #39 |
| Trends: What to work on | Broadie importance shares | C | Shares are `status: 'placeholder'`; page shows the caveat | `importance-broadie.test.ts` | #39 |
| Trends: cross-course difficulty | Course ratings | C | Off until Portmarnock has a rating | — | #39 |
| Course library (scorecards) | `seed-courses.ts` + imports | A | Elm Park and Portmarnock verified against club cards; imports from GolfCourseAPI often lack stroke indexes | `checksum.test.ts`, `validateCourseChecksums` | — |
| **Played: course directory** | `directory/data/ireland.json` from OpenStreetMap | **B → A** | 405 courses; **67% no hole count**; Killarney, Ceann Sibéal, Seapoint, Glasson, Athlone, County Louth (as "Baltray"), Carton House (by course names only) missing or misnamed; 2 duplicate clubs; county counts thin (Kerry 13, Louth 4, Limerick 6, Westmeath 4). Fixed by #37: the 4 non-courses, Derry naming, Waterford GC and Carlow counties, venue names for The Burrow, Deerpark, Kinsealy Grange | `data-quality.test.ts` (ratchet + known lists) | #38, #46, #47, #48 |
| Played: Top 100 challenge | `directory/data/top100.json` | D | Empty; badge, ring, tile and filter never show | `top100.test.ts` (consistency only) | #38 |
| Voice entry | Cloudflare Whisper + golf vocabulary | B | Test bench only (`/voice`) | `transcribe.test.ts`, `vocabulary.test.ts` | — |
| Sign-up and invites | Better Auth, invite cookie, magic link | A | Removing a user takes up to 5 min (cookie cache) | `guards.test.ts`, `invite-gate.test.ts` | #33 |
| Charts in the dark theme | `CATEGORICAL` in `chart-colors.ts` (light-mode dataviz palette) | B | Gain/loss, chrome and tooltips follow the theme; the categorical hues don't. On the dark card violet is **1.8:1**, blue 3.5:1, green 3.1:1. Every chart has a legend or label, so nothing is colour-only | `theme-contrast.test.ts` (tokens only, not the categorical hues) | #62 |

## How a problem gets here

1. Anyone (Claude, a subagent's "Noticed" section, a player's course request, a demo) finds a
   quality problem.
2. It is written here in the same session, with a confidence grade, and a GitHub issue is opened
   or updated with the numbers. Chat is not a store.
3. Where the data is a committed file, a ratchet test is added or extended so the problem can't
   come back unnoticed and the known-issues list can't drift (`data-quality.test.ts` is the model).
4. When it's fixed, the row's confidence goes up, the issue closes, and the known-issues entry in
   the test is removed in the same commit (the test fails until it is).

## Data sources and their limits

| Source | Used for | Limit |
|---|---|---|
| OpenStreetMap via Overpass (ODbL) | Course directory | Coverage and hole tagging are volunteer-driven; a fetch can be partial (guarded: >3 drops refuses to write) |
| Club scorecards (by hand) | Elm Park, Portmarnock tees | Two courses; Portmarnock has no rating |
| GolfCourseAPI (`pnpm courses:api`) | Adding scorecard courses | Free tier 35 requests/day; Irish coverage patchy; stroke indexes often absent |
| Screenshots of ~2 scratch golfers' histories | Benchmark distribution | Tiny sample; anonymised counts only |
| *Every Shot Counts* (Broadie) | Importance shares | Not yet transcribed |
