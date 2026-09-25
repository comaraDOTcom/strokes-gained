# Trends page: review and redesign plan

For [issue #5](https://github.com/comaraDOTcom/strokes-gained/issues/5) — "improve trend page visual clarity".
Status: **reviewed, decisions agreed (section 4)**, nothing implemented yet.

Reviewed against a local build with 12 synthetic rounds (9 Elm Park, 3 Portmarnock, June–September)
generated so that putting improves, approach worsens, and off-the-tee carries penalties. The shapes
below are from that render; the exact numbers on Conor's real data will differ, the problems won't.

## 1. What the page is for

One question a player brings to this page: **"Am I getting better, and what should I practise next?"**

Everything on the page should either answer that or get out of the way. Today the answer ("What to
work on") is the fourth of five sections, roughly five phone-screens down, after a calendar, seven
charts and a six-row list that says "noise" on every row.

## 2. Findings

### 2.1 Length and order

| Measure (phone, 390px) | Today |
|---|---|
| Page height | ~5,800px ≈ 7 screens |
| Words of prose | ~960 |
| Sections | 5 (calendar, quality charts, latest-vs-prior, what to work on, difficulty adjustment) |
| Charts | 7 line charts + 5 sparklines + 1 stacked bar |
| Scroll to first actionable sentence | ~4,000px |

The order is **evidence → evidence → verdict → footnote**. A player reacts to a verdict, then looks
for the evidence if they doubt it. The order should be **verdict → focus → evidence → rhythm → methods**.

### 2.2 "Trending over time should be clear (currently it's not)"

This is the *Shot quality over time* section, and three things hide the trend:

1. **Every chart has its own y-scale.** Off the tee runs 50–110, Short game 70–130, Bunker 70–150.
   A 10-point move looks steep in one card and flat in the next, so the eye can't compare areas.
2. **Colour encodes "vs scratch", not direction.** All six headline numbers under 100 are red. For any
   handicap golfer the page is a wall of red whatever the trend, and *Putting 97* (up ~15 points
   since June, the best news on the page) is red like everything else. On Insights, red = strokes
   lost to scratch is right. On Trends the question is "better than *my* past?", so colour should
   encode direction of change, with scratch kept as a reference line only.
3. **No delta is stated.** "86" says nothing; "86, up 3 on the previous 5 rounds" is the trend.
   The per-round grey dots also compete with the line on the small cards and add noise.

### 2.3 "Trend — latest round vs mean of prior 3" says nothing

With 12 rounds, all six rows read *"noise — too few shots to read anything into this"*, including
Putting (31 putts vs ~90 prior). The signal test (`classifySignalStrength`) needs z ≥ 2 on per-shot
SG, whose variance is huge, so one round vs three will almost never clear it. The section costs a
full screen, the chip wraps onto two lines on a phone, and it duplicates the trend chip on each
roadmap card. **Remove it as a section**; the one useful fact in it (latest round vs your recent
average) belongs in the hero.

### 2.4 "What to work on" is the best section, and it's buried

Keep the model (importance × opportunity × trend). Fix the presentation:

- **Methodology before answer.** A 60-word explanation, then the importance bar and four tiles, then a
  placeholder warning, and *then* the ranked cards. Lead with the cards; move the method into a
  collapsed "How this is ranked".
- **Trend is shown four times per card**: sparkline, `TREND ↓ WORSENING` chip, `limited data` chip,
  and the sentence. Once is enough: one line, e.g. *Getting worse · limited data*.
- **Contradictions.** Card 4 says "there aren't enough shots yet to see a trend" while its chip says
  `TREND ↓ WORSENING`. When the signal is `noise`, don't print a direction.
- **The sentence hides the fix.** "You lose 6.3 strokes a round here (including 7 penalty strokes);
  it's a mid-importance area and it may be improving." The actionable part is the penalties: *7
  penalty strokes in 8 rounds is most of the 6.3.* Lead with the cause.
- **Sparklines have no scale.** Eight bars hanging below a line, all red, at 32px tall; "improving"
  is invisible. Either give them a clear before/after split (two shaded halves) or drop them and
  let the delta text carry it.
- **Cards 2 and 3 are both approach bands** (100–150y, 150–200y). Group by area with the bands as
  sub-lines so the top of the list reads *Off the tee · Approach · Wedges*, not three variations of
  one thing.
- Five cards is one too many on a phone. Three, with "All 17 areas" below, is enough to act on.

### 2.5 Sections that don't earn their space

- **When you played** (calendar): a full phone screen, four stat tiles, and it's the first thing on
  the page. It's pleasant, not decision-driving. Keep it, but compact (one row of squares plus
  "9 rounds · last 5 days ago") and lower down, or move it to the Rounds page.
- **Cross-course difficulty adjustment**: a formula on screen (`Σ E(TEE, hole yardage)`), a 12-row
  table that duplicates the Rounds page, and a toggle that changes nothing because Portmarnock has no
  rating. Collapse to one line in a "Methods and caveats" footnote until a rating exists.
- **Header caveat**: an amber sentence ending in "..", telling the reader to go find "the cross-course
  caveat below". Make it one muted line, or drop it and let the footnote carry it.

### 2.6 What the issue asks for that doesn't exist yet

1. Compare time periods: no period control; every section uses a different window (90 days, last 5
   rounds, latest vs prior 3, last 8 rounds, all rounds).
2. Compare rounds: nothing.
3. Admin compare players: `/players` is a list with a round count.

## 3. Plan

Each phase ships on its own. Phase 1 alone closes most of the issue's first sentence.

### Phase 1 — Restructure and cut (no new data, no schema)

Target: the answer on the first phone screen, ≤ 3 screens for everything a player needs,
≤ 400 words of prose.

New order and content:

1. **Hero: "Where you are"**. Last 2 rounds vs the 2 before (the default period; see Phase 2):
   SG per round vs scratch, the change with an up/down colour, one sentence:
   *"−9.8 a round, 1.6 better than the four before. Putting is carrying it; approach play is giving
   it back."* Same treatment for shot quality (one number, one delta).
2. **"Work on this"** — three cards, area-grouped, each: name · strokes a round · one-line cause and
   fix · one trend line (direction only when it's not noise) · a before/after mini-bar. "Holding up"
   as one line. "All 17 areas" and "How this is ranked" collapsed.
3. **"Over time"** — shot quality, one shared y-scale for every area, headline number coloured by
   direction (not vs scratch), delta badge, dots only on the "All shots" card, scratch as a dashed
   reference line. Six small multiples in a 2×3 grid.
4. **Rhythm** — one line (rounds in 90 days, days since the last). The calendar moves to Rounds.
5. **"Methods and caveats"** — a `<details>`: cross-course note, importance placeholder note,
   signal rules. The adjustment toggle and table come back only when a course rating exists.

Delete: the "Trend — latest round vs prior 3" section. Its logic (`categoryTrends`) stays in the
library for tests and the hero.

Files: `src/app/trends/page.tsx`, `roadmap.tsx`, `quality-trends.tsx`, `play-calendar.tsx`,
`difficulty-toggle.tsx`; a new `src/lib/insights/period.ts` (pure: split rounds into "recent" and
"before", totals and deltas per area) with tests; `qualityAxis` gains a shared-domain mode.

### Phase 2 — Compare time periods (issue item 1)

A period picker at the top of the page, kept in the URL (`?period=…`, like `?course=` on Insights):

| Option | Recent | Before |
|---|---|---|
| Last 2 rounds (default) | last 2 | the 2 before |
| Last 4 / 8 rounds | last 4 / 8 | the same number before |
| Last 30 / 90 days | rounds in the window | the same length before it |
| This year vs last year | calendar years | |
| Custom | two date ranges | |

One choice drives the hero, the cards and the quality charts, replacing today's five different
windows. Per-area "before vs recent" as a grouped bar (existing `GroupedBarChart`) with one
delta column. Course filter reused from Insights so a comparison can be held to one course, which
is the honest answer to the cross-course caveat.

Files: `period.ts` (Phase 1) grows the date modes; a small client `period-picker.tsx`; page wiring.

### Phase 3 — Compare rounds (issue item 2)

Pick two (up to three) rounds and see them side by side: score, SG total, SG per area, shot quality,
and the biggest single-shot differences. Entry points: a "Compare" action on the Rounds list and on
a round page; state in the URL (`?compare=12,15`) so it can be shared.

Files: pure `src/lib/insights/compare-rounds.ts` (+ tests) on top of `roundSummaries` and
`drillArea`; a `/trends/compare` route or a section on `/trends`; a round picker.

### Phase 4 — Admin compare players (issue item 3)

On `/players`, admin only: a table of players × areas over a common window (last 8 rounds):
SG per round, shot quality, rounds logged. Same privacy rule as today: scores, shots and SG only,
never notes or ratings. Sort by any column. Optionally a per-area grouped bar for 2–4 selected
players.

Files: pure `src/lib/insights/compare-players.ts` (+ tests); `/players/compare` page using
`getAllEnrichedShots` per player behind the existing admin guard.

### Phase 5 — Signal thresholds

`classifySignalStrength` is calibrated so that almost nothing is ever "signal". Options, in order of
preference: (a) test the per-18 delta against the between-round spread rather than per-shot
variance; (b) keep the gate but show direction with a confidence mark (●○○ / ●●○ / ●●●) instead of
suppressing it; (c) loosen the z thresholds. Decide after looking at how the labels fall on real
data. Whatever the choice, a `noise` label must never sit beside a printed direction.

## 4. Decisions (agreed 2026-09-25)

1. **Hero numbers are vs scratch**, as on every other page: SG per round and shot quality over the
   recent period. The *change* against the previous period is shown beside them and coloured by
   direction (better / worse than your own past). Scratch stays the reference line on charts.
2. **Default period: last 2 rounds vs the 2 before.** Getting to four rounds is an achievement in
   itself, so the page must work from round 1: with fewer than 4 rounds the hero shows the recent
   number only, no delta. Two rounds is ~160 shots, so most deltas will carry a "limited" mark; the
   hero says "last 2 rounds" plainly and the Phase 2 picker lets you widen the window.
3. **Calendar moves to the Rounds page** (top of the list, where "tap a day to open that round"
   already lands you). Trends keeps one line: "9 rounds in 90 days · last 5 days ago".
4. **Cross-course adjustment is hidden** until a tee has a course rating on file. One sentence in
   "Methods and caveats" says so.
5. **Three cards** in "Work on this".

Phase 1 changes accordingly: `period.ts` defaults to 2 vs 2 and degrades to "recent only" under 4
rounds; the calendar component moves to `src/app/page.tsx`; `difficulty-toggle.tsx` is only rendered
when at least one round's tee has a rating.
