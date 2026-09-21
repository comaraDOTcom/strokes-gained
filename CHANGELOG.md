# Changelog

Each shipped feature or fix gets its own release: bump `version` in `package.json`, add an
entry here, tag `vX.Y.Z`, and publish a GitHub release with the same notes. While the app is
pre-1.0 every release bumps the patch number (0.0.1, 0.0.2, …).

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
