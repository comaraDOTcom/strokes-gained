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
| 4 | Dashboard (`/insights`), incl. derived GIR/putts/fairways/sand-saves/up-and-downs, course filter | ✅ Built, verified in the browser. Not built: the 18-hole SG heatmap strip from the design mock |
| 5 | Trends + "What to work on" roadmap, cross-course difficulty caveat | ✅ Built (`/trends`, `src/lib/insights/trends.ts` + `roadmap.ts`, tested). Needs ≥4 rounds before it shows a trend; difficulty adjustment stays off until Portmarnock has a course rating |
| — | Round notes, mentality (BTT + per-shot focus/commitment), in-place editing | ✅ Built (see below) |
| 6 | Postgres + accounts + invite-only multiplayer (Google sign-in, shared course library, read-only friends' rounds) | ✅ Live on Vercel + Neon (v0.0.2); see "Deploying" below |
| 7 | Course directory (every course in Ireland, from OpenStreetMap), courses-played profile + map (`/profile`) | ✅ Built. Directory data needs its first fetch — run the **Course directory** workflow |

**Design direction**: two mockups (landing + dashboard) are published at
<https://claude.ai/artifact/5xuDRDUxDhpTwrbsYixSLB> — analytical/data-tool
aesthetic (IBM Plex Sans + Plex Mono, steel-blue accent, rounded cards, an
18-hole SG heatmap strip, a Portmarnock/Elm Park course filter). Static HTML,
not real app code, but should inform Phase 4's actual implementation. The course
filter is speced in `BUILD.md` (Phase 4) and implemented on `/` and `/insights`
via `?course=<id>` (`src/lib/insights/course-filter.ts`, `src/app/course-filter.tsx`).

### Round notes, mentality and shot tags

**Per round** (edit any time on the round page under "Round notes", `PATCH /api/rounds/[roundId]`):
a **name** (e.g. "Medal Final 2026"), free-text **commentary** (paste a transcribed
voice note, or use the keyboard's dictation), the **date played**, and three overall
1–5 ratings after Pia Nilsson's **balance / tempo / tension** (all "higher is better",
so for tension 5 = relaxed).

**Per shot, both optional** (two tap-again-to-clear toggles above the lie buttons; they
reset after every shot): **focus** — internal (swing thoughts) vs external (target) —
and **commitment** — committed vs hesitant (the "make a clear decision and commit"
idea from Scott Fawcett's approach). Tap them *before* Save / Holed.

**Per shot, shot-shape tags, all optional:** where a shot **missed** (`shots.miss_direction`:
left/right of the fairway off a par-4/5 tee; left/right/long/short of the hole for any other shot
that missed the green; short/long/left/right for a missed putt), and for putts the **slope**
(`putt_slope`: uphill/downhill/flat) and **break** (`putt_break`: L→R / R→L / straight). Slope and
break sit above the lie buttons (known before the putt); the miss row appears under the distance box
once the result is picked, and only offers what fits that shot (`tagGroupsFor` in `entry.ts`). A
missed putt's high/low side isn't stored: it's derived from break + left/right (`sideOfMiss`). The
server re-checks which tags apply (`normaliseShotTags`), so editing a shot's lie clears tags that no
longer fit. Saving lives in `src/lib/rounds/save-shot.ts` (tested against a real DB).
They're read back on `/insights` as **Where you miss** (approach and short-game crosses, misses by
band, the tee split) and **Putting profile** (make %, short/long, high/low side, by length and break),
from `src/lib/insights/dispersion.ts` (pure, tested). Fewer than 8 tagged misses = faded.

Whether these inputs are open or collapsed-but-expandable is the round's **Brief / Detailed** choice
on the new-round form (`rounds.detailedEntry`; the DB column is still `track_mentality`, same
meaning, not renamed; the form defaults to the player's last choice, Brief for a first round). None of this feeds strokes gained. Stored on `rounds` (`name`, `notes`,
`mental_balance/tempo/tension`) and `shots` (`focus`, `commitment`); validated in
`src/lib/rounds/details.ts` and `src/lib/rounds/entry.ts`. The first-draft ratings
(`mental_confidence/focus/composure`) are no longer shown but their columns are kept so
saved values aren't destroyed. **Not built yet:** reading focus/commitment/BTT back
against SG on `/insights` — worth doing once several rounds carry tags.

### Scorecards and eclectics

`src/lib/insights/scorecard.ts` (pure, tested): `buildRoundCard` (gross per finished hole, SG per
hole, and — given `rounds.playing_handicap` plus a stroke index on every hole — net and Stableford
via `strokesReceived`/`stablefordPoints`) and `buildEclectic` (rounds × holes, low/high per hole,
eclectic total once every hole is covered). Views: `/rounds/[id]/scorecard` and the "Eclectic
scores" section of `/insights` (per course, since hole numbers only mean something within one).
`scoreDistribution` buckets every finished hole (eagle+ … triple+) and gives the par-or-better :
bogey and par-or-better : double+ ratios, shown as "How your holes finish" on `/insights`.
Sign-in is **Google or a magic link** (Better Auth's `magicLink` plugin, `src/lib/auth/auth.ts`).
A link is only sent to a member, the admin, or an invited address; invited addresses are recorded
in `invited_emails` so the emailed link works in a mail app's own browser, where the `/join`
cookie doesn't exist. Email goes through `sendEmail` in `src/lib/notify.ts` (Resend): set
`RESEND_API_KEY`, plus `NOTIFY_FROM` on a verified domain to reach anyone but the account owner.

**Shot quality** (`src/lib/insights/quality.ts`, pure and tested) is strokes gained per shot
rescaled so 100 = scratch: `100 + 100 × ΣSG / shots`. k = 100 reproduces Clippd's own example
(+4 over 68 shots → 106). It divides by shot rows, not strokes, because a penalty is already inside
the causing shot's SG. It's derived at read time (no column), shown as a badge on round cards and the
recap, a per-area slide in the recap, a section on `/insights`, and a last-year trend per area on
`/trends` (rolling 5 rounds, pooled by shots, not averaged per round). Fewer than 10 shots = faded.

**Learn** (`/learn`) explains the numbers: a scroll-through strokes-gained tour of one bogey
(`src/app/learn/sg-tour.tsx`, data from `buildTour` in `src/lib/learn/tour.ts`, which runs the real
engine so the tour can't drift from the app), what the shot-quality hexagon means (`explainQuality`,
`qualityLadder` in `src/lib/learn/explain.ts`), and short guides to each page. Every hexagon is
tappable (`src/app/quality-info.tsx`) and Rounds shows a dismissible first-visit tip.

**What to work on** (`/trends`, `src/lib/insights/roadmap.ts`) ranks every area of your game by
Broadie's *importance* (how much that kind of shot separates golfers' scores) × your *opportunity*
(strokes a round you lose there against scratch, last 8 rounds), and shows the *trend* alongside.
The importance shares live in `src/lib/insights/importance-broadie.ts` and are **placeholders** until
transcribed from *Every Shot Counts*: fill in the shares, `where` and `comparison`, then set
`status: 'transcribed'` to drop the caveat on the page. The formulas are in `BUILD.md` Phase 5.

`/trends` opens with a 90-day play calendar (`buildPlayCalendar` in `src/lib/insights/calendar.ts`,
pure and tested: Monday-first columns, UTC date maths, gap stats), coloured by course.
All of the scoring views live on **`/scoring`**: score history across every course, how your holes
finish vs scratch (with `strokesPerRound` pricing each gap in strokes per 18), par 3s/4s/5s
(`parTypeStats`: average score and SG per hole and per round) and the eclectic. `/insights` is
strokes gained only.
Those are compared with a **scratch benchmark** (`src/lib/insights/benchmarks.ts`, data in
`src/lib/insights/benchmark-data/scratch.json`): anonymised hole counts from scratch-or-better
golfers' competition rounds. How it's collected, anonymised and validated: `docs/benchmarks.md`.
Source screenshots live only in the git-ignored `benchmarks-raw/`.
Score colours are in `src/app/score-cell.tsx` (tokens `--color-eagle/bogey/double/worse` in `globals.css`).

The "Strokes gained" section of `/insights` leads with the average full round (or the one full
round) by discipline, with its biggest leak (`leakAndStrength` in `src/lib/insights/sg-table.ts`),
then a round-by-round grid. SG shows one decimal on screen and two on hover (`fmtSg(v, 1)`). Tapping a round × area cell opens that area's costliest shots in the browser (`drillArea` in
`src/lib/insights/recap.ts`, all precomputed by the page) and mirrors it in `?area=<roundId>.<CATEGORY>`.

