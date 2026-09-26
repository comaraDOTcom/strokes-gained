# Changelog

Each shipped feature or fix gets its own release: bump `version` in `package.json`, add an
entry here, then either push an annotated tag `vX.Y.Z` or run the Release workflow by hand on
`main` (Actions → Release → Run workflow, give it a short title) — it creates the tag for you.
Either way the workflow publishes the GitHub release from this file and refuses if the version or
the entry is missing. While the app is pre-1.0 every release bumps the patch number (0.0.1, 0.0.2, …).

## 0.0.38 — 2026-09-26

### Practice: your next session
- New **Practice** page. From your last 6 rounds it picks the three parts of your game costing you the
  most strokes a round, and the distance inside each that costs the most, for example "Approach,
  140–170 yards" or "Putting, 4–8 ft". You need 3 rounds for a plan; you can switch to your last 3 or
  10 rounds.
- Each one comes with a **drill**: what to set up, what to do, why it matters and the **pass mark**.
  Five to start: an approach ladder, a wedge distance matrix, circle putting from 4 to 8 ft, lag putting
  from 30 to 50 ft and bunker to 10 ft. Every drill changes the shot on every ball and gives you a
  score, so practice looks like the course.
- **Log a session**: date, drill and score. It tells you pass or not as you type. The page then shows
  your pass rate per drill, your recent sessions as a strip, and whether you're passing more often.
- **Trends** shows your next session and your practice over the last 30 days.
- Pass marks are starting points, not yet tuned to your handicap, and a few parts of the game (off the
  tee, chipping, recovery) don't have a drill yet (#61).

## 0.0.37 — 2026-09-26

### Under the hood: how Claude works on this app, and what it's now allowed to trust
Nothing changes on screen. This release makes the numbers behind the screen better guarded and
the way the app is built more reliable.
- **New tests on shot editing.** Marking an edited shot Holed removes the shots after it; editing an
  earlier shot re-derives the later starts and stores the right strokes gained for every shot; a
  stroke-and-distance penalty always costs exactly two strokes whatever was typed. These were the
  behaviours the app relied on but never checked.
- **A quality gate on the course directory.** A test now checks the committed course list itself:
  every course has one of the 32 counties and sits on the island, the share with a known hole count
  can't fall, and the known gaps (missing clubs, duplicate entries) are listed and must shrink. It
  found a fourth non-course on its first run.
- **A quality register** (`docs/quality.md`): every feature's data confidence, its known issues,
  the test that pins it and the GitHub issue, so a problem a player could notice is never only in a
  chat. Filed from it: a scoring bug where a shot entered as 0 ft and not holed is scored as holed
  (#40), the directory's missing clubs and hole counts (#38), and the thin scratch benchmark (#39).
- **Skills for Claude Code sessions** (`.claude/skills/`): `/how` explains an area with parallel
  read-only explorers and can critique it with independent reviewers; `/verify` runs the same
  checks as CI in one command and has a separate verifier check a subagent's claims; `/brigade`
  runs many subagents at once with one writer per file and a verifier on every change;
  `/correct` turns a correction into a permanent fix at the lowest level that can hold it. A
  `CLAUDE.md` points every session at them.
- **Where code lives** is now a test too: logic in `src/lib` with a test beside it, pages and
  routes thin, data under `src/lib/*/data`, and counts of the exceptions that may only go down.

## 0.0.36 — 2026-09-25

### Fix: the course map's background
- The Played page's map showed "API KEY REQUIRED" tiles: CARTO's basemaps now need a key. It now
  uses OpenStreetMap's standard map, which needs none. A different provider can be set with
  `NEXT_PUBLIC_MAP_TILE_URL` (see `.env.example`) without a code change.

### Course list corrections
- **Derry**, not Londonderry.
- A club named after a county is placed in that county even when the course sits just over the
  boundary: Waterford Golf Club is in Waterford (not Kilkenny), Carlow Golf Club in Carlow.
- Courses mapped with only their own name get their venue in front, e.g. "Carton House – The
  O'Meara" rather than "The O'Meara".
- Footgolf, practice academies and courses with fewer than 9 holes are no longer listed.

## 0.0.35 — 2026-09-25

### Courses played, on a map
- New **Played** page: every golf course in Ireland, North and South, on a map. Tick off the ones
  you've played and build up your list, grouped by county, with counts: courses played, counties
  out of 32, and 18- and 9-hole courses.
- Search by name or county, or tap a flag on the map. Green = played. Zoomed out, nearby courses
  group into numbered bubbles, with a green badge counting the ones you've played.
- Courses where you've **logged a round** count automatically (the admin links each scorecard
  course to its map entry on the Courses page).
