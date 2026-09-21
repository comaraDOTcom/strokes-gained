# Changelog

Each shipped feature or fix gets its own release: bump `version` in `package.json`, add an
entry here, tag `vX.Y.Z`, and publish a GitHub release with the same notes. While the app is
pre-1.0 every release bumps the patch number (0.0.1, 0.0.2, …).

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