**Performance.** Functions run in `lhr1` (London, `vercel.json`) next to the Neon database in `eu-west-2`;
keep them together. Reads are single joined queries; `getSessionUser()` is `cache()`d per request.
`/insights` logs `[timing] …` per request — read with `vercel logs -x -q "[timing]"`.

### Editing a finished round

Any past shot can be edited from its hole (**Edit**). The edit is **in place**: later
shots keep the results you entered and their starting positions are re-derived from the
edited shot (`src/lib/rounds/chain.ts` — a stroke-and-distance shot's end follows its
start). The exception: marking an edited shot **Holed** removes the shots after it.
The date, name, commentary and ratings are editable on the round page. **Course and tee
are fixed once a round is started** — every shot's yardages came from that tee.

### Design system

Tokens live in `src/app/globals.css` (`@theme`): warm paper background, near-black
ink, terracotta = strokes lost, green = strokes gained, steel-blue selected state;
IBM Plex Sans for text, Plex Mono for numbers/labels. Use the semantic classes
(`bg-paper`, `text-neg`, `font-mono`…), not raw Tailwind palette colours. Charts use
the same pair via `src/lib/insights/chart-colors.ts`.

The app mark (`src/app/logo.tsx`, `src/app/icon.svg`, `src/app/apple-icon.png` — keep the three
in sync) is a gold flag beside red/green SG bars. The illustrated backdrop comes in four seasons —
`public/golf-scene-{spring,summer,autumn,winter}.svg` (windy spring, sunny summer, windy autumn,
rainy winter), all generated by `node scripts/make-golf-scene.mjs` from one shared layout — and is
applied with the `.golf-scene` / `.golf-scene-strip` / `.golf-scene-hero` classes in `globals.css`.
Players pick one on the Rounds page (or leave it on **Auto**, which follows the season); the choice is
an `sg-scene` cookie (`src/lib/scene`), and the layout puts `scene-<season>` on `<body>` so the hero,
footer and sign-in page all swap together. Each image's top edge is the paper colour so it blends into
the page. They're excluded from the auth middleware's matcher so the sign-in page can load them.

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
- A fresh database needs `pnpm db:migrate` and then `pnpm db:seed` to load the
  seeded courses (Elm Park, Portmarnock).