- Your list is private to you, like your rounds.
- The course list comes from OpenStreetMap (© OpenStreetMap contributors, ODbL), refreshed by a new
  GitHub Actions workflow. Pitch & putt, par-3 courses, driving ranges and duplicates are filtered
  out, and anything it gets wrong can be corrected in `overrides.json`.
- **Top 100 challenge:** courses in the Golf Digest Ireland Top 100 (2023) get a gold rank badge and
  a gold ring on the map, with a "Top 100" count and a filter that lists the ranking in order. (Shows
  once the ranking is loaded with `pnpm directory:top100`.)

## 0.0.34 — 2026-09-25

### Sign-up flow: a welcome tour, and the app on your home screen
For a new player, the path is now: WhatsApp link → an invitation (not a login wall) → sign in →
a two-minute welcome tour → their first round, with help at each step.
- **The invite page says what you're joining:** three lines on what the app does, then Google or
  an emailed link. No password, and it says a short tour follows.
- **Welcome tour (`/welcome`)**, five swipeable screens after signing in, all skippable:
  1. *Why:* "Your scorecard says 84. It doesn't say why." Counts vs strokes gained, with an
     example split by area.
  2. *How it's scored:* the one sum, and the Learn hub's bogey scored by the real engine
     (drive +0.06, approach −0.55, … = −0.91).
  3. *Logging a round:* where it finished, how far to the hole (not how far you hit it), Holed;
     Brief first; nothing is final.
  4. *What you get back:* a recap after one round, Insights after a few, Trends and What to work on
     after four; honest about small samples.
  5. *Set up your phone:* "Add to Home Screen" instructions for the phone in hand (iPhone Safari,
     another iOS browser, Android, or a laptop), and a nudge to check the course library. Ends on
     **Log your first round**.
  It only appears unasked to a player with no rounds; Skip or finishing remembers that in the
  browser, and Learn has a **Welcome tour** link to reopen it any time.
- **Rounds, before the first round:** a three-step "Getting started" card (course, first round,
  recap) instead of an empty list.
- **The first shot:** on a player's first round, a dismissible card on the round page walks the
  three inputs until the first hole is finished.
- **Learn** gains a **Logging a round** topic (the same three steps, plus penalties, moving between
  holes, editing and notes).
- **Home-screen app:** a web app manifest, 192/512px icons (`scripts/make-pwa-icons.sh`), iOS
  full-screen mode with a safe-area-aware nav, and a theme colour, so "Add to Home Screen" gives
  an icon that opens straight to Rounds. Sign in *before* adding it: the emailed link opens in
  Safari, not the home-screen app.

## 0.0.33 — 2026-09-25

### Seasonal backdrops on the Rounds page
- **Four scenes** of the course: **windy spring** (azaleas, petals on the wind), **sunny summer**
  (sun out, hydrangeas, flag hanging still), **windy autumn** (turning trees, leaves blowing across)
  and **rainy winter** (grey sky, rain on the creek, puddles on the green, holly). Same course in each,
  so the green and flag never move.
- **A banner at the top of Rounds** shows the current scene, with a **Backdrop** picker underneath.
- **Auto** (the default) follows the season: spring Mar–May, summer Jun–Aug, autumn Sep–Nov,
  winter Dec–Feb. Pick a scene to keep it all year.
- **One choice, everywhere:** the footer and the sign-in page switch to the same scene. It's saved
  on this device (a cookie), not your account.

### Voice: golf words put back, and how to say a hole
- **Transcripts snap back onto golf words.** Recognisers hear the commoner English word, so
  "eight iron" comes back as "eight hour", "two putts" as "two pots", "holed it" as "hold it"
  and "40 yards" as "40 hours". Each is fixed only when the words around it make the golf reading
  near-certain, the page shows every change ("hour → iron") next to what was actually heard, and
  **numbers are never touched**.
