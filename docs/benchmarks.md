# Score-distribution benchmarks

**Goal:** show how your holes finish (eagle, birdie, par, bogey, double or worse) next to how
**scratch golfers'** holes finish, plus the two ratios that matter:
- **par or better : bogey**
- **par or better : double+**

This extends "How your holes finish" on `/insights`.

## Where the numbers come from

- **Source.** Round histories of about 5 scratch golfers, viewed in a golf-stats app the owner
  has access to and captured as screenshots.
- **Screenshots stay local.** They go in `benchmarks-raw/`, which is **git-ignored**. They are
  never committed, uploaded or shared: this repo is public.
- **Only anonymised counts reach the repo.** They live in
  `src/lib/insights/benchmark-data/scratch.json`, one entry per player:

  ```json
  { "id": "A", "rounds": 10, "holes": { "eagle": 1, "birdie": 38, "par": 112, "bogey": 26, "doublePlus": 3 } }
  ```

- **Anonymisation rules.** A test enforces them.
  - Player ids are single letters (A, B, C…), assigned in no particular order.
  - No names, initials, clubs, courses, dates or handicap indexes.
  - No per-round scores: only totals across each player's rounds. That makes a player
    impossible to pick out from a scorecard.

## Transcribing screenshots

1. Drop the screenshots into `benchmarks-raw/<letter>/`, one folder per player.
2. Read each one and count holes per bucket. The source app may show round-by-round cards
   (count hole by hole) or a stats summary (use its counts).
   - **Summary shows only percentages:** record `rounds`, then convert back to counts:
     `round(pct × rounds × 18)`.
   - **"Double bogey or worse" is one number** in most apps, so the benchmark has five buckets.
     Our own six (double and triple+ separately) are folded into five when comparing.
3. `validateBenchmark` checks each entry:
   - whole numbers only;
   - hole totals that fit the round count;
   - no duplicate ids;
   - ids that aren't letters, which catches a pasted name.

   A test runs it against the committed file, so CI fails on a bad or de-anonymised transcription.

## The maths (`src/lib/insights/benchmarks.ts`)

- **Pooled shares.** Sum every player's holes, then divide. Each **hole** counts once, so a
  player with 20 rounds weighs more than one with 5.
- **Spread.** The lowest and highest share of any single player, per bucket. This is the
  "scratch band". Five players is a small sample, so the UI shows the band as well as the average.
  It shouldn't imply more precision than five golfers can give.
- **Ratios.** Computed from the pooled counts, the same way as ours: (eagle + birdie + par) ÷ bogey,
  and ÷ double+.
- **Comparison (`compareToBenchmark`).** For each bucket: your share, the scratch share, the
  difference, and whether you sit inside the scratch band.

## Planned UI (next commit on this PR, once real data is in)

In **How your holes finish**:
- **On each bar:** a thin marker at the scratch share, with the scratch band as a faint strip
  behind it. Your bar stays as it is.
- **Under each ratio:** the scratch figure, e.g. "scratch 4.1 : 1".
- **One headline sentence:** the bucket furthest from scratch, e.g. *"You make a double or worse
  on 14% of holes; scratch players on 3%."*
- **Sample size, stated:** "5 scratch golfers, N rounds".
- **Empty data file:** the benchmark is hidden and nothing changes.

## Caveats, stated on screen

- **Small sample.** About 5 players. It's a guide, not a statistic.
- **Different courses.** Their rounds are spread across courses; yours are filtered to one
  course. A hard course pushes everyone's bogeys up. We compare anyway: that's what the band is for.
- **Different app.** The source app's definitions (e.g. how penalty strokes count) may differ
  slightly. Gross scores per hole are unambiguous, which is why we only take score-to-par buckets
  from it.

## Checklist

- [x] Pure calculation code with tests: pooling, spread, ratios, comparison, 6→5 bucket folding
- [x] Validation, including an anonymisation check on the committed file
- [x] Screenshot folder git-ignored
- [ ] Transcribe 5 players into `scratch.json`
- [ ] Benchmark markers, scratch ratios and headline on "How your holes finish"
- [ ] Release note