- Sessions are cached in a signed cookie for 5 minutes (`session.cookieCache` in
  `src/lib/auth/auth.ts`, to avoid a database hit on every navigation), so removing
  a user takes up to 5 minutes to take effect.
- Round commentary and mentality ratings are private to the round's owner — even the admin's
  read-only view of a round leaves them out.

## Accounts, invites and who can do what

Sign-in is Google only (Better Auth; sessions live in our Postgres). **Sign-up is
invite-only**: `/join/<INVITE_TOKEN>` sets a one-day cookie and sends the person to
Google; creating a *new* account without that cookie is refused (`mayCreateAccount`
in `src/lib/auth/config.ts`, enforced in the `user.create.before` hook). Existing
members sign in freely. The admin (`ADMIN_EMAIL`, verified) can always sign up.
Rotating `INVITE_TOKEN` kills the old link.

- **Rounds:** private. Only the owner can see or change a round. The **admin** alone can also
  open anyone's round **read-only** (scores, shots, SG; never notes or ratings) and see the
  `/players` list; for other players those return 404, not 403, so ids can't be probed.
- **Courses:** one shared library. Anyone can add a course; only its creator or the
  admin can edit it, and once another player has a round on a tee only the admin can
  (`canEditCourse` in `src/lib/auth/permissions.ts`) — a yardage edit changes everyone's
  SG on that tee, so `applyTeeHoleEdits` (`src/lib/rounds/tee-edit.ts`) re-bases every
  affected round and recomputes it in the same transaction.
- **Legacy rounds** imported from the single-user era have no owner until the admin
  first signs in, then they inherit them (`claimLegacyData`). Until then they're
  invisible to everyone else.
- **Enforcement** lives in `src/lib/auth/guards.ts` (`requireRoundOwner`,
  `requireTeeEditor`, …); every route and page that takes an id goes through it, and
  every insights query takes a `userId`. `src/middleware.ts` is only an optimistic
  redirect — never the real check.

## Running it locally

Local dev uses **PGlite** (Postgres compiled to WASM, stored in `data/pglite`), so you
don't need to install Postgres.