- **How to say it:** a guide on the Voice page. Say where each shot was played *from* ("second
  shot, 157 yards from the fairway, left"), number every shot so a dropped one can be caught,
  always say the unit, say the lie, and call penalties out loud.

## 0.0.32 — 2026-09-25

### Learn: what the numbers mean
- **A new Learn page** (in the nav) that explains every score in the app, in plain words.
- **Strokes gained, one shot at a time:** a scroll-through tour of one bogey on a 400-yard par 4.
  As you scroll, each shot is drawn on the hole in green if it gained on a scratch golfer and red
  if it lost, with the sum behind it (e.g. "3.03 − 2.58 − 1 = −0.55") and a running total. It ends
  on −0.91, which is exactly 4.09 expected minus 5 taken. It shows that the drive and bunker shot
  were fine, and the approach and missed six-footer cost the bogey. The numbers come from the app's
  own strokes-gained engine.
- **The hexagon, explained:** tap any hexagon to see what that number means for that round, e.g. "81
  means your average shot lost 0.19 strokes to a scratch golfer's. Over these 85 shots that adds up
  to 16.4 strokes lost." Learn also has a table of what each score works out to over a round, and
  your latest round's score explained.
- **How to read a round card**, What to work on, Where you miss, and a note on small samples.
- **A first-visit tip on Rounds** with three pointers and a link to the tour. "Got it" hides it for
  good in that browser, leaving a small "How to read these numbers" link.

## 0.0.31 — 2026-09-25

### Where you miss, and your putting profile (Insights)
Two new sections built from the tags you log in **Detailed** entry. Neither changes strokes gained.
- **Where you miss:** one sentence on your main tendency, e.g. "Approach shots that miss the green
  mostly finish short (39% of 104 tagged misses); putts you miss tend to finish short." Under it:
  - a **cross** for approach shots (over 30 yards) and another for short game and greenside bunkers:
    long above, short below, left and right either side, and how often you found the green in the
    middle. Your most common miss is highlighted;
  - **approach misses by distance band**, so you can see whether a 150-yard miss is different from a
    100-yard one;
  - **off the tee:** one bar of missed left, fairway and missed right.
- **Putting profile:** for each putt length, how many you hole, whether your misses finish **short or
  long** (and which you lean to), and **high side or low side** on breaking putts. Then the same by
  break: left-to-right, right-to-left and straight.
- **Small samples say so.** Anything with fewer than 8 tagged misses is faded and tells you how many it
  has. A course with no tags yet explains how to start.

## 0.0.30 — 2026-09-25

### Log where you missed, and how each putt broke
- **Brief or Detailed:** starting a round now asks how much you want to log. **Brief** is lie and
  distance, with the extra tags one tap away. **Detailed** opens them on every shot. It remembers
  your last choice. (This replaces the "Track mentality" checkbox; old rounds keep their setting.)
- **Where it missed**, tapped under the distance box once you've picked the result:
  - **off the tee** on a par 4 or 5: left or right of the fairway;
  - **any other shot that missed the green**: left, right, long or short of the hole;
  - **a missed putt**: short, long, left or right.
  Only the options that fit the shot appear, and nothing shows when you found the fairway or green.
- **Putts:** **slope** (uphill, downhill, flat) and **break** (left-to-right, right-to-left,
  straight), above the lie buttons. Once you've picked the break, the miss row says which side is
  the high side.
- Tap a selected tag again to clear it. Tags show on the shot list (e.g. "uphill · l→r · missed
  left"), survive edits, and are cleared if an edit means they no longer fit (a putt that's now a
  chip loses its slope and break).
- **None of this changes strokes gained.** The charts that use it come next.

## 0.0.29 — 2026-09-25

### Shot quality over time (Trends)
- A new **Shot quality over time** section on Trends: a chart for all your shots, then one for
  each area (off the tee, approach, short game, bunker, putting, recovery).
- **The line is your last 5 rounds pooled together**, so a round with one bunker shot doesn't swing
  it like a round with six. Dots are single rounds, and a dashed line marks 100 (scratch).
- **A hollow point has fewer than 10 shots behind it.** An area without 10 shots in its last 5
  rounds shows a sentence instead of a chart, saying how many it has.
- Covers **the last year**, or all your rounds until you have two in the last year.

## 0.0.28 — 2026-09-25

### Shot quality: one number for how well you hit it
**100 = a scratch golfer's average shot.** Shot quality is your strokes gained per shot, scaled
so each point is a hundredth of a stroke: `100 + 100 × SG per shot`. A 68 that gained 4 strokes
over 68 shots scores 106. A round that gives up 20 strokes over 90 shots scores 78.
- **On every round card**, a hexagon badge next to the score. Hover it for the strokes gained
  per shot behind it.
- **In the round recap:** the badge on the first slide, and a new **Shot quality** slide with
  each area (off the tee, approach, short game, bunker, putting, recovery) as a bar either side
  of 100.
- **On Insights:** a Shot quality section for the course you've picked, across every round.
- It's per shot, so it describes how well you hit each kind of shot, not how often you hit it.
  A penalty stays with the shot that caused it.
- **Areas with fewer than 10 shots are faded**: three bunker shots can read 36 or 148, and
  neither means much yet.

## 0.0.27 — 2026-09-25

### What to work on (Trends)
"Practice priority" is now **What to work on**: every area of your game ranked by how much it
matters *and* how much it costs you, with the trend alongside.
- **Importance to scoring:** a bar showing how much each part of the game (driving, approach over
  100 yards, short game, putting) separates golfers' scores, from Mark Broadie's *Every Shot
  Counts*, with your own strokes a round against scratch in each.
- **Three numbers per area** (a distance band, a bunker type, off the tee, recovery):
  - **Importance**: that part of the game's share, split by how often you hit the shot.
  - **Opportunity**: strokes a round you lose there against scratch over your last 8 rounds,
    rated low, medium or high.
  - **Trend**: your recent rounds against the ones before, with a small bar per round, and the
    same "signal / limited data / too few shots" label as the category trend.
- **The top five areas as cards**, ranked by importance × opportunity, each with one plain
  sentence, e.g. "You lose 2.0 strokes a round here; it's a high-importance area and it may be
  getting worse." An area with under 10 shots says to treat it as a hint.
- **Holding up:** the areas where you gain on scratch. **All areas:** the full list, folded away.
- The importance shares are **rounded placeholders** until they're checked against the book, and
  the page says so.

## 0.0.26 — 2026-09-23

### Sign in without Google: a link by email
- The sign-in page now offers **"email me a link"** as well as Google. No password, no account to
  create: the link signs you in and lasts 15 minutes, once.
- **Invites still hold.** A link is only emailed to an existing player, the admin, or an address
  that arrived with a valid `/join/<token>` invite. Anything else is silently ignored, and the page
  answers the same way either way, so it never reveals who has an account.
- **The link works in any browser.** Mail apps open links in their own browser, where the invite
  cookie doesn't exist, so an invited address is recorded server-side (new `invited_emails` table)
  when the link is requested.
- A used or expired link comes back to the sign-in page with an explanation instead of failing.
- The email option only appears when sending is actually configured (`RESEND_API_KEY`), so it can
  never be a dead end.

**Setup still needed before friends can use it:** a `RESEND_API_KEY` in Vercel, and — to email
anyone other than the Resend account owner — a `NOTIFY_FROM` address on a verified domain.

## 0.0.25 — 2026-09-22

### When you played (Trends)
- A **calendar of the last 90 days** at the top of Trends: one square a day, **coloured by course**,
  with a legend and round counts. Tap a day to open that round; hover for the course and score.
  A day with two rounds gets a corner mark.
- Alongside it: rounds played, **days played out of 90**, how long since your last round, and your
  **longest gap** without golf.

## 0.0.24 — 2026-09-22

### New Scoring page
Insights was getting crowded, so everything about the number on the card now has its own page,
**Scoring** (in the nav). Insights is strokes gained only.
- **Score history:** every round you've logged on every course, with your best, average and
  last-5 average. A bar chart shows each full round's score to par, with your 5-round average
  dashed on top. Tap a round for its scorecard.
- **How your holes finish vs scratch** (moved from Insights) now says **what each gap costs you per
  round**: e.g. "More doubles or worse +2.3+ strokes, fewer birdies +0.5". It adds up to roughly how
  far behind scratch you finish on hole outcomes alone.
- **Par 3s, 4s and 5s:** average score, score to par per hole and per round, **strokes gained per
  hole and per round**, and your birdie/par/bogey/double+ split for each. A headline names the par
  type that costs you most.
- **Eclectic scores** moved here from Insights.

### Also
- The nav fits on one row on desktop again, and wraps (instead of overflowing) on a phone.
- **Vercel preview deployments are off.** They failed on every pull request because previews
  (deliberately) have no database. CI already typechecks, tests and builds every PR, so only `main`
  deploys now.

## 0.0.23 — 2026-09-22

### How your holes finish: compared with scratch golfers
- Each bar (eagle+, birdie, par, bogey, double+) now shows the **scratch average** as a black tick
  and the **range between scratch golfers** as a grey band, next to your own share.
- Both ratios show the scratch figure underneath: **par or better : bogey** (scratch 2.1 : 1) and
  **par or better : double+** (scratch 11.2 : 1).
- A headline names your costliest gap vs scratch, e.g. *"You make a double bogey or worse on 12% of
  holes; scratch players on 6%."* It only ever points at gaps that cost you.
- The benchmark starts with 2 scratch-or-better golfers: 33 competition rounds, 594 holes. More will
  be added. The data is anonymised (letters only, no names, clubs or dates), and a test enforces that.
  Pick-ups count as triple bogeys.

## 0.0.22 — 2026-09-22

### Faster Insights ([#16](https://github.com/comaraDOTcom/strokes-gained/issues/16))
- **The app's server now runs in London**, next to the database, instead of Washington DC — every
  database round trip was crossing the Atlantic (`vercel.json` → `"regions": ["lhr1"]`, free on Hobby).
- **Drill-downs open instantly**: tapping a number in *Round by round* (and Close) no longer reloads
  the page — every round × area drill-down is worked out with the page, and the URL's `?area=`
  still follows along, so links keep working.
- **Fewer database round trips per page**: the session is looked up once per request (it was twice),
  your shots load in one joined query (it was five, four of them each opening a new connection),
  the course list in one (was two), and Insights runs its independent queries side by side.
  Idle database connections are kept for a minute so back-to-back pages reuse them.
- Insights logs one timing line per request (`[timing] /insights total=… session=… shots=…`) so the
  effect can be measured in production.

### Score colours, tour-leaderboard style
- Scorecards, the eclectic table and "How your holes finish" use the tour structure: **gold eagle,
  green birdie, blank par, light-blue bogey, navy double, dark-navy triple or worse**. Par has no fill,
  so every birdie and bogey stands out; each step has its own colour. Birdie stays green (not the
  tours' red) because red means *strokes lost* everywhere else in the app.

## 0.0.21 — 2026-09-22

### Insights charts: bars with numbers on them
- **SG per round over time** and **Putts per round** are now bar charts, not lines: one bar per round,
  with its value printed on it. SG bars are green when gained and red when lost; the 3-round average
  is a dashed line on top.
- **Every bar chart on Insights** now shows its number on each bar (above a gain, below a loss), so
  the scale reads without hovering. SG totals show 1 decimal; per-shot and per-putt values show 2.
- Axes sit on round numbers (steps of 1, 2 or 5), always include zero, leave room for the labels,
  and never repeat a tick label on small ranges. Round dates read "13 Sep".
- Charts draw instantly (no animation).

## 0.0.20 — 2026-09-22

### Tap a number to see the shots behind it (Insights → Strokes gained)
- Every number in **Round by round** is now tappable. Pick a round and an area (say, off the tee on
  2026-09-13) and a panel opens with that area's **five costliest shots** that round, biggest loss
  first — hole, par, what happened ("358y off the tee to 158y on the fairway") and the strokes lost —
  plus how many shots in that area lost or gained. Tap the number again, or Close, to put it away.
- On a phone the panel opens inside that round's card. The link is shareable (`?area=`).

## 0.0.19 — 2026-09-22

### Round recap: every area on the takeaway
- The last slide of the recap ("Strong area, weak area") now also has a bar chart of **every skill
  area** for the round, best to worst, so you see the whole picture and not just the two ends.
  One decimal on screen; hover for the exact value and shot count.

## 0.0.18 — 2026-09-22

### Strokes gained, easier to read (Insights)
- **The overall picture comes first**: your average round (or your one full round) as a big,
  spaced-out chart — one row per discipline, the total up top, and a line naming your **biggest
  leak** and your best area.
- **Round by round** sits underneath and is calmer: each cell shows the number first with a slim bar
  under it, so neighbouring numbers no longer run into each other, and there's more room between
  columns. On a phone every round is still its own card.
- Numbers show **one decimal**; hover for the exact two-decimal value. A value that rounds to 0.0 is
  shown in grey, not green or red.

## 0.0.17 — 2026-09-22

### How your holes finish (Insights, per course)
- A bar chart of **every finished hole** at the chosen course by score to par: eagle or better,
  birdie, par, bogey, double, triple or worse — as a % of holes played, with the count.
- Two headline ratios above it: **par or better : bogey** and **par or better : double+** — how
  many pars (or better) you make for every dropped shot, and for every big number. Higher is better.

## 0.0.16 — 2026-09-22

### Dev: automated checks
- **CI on every push to `main` and every pull request**: typecheck, tests, production build.
  `main` deploys straight to production, so this is now the gate.
- **Migration check**: fails if `src/db/schema.ts` changed without its migration, and applies every
  migration to a fresh Postgres — catching the one mistake that would break the live database.
- **Secret scan** (TruffleHog) on every push, so a key can't slip into this public repo unnoticed.
- **Releases are automatic**: pushing a `vX.Y.Z` tag publishes the release from this changelog, and
  refuses if `package.json` or the changelog entry doesn't match. (This release is its first run.)
- **Dependabot**: weekly dependency and GitHub Actions updates, minor/patch grouped into one PR.

## 0.0.15 — 2026-09-21

### Eclectic scores (Insights, per course)
- Every round you've played at the chosen course, **hole by hole**, colour-coded against par, with
  **Low score** and **High score** rows — the best and worst you've made on each hole — and your
  **eclectic total** (the round you'd shoot if you matched your best on every hole) once every hole
  has been finished at least once. Part-played rounds show "–" for holes not played.
- On a phone the 18 columns scroll inside the table's own box (the round name stays pinned); the
  page itself never scrolls sideways. Tap a round to open its scorecard.

### Scorecard view
- **A proper card for every round** (`View scorecard` on the round card and round page, or from the
  eclectic table): date, course, tee, course/slope rating, player; front nine / back nine with hole,
  par, stroke index, colour-coded score, and **strokes gained per hole**; gross and SG totals.
- New optional **Playing handicap** in the round's notes. With it — and a full set of stroke indexes
  on the tee — the card adds **net score and Stableford points** per hole and in total (WHS stroke
  allocation, plus handicaps supported). Without a full set of indexes it says so rather than guess.
- Score colours follow the rest of the app (green good, terracotta bad) instead of the printed-card
  convention of red for birdies, so a colour never means two things. A legend is shown.

## 0.0.14 — 2026-09-21

### The story, up front
- **Rounds list:** every round card now shows its story at a glance — **strongest area, area to work
  on, best hole and worst hole** — with a full-width **Watch the round recap** button, so the recap
  is one tap from the list instead of hidden inside the round (it replaces the small reel icon).
- **Insights: "Your story so far"** at the top of the page, across all your rounds at the chosen
  course: strongest area and the one to work on, the **three holes you play best and the three that
  cost you most** (average strokes gained and score to par per play), and your **best and worst
  shots ever** there — tee to green and on the green, each with its date.
- Multi-round numbers are **per 18 holes played**, not per round, so a part-played round doesn't
  skew them.

## 0.0.13 — 2026-09-21

### Round recap
- **Best and worst shots are now ranked in two groups — "Tee to green" and "On the green" — three
  of each.** A holed putt swings strokes gained in a single stroke (from "about 1.8 more to get
  down" to "done"), so one combined list was nothing but putts. Now your best full shots, chips and
  bunker shots get their own list, and the putting list shows holed putts on the best side and poor
  lag putts on the worst.

## 0.0.12 — 2026-09-21

### Round recap
- The recap is now a **film-reel icon button** on every round in your list (a 44px tap target, in
  place of the small "Recap" text link), and the same icon leads the recap banner on the round page.

## 0.0.11 — 2026-09-21

### Round recap
- A quick, story-style **click-through of any round**: tap (right = next, left = back), swipe, use
  the arrow keys or the buttons; progress segments along the top jump to any slide; **Skip** exits.
- Six slides: the **headline** (score, to par, strokes gained vs scratch), your **best 3 holes**, your
  **worst 3 holes** (and what share of your lost strokes they account for), your **best 5 shots**,
  your **worst 5 shots**, and the takeaway — **strongest area / area to work on**, with SG per shot.
- Shots are described in plain English — "347y off the tee to 180y in trouble", "30ft putt, holed".
- Best and worst never overlap, shrink sensibly for short or part-played rounds, and ties go in
  round order. Only finished holes count as holes; every logged shot counts as a shot.
- Open it from the round page ("Round complete — see your recap" once all 18 are in, "Round recap so
  far" before that) or the **Recap** link on each round in your list. Private like the round itself.

## 0.0.10 — 2026-09-21

### Insights: strokes gained, round by round
- The "latest vs prior 3" grouped bar chart at the top of Insights is replaced by a **round-by-round
  table** (in the style Data Golf uses for player pages): one row per round, one column per SG
  category, each cell a small bar growing right in green for strokes gained or left in red for
  strokes lost, with a highlighted Total column.
- **Every category bar shares one scale**, so the longest red bar on the page is your biggest leak,
  and a pattern that repeats round after round is visible at a glance. Total has its own scale.
- An **Average** row appears once you have two full rounds (partial rounds are flagged with their
  hole count and left out of the average). A category with no shots shows "—", not a 0.00 bar.
- A real grid on large screens; on phones and tablets each round is a card with the categories
  stacked, so nothing scrolls sideways. The Insights page is wider on desktop to fit it.

## 0.0.9 — 2026-09-21

### Fixed
- The course filter on **Rounds** and **Insights** now lists only courses **you** have logged a round
  on. It used to show the whole shared library, so every course anyone added (Stackstown, …) appeared
  as an empty "0 rounds" button. A new player with no rounds sees no filter, just the empty state.
  To start a round somewhere new, use **Log a round** or the Courses page.

## 0.0.8 — 2026-09-21

### Courses page
- **Pick a course, then see your options.** A searchable course list; choosing one shows its tees
  (yardage, par, course/slope rating), **Log a round here** (opens the new-round form with the course
  already chosen), a link to your rounds there, and View/Edit holes per tee.
- **Request a course.** "Can't find your course?" — any player can ask for one (name plus anything
  helpful). Their pending requests show on the page; up to 5 can be waiting at once.
- **Admin inbox.** Open requests appear at the top of the admin's Courses page (who asked, when, their
  notes) with **Mark done**. If `RESEND_API_KEY` is set, each request also emails the admin; without
  it nothing is lost — the inbox is the source of truth.

### Admin-only, clearly marked
- Pages and sections only the admin can see now carry an **Admin only** badge (the Players pages, the
  request inbox), and the Players nav link is tagged "admin".

### Dev
- Local PGlite closes cleanly on Ctrl-C / SIGTERM (a hard kill could corrupt `data/pglite`).
- In `AUTH_TEST_MODE` (never in production) the configured `ADMIN_EMAIL` counts as admin without a
  verified email, so admin screens can be exercised locally.

## 0.0.7 — 2026-09-21

### Privacy: rounds are now private
- Players can no longer see each other. The **Players** list and other people's rounds are
  **admin-only**; for everyone else they return "not found" (so round ids can't even be probed), and
  the Players link is gone from their nav.
- The admin can still open anyone's round **read-only** (scores and strokes gained — never notes or
  ratings) to help with feedback, and still can't edit it.
- The sign-in page's privacy note now says exactly that.

## 0.0.6 — 2026-09-21

### Course library
- **Stackstown Golf Club** added: the **Cottage** (par 71) and **Gate** (par 72) courses, each with
  men's White and Green tees and ladies' Red, with course and slope ratings. (No stroke indexes — the
  source doesn't have them; they don't affect strokes gained and can be added in the course editor.)
- New admin tool to add courses from GolfCourseAPI: `pnpm courses:api search "<name>"`, then
  `pnpm courses:api add <id>… [--mens] [--commit]` (a dry run unless `--commit`). API data goes
  through the same checksum validation as spreadsheet imports, and the mapper refuses — rather than
  guesses — when tees disagree on a hole's par, a tee isn't 18 holes, or a yardage is missing.
- Coverage note: GolfCourseAPI has Stackstown, Donabate GC and Corballis Links, but **not The Island
  (Donabate)** — that one needs the spreadsheet import or a scorecard.

## 0.0.5 — 2026-09-21

### Swipe between holes
- On the round screen, **swipe the hole card left for the next hole, right for the previous one**.
  New ‹ › buttons beside the hole title do the same (and work on desktop). The hole strip scrolls to
  keep the current hole in view.
- Built not to fire by accident: the swipe must be at least 60px and clearly horizontal (scrolling
  the page never counts), pinch-zoom is ignored, and swipes that start at the very edge of the
  screen are left to Safari's own back/forward gesture.

## 0.0.4 — 2026-09-21

From the first friends' feedback.

### Fixed
- **Pages opened too wide on a phone** (the left edge was cut off and the screen scrolled sideways,
  worst on the round screen). A 0.0.3 regression: the new footer layout let a page shrink-wrap to its
  widest child — the 18-hole strip — instead of the screen. Every page now fits a 375px phone.
- **The "+ Log" button slid out of reach** on a phone because the whole nav scrolled sideways. The
  logo, **+ Log a round** and Sign out now stay pinned on the first row, with the links on a row below.

### Clearer distance entry
- The distance box is now labelled **"Distance LEFT to the hole"** with a faded hint using the hole's
  own yardage ("A 290y drive on this 413y hole leaves 123"), because it was natural to type how far
  you hit it — which scores a good drive as a bad one.
- As you type, it reads back what your number means — "→ This shot travelled about 290y" — and warns
  in red if the ball would finish further from the hole than it started.

### Mentality is now opt-in per round
- **Track mentality this round** on the new-round form. Off (the default for a new player): the
  per-shot focus/commitment buttons and the balance/tempo/tension ratings are collapsed behind a
  one-tap link. On: they're open, as before. The form remembers your last choice; existing rounds
  keep theirs open.

## 0.0.3 — 2026-09-21

### New look
- **App icon:** the flag now stands beside strokes-gained bars — red below the line for strokes
  lost, green above for strokes gained — in the browser tab, on the iPhone home screen, in the nav
  and on the sign-in page. The flag is gold so it doesn't read as a "strokes lost" bar.
- **Backdrop:** an illustrated golf scene — tall pines, a creek, a green with the flag, and banks of
  azaleas — sits behind the sign-in page and as a footer on every page once you're signed in. It
  blends up into the page colour, stays clear of the data, and keeps the flag in frame on a phone.
  Original artwork, generated by `scripts/make-golf-scene.mjs` (edit and re-run to tweak it).

## 0.0.2 — 2026-09-21

Multiplayer. The app now runs on the web (Vercel + Neon Postgres) with Google sign-in, so a
small group can each log their own rounds and see each other's.

### Accounts and sharing
- Google sign-in. Sign-up is **invite-only**: a secret link (`/join/<token>`) lets a new person
  create an account; without it a new account is refused. The admin (`ADMIN_EMAIL`) can always
  sign up and inherits the rounds imported from the single-user version.
- Every round belongs to its owner: only they can add, edit or delete its shots, or change its
  notes. Other players can open it **read-only** (scores, shots, strokes gained) from a new
  **Players** page. Commentary and mentality ratings are never shown to anyone else.
- One shared course library. Anyone can add a course; only its creator or the admin can edit it,
  and once another player has a round on a tee only the admin can.
- Home, Insights and Trends show only your own rounds.

### App icon
- New app icon (a flag on the green) for the browser tab and the iPhone home screen, used for the
  logo in the nav and on the sign-in page.

### Fixed
- Editing a course's yardages used to make SG un-recomputable for every existing round on that
  tee. Edits now re-base the affected rounds and recompute them in one transaction.
- Starting a round now checks that the tee belongs to the chosen course, and importing a course
  whose name already exists is refused.

### Changed
- Database moved from a local SQLite file to Postgres (Neon in production, PGlite locally and in
  tests). All float columns are double precision so fractional-yard green distances stay exact.
- Migrations are run with `pnpm db:migrate`, not on startup. `pnpm db:import-sqlite` copies an old
  `data/rounds.db` across and refuses to finish unless every round's score and SG match exactly.
- Local development needs `pnpm db:migrate` first, and `AUTH_TEST_MODE=1` to sign in without Google.
  The single-user SQLite version stays available at tag `v0.0.1`.

### Known limitations
- Sessions are cached in a signed cookie for 5 minutes, so removing a user takes up to 5 minutes
  to take effect.
- No way to delete a round yet, and no in-app feedback box.
- Portmarnock still has no course rating on file.

## 0.0.1 — 2026-09-21

First release. A personal, single-user strokes-gained app that runs locally
(Next.js + SQLite, reachable from a phone on the same wifi).

### Strokes gained engine
- Broadie-method strokes gained against a scratch baseline, calibrated to Elm Park's course rating.
- Shots categorised into off the tee, approach, short game, bunker, putting and recovery, with
  penalties and recovery shots handled explicitly.
- Derived traditional stats (GIR, putts, fairways, sand saves, up-and-downs) — never entered by hand.

### Courses
- Elm Park and Portmarnock seeded with checksum-validated scorecards.
- `.xlsx` course import and an in-app hole editor.

### Logging a round
- Mobile-first, hole-by-hole entry: tap the result lie and distance (feet on the green), or Holed.
- The next shot's result defaults to GREEN after a shot that finishes on the green.
- Resume a part-entered round; edit any past shot in place (later shots keep their results).
- Live hole score and strokes gained. Optional round name, date, and free-text commentary.

### Mentality
- Per round: balance, tempo and tension ratings (1–5).
- Per shot, optional: internal vs external focus, and committed vs hesitant.

### Insights
- `/insights`: SG by category, rolling trends, putting/short-game/bunker/approach breakdowns,
  penalties and recovery, with a course filter.
- `/trends`: latest round vs prior three, practice priority, and a cross-course difficulty
  caveat (the adjustment stays off until a course rating is on file).

### Known limitations
- Single user, no sign-in; the database is a local file (`data/rounds.db`) you back up yourself.
- Portmarnock has no course rating on file.
- Not deployed anywhere.