```bash
pnpm install
cp .env.example .env.local   # set BETTER_AUTH_SECRET; add AUTH_TEST_MODE=1 to skip Google locally
pnpm db:migrate              # create the tables
pnpm db:seed                 # Elm Park + Portmarnock, fails loudly on any checksum mismatch
pnpm test
pnpm tsc --noEmit
pnpm dev                     # http://localhost:3000
```

Bringing over data from the old SQLite file (`data/rounds.db`): `pnpm db:import-sqlite`
(read-only on the SQLite file; refuses to run on a non-empty target; recomputes SG and
aborts unless every round's score and SG total match SQLite exactly).

## Deploying (Vercel + Neon + Google, $0)

1. **Neon** — create a project, copy the *pooled* connection string → `DATABASE_URL`.
2. **Google** — Cloud Console → OAuth consent screen (External; **publish it to
   "In production"** so friends aren't blocked by the test-user list) → OAuth client
   (Web application), redirect URI `https://<app>.vercel.app/api/auth/callback/google`.
3. **Vercel** — import the GitHub repo; set the env vars from `.env.example`
   (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`,
   `ADMIN_EMAIL`, `INVITE_TOKEN`). The `vercel-build` script runs `db:migrate` then
   `next build`. Give Preview deployments a *different* `DATABASE_URL` (a Neon branch)
   so a preview build can never migrate production.
4. **Load your data into Neon**, from your machine (the scripts don't read `.env` files, so
   pass the URL explicitly; keep it in `.env.local` as `NEON_DATABASE_URL` so `pnpm dev`
   can never hit production by accident):
   ```bash
   set -a; . ./.env.local; set +a
   DATABASE_URL="$NEON_DATABASE_URL" pnpm db:migrate
   DATABASE_URL="$NEON_DATABASE_URL" ADMIN_EMAIL=you@gmail.com pnpm db:import-sqlite
   ```
   Do **not** run `db:seed` first: the import already carries the seeded courses and
   refuses to run against a database that has any. (For a brand-new install with no old
   SQLite data, run `db:migrate` then `db:seed` instead.)
5. **Sign in yourself first** (Google). You become admin and inherit your rounds.
6. Send friends `https://<app>/join/<INVITE_TOKEN>` on WhatsApp (see "Inviting someone").

If `/login` returns a 500 with "You are using the default secret", `BETTER_AUTH_SECRET` isn't set
in Vercel's **Production** environment (all seven variables above must be). Env changes only
apply to a new deployment, so redeploy after adding them. Runtime logs:
`vercel logs --environment production --level error --no-follow --expand`.

Backups are now Neon's (point-in-time restore on the free tier is short — export
occasionally with `pg_dump "$DATABASE_URL" > backup.sql`).

## Courses played and the course directory

`/profile` (nav **Played**) maps every golf course on the island of Ireland and lets each player
tick off the ones they've played. The list is private to them, like their rounds. Courses where they've
logged a round count automatically once the admin links the scorecard course to its directory
entry ("On the course map as", on `/courses`).

The directory is a static file, `src/lib/directory/data/ireland.json`, built from OpenStreetMap
(ODbL — keep the attribution). Refresh it with the **Course directory** workflow in GitHub Actions
(Actions → Course directory → Run workflow; run from `main` it pushes a `course-directory-refresh`
branch to open a PR from), or locally with `pnpm directory:fetch`. The run log lists what it left
out (pitch & putt, ranges, duplicates, courses with no county). A refresh that loses more than 3
courses or can't place more than 3 in a county refuses to write (Overpass sometimes returns an
incomplete result) — just run it again; tick **allow drops** only when the change is real. Fix anything wrong in
`src/lib/directory/data/overrides.json` (`exclude` / `set` / `add`) and run it again. Keys are
never silently dropped (see `BUILD.md` Phase 7).

**Top 100 challenge.** `src/lib/directory/data/top100.json` holds a ranking (currently the Golf
Digest Ireland Top 100, 2023). Ranked courses get a gold `#n` badge and a gold ring on the map,
`/profile` shows "Top 100: played / ranked" and a "Top 100 only, in rank order" filter. It's empty
until the list is added: paste it into a text file, one course per line (`1. Royal County Down`),
then `pnpm directory:top100 list.txt --source "<where it's from>"`. The script matches each name to
a directory course and lists any it couldn't match confidently (set those `key`s by hand, or add the
course to `overrides.json` first). A test keeps the file consistent with the directory.

## Inviting someone: the sign-up flow

What a new player goes through, and where each piece lives:

1. **The link** `/join/<INVITE_TOKEN>` (`src/app/join/[token]/route.ts`) sets the invite cookie and
   lands on `/login?invited=1`, which reads as an invitation: what the app does in three lines, then
   Google or an emailed link.
2. **After signing in** every sign-in method sends them to **`/welcome`** (`src/app/welcome/`): a
   five-screen tour (why strokes gained, how a shot is scored using `buildTour()`'s real numbers,
   how to log a round, what comes back and when, add-to-home-screen for their phone). It ends on
   "Log your first round". It only shows unasked to a player with **no rounds** who hasn't skipped
   it in that browser (`sg_welcomed` cookie, set by `POST /api/onboarding`); anyone with rounds is
   bounced to `/`. The rules and copy are pure and tested in `src/lib/learn/onboarding.ts`;
   Learn's "Welcome tour" link reopens it (`?again=1`).
3. **Rounds with no rounds yet** shows a three-step Getting started card (`src/app/getting-started.tsx`).
4. **Their first round** shows a dismissible "Your first shot" card above the hole strip until the
   first hole is finished (`first-shot-tip.tsx`, `firstRound` on `RoundEntry`).

**Add to Home Screen.** `src/app/manifest.ts` + `public/icon-192.png` / `icon-512.png` (generated
from `src/app/icon.svg` by `scripts/make-pwa-icons.sh`; re-run when the mark changes, alongside
`apple-icon.png`) and the `appleWebApp` / `viewport` settings in `layout.tsx` make the installed app
open full screen on Rounds. The middleware lets the manifest and icons through without a session.
Tell people to **sign in first, then add it**: a magic link opens in Safari, not in the installed app,
so adding before signing in gives them a signed-out icon.

A WhatsApp message that covers the essentials:

> Here's the strokes-gained app I mentioned: https://<app>/join/<INVITE_TOKEN>
> Sign in with Google (or get a link by email), and it'll walk you through it in two minutes.
> Per shot it only needs where the ball finished and how far you had left. Log your next round
> on the course or after from your card, and you'll get a recap of where the strokes went.
> Once you're signed in, add it to your home screen (Share → Add to Home Screen) so it opens like an app.
> If your course isn't in the list, request it on the Courses page and I'll add it.

## Course requests

Players ask for a course from the Courses page (`course_requests` table, `POST /api/course-requests`,
validated in `src/lib/courses/requests.ts`, max 5 open per player). Open requests show in an
admin-only inbox at the top of `/courses`; **Mark done** closes one. `src/lib/notify.ts` also emails
the admin when `RESEND_API_KEY` is set — it never throws, so a mail failure can't lose a request.

## Adding courses from GolfCourseAPI

```bash
set -a; . ./.env.local; set +a                      # GOLFCOURSEAPI_KEY (+ NEON_DATABASE_URL)
pnpm courses:api search "stackstown"                # find ids (1 request; free tier = 35/day)
DATABASE_URL="$NEON_DATABASE_URL" ADMIN_EMAIL=you@gmail.com pnpm courses:api add <id> <id>            # dry run
DATABASE_URL="$NEON_DATABASE_URL" ADMIN_EMAIL=you@gmail.com pnpm courses:api add <id> <id> --commit   # insert
```

Mapping lives in `src/lib/import/golfcourseapi.ts` (pure, tested) and feeds the usual
`validateCourseChecksums` → `insertCourse` path. Coverage of Irish clubs is patchy (The Island,
Donabate is missing; stroke indexes are often absent) — fall back to `/import` for those.

## Stack

Next.js 15 (App Router) + TypeScript · Postgres (Neon in production, PGlite locally
and in tests) + Drizzle ORM · Better Auth (Google) · Tailwind v4 · Recharts · Vitest.
The old single-user SQLite version lives in git history (commit `50addd3`); its data
file is `data/rounds.db` (gitignored) and is only read by the one-off importer.

## Data provenance

Course data in `src/db/seed-courses.ts` is verified against each club's own
scorecard (out/in/total yardage checksums, stroke-index permutation check) — see
that file's header for exactly what was checked and against what source. The
baseline expected-strokes table (`src/lib/sg/baseline-scratch.ts`) is calibrated
to Elm Park's own course rating; see its header for the calibration numbers and
the explicit limitation (it's length-only, so it understates a links course like
Portmarnock).
