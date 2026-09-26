# Handover: Better Than Most rebrand and first commercial issues

> **Status (2026-09-26).** The issues below exist as #50–#59 (1 = #50 … 10 = #59). The approved
> landing design is saved next to this file as `landing.html` (from the published artifact
> https://claude.ai/artifact/11GU8ZfaQbxYhBmNrD2hJy). Kept as the record of the brand decisions.

For Claude Code, working in this repo. Read this, then `docs/brand/landing.html`, then open the issues below with `gh issue create` (one per section, titles and labels as given, create any missing labels first). Don't build anything from this file until the issues exist; the issues are the backlog.

## Decisions already made (don't relitigate)

- **Brand name:** Better Than Most. Short form **BTM**. From Gary Koch's call on Tiger's putt at Sawgrass, 2001. Never use player names, likenesses or broadcast clips; the phrase only.
- **Positioning:** strokes gained for competitive club golfers and their coaches. First market: Irish and UK club golfers, one club at a time (Portmarnock, Elm Park first).
- **Copy rules:** dry, confident clubhouse voice. Never use the word "leak" (use "where the strokes go", "costliest shots", "loses strokes"). Don't use "Five and a half inches" or the Bobby Jones quote. The Head Game section is headed "The shot before the shot".
- **Motivation line:** "win the club championship" appears in the hero and the closing CTA.
- **Pricing:** first round free, no card. Then **€7/month** ("Player"), unlimited rounds. Coach tier price is a placeholder (€49/month) until the first coaches are on board.
- **Visual identity** (see `docs/brand/landing.html` for tokens): clubhouse classic. Cream `#F2EBDC`, paper `#FBF7EE`, ink `#1C2620`, forest green `#144433`, gold `#B48A3C`, gain `#2C7A4B`, loss `#A94330`. Fraunces for headlines, Source Serif 4 for body, IBM Plex Mono for every number. Dark theme tokens are in the same file.
- **Landing page:** `docs/brand/landing.html` is the approved design. Its hero widget runs on the real anchors from `src/lib/sg/baseline-scratch.ts`; the handicap adjustment in it is a rough estimate and is labelled as such.

## Issues to open

Labels: `brand`, `design`, `growth`, `billing`, `product`, `epic`.

---

### 1. Rebrand to Better Than Most
Labels: brand

**Why.** "Strokes Gained" is descriptive, untrademarkable and crowded in search. The brand is Better Than Most (BTM).

**Scope.**
- App name, `<title>`, metadata, PWA manifest, favicon/mark (green circle, "BTM" in Plex Mono, see landing nav).
- README, PLAN.md, BUILD.md headers and any user-facing "Strokes Gained" strings. Keep "strokes gained" lower-case where it means the metric.
- Vercel project name and domain (candidates: betterthanmost.golf, btm.golf; check availability and UK/EU/US trademark classes 9 and 41 before buying).
- Repo rename can wait; note it in the PR.

**Done when** no user-facing surface says "Strokes Gained" as a product name, and the brand mark is on the sign-in page.

---

### 2. Brand design tokens in the app
Labels: brand, design

**Why.** The product should look like the landing page.

**Scope.**
- Port the `:root` tokens (light and dark) from `docs/brand/landing.html` into `src/app/globals.css`. Map existing tokens (`--color-eagle/bogey/double/worse`, steel-blue accent) onto the new palette; gain/loss colours must stay distinguishable for colour-blind users.
- Fonts via `next/font/google`: Fraunces (display), Source Serif 4 (body), IBM Plex Mono (numbers). Every SG figure and score cell uses the mono face with `tabular-nums`.
- `src/app/score-cell.tsx` and the Insights bar charts pick up the new colours.
- Keep contrast ≥ 4.5:1 for body text in both themes.

**Done when** `/insights`, `/scoring`, `/rounds/[id]` render in the new palette and fonts with no regressions in the score colour tests.

---

### 3. Public landing page at `/`
Labels: design, growth

**Why.** The product tour has to be the front door. Signed-out visitors currently hit sign-in.

**Scope.**
- Build `docs/brand/landing.html` as a Next.js route for signed-out users (signed-in users keep the current dashboard at `/` or get redirected to `/insights`; pick one and document it).
- Benchmark widget: reuse `src/lib/sg/interpolate.ts` and the anchors in `baseline-scratch.ts` rather than the copied table. Keep the per-handicap estimate labelled as an estimate; replace it with real handicap-band data when the benchmark dataset supports it.
- Replace the mock "Sunday medal" and "How your holes finish" cards with real screenshots of `/insights` and `/scoring` once issue 2 lands (or render real components with seeded data).
- All CTAs go to sign-in. Pricing section reflects issue 4 and 5.
- Lighthouse ≥ 90 on mobile; page works at 400px.

**Done when** an anonymous visitor can read the tour, use the widget, and reach sign-in from any CTA.

---

### 4. Free tier: first round free, then paywall
Labels: billing, product

**Why.** One round is enough to see the costliest shots; that's the hook. Everything after is paid.

**Rules.**
- Every account can create and finish **one** round with full SG, costliest shots, and the recap. No card.
- Starting a second round requires an active subscription (issue 5). Show a paywall on `/rounds/new` and anywhere a second round could be created (import, invite flows).
- Historic data is never locked: a lapsed subscriber can still view every round they logged.
- Friends' read-only views follow the viewer's entitlement, not the owner's.
- Add `entitlement` helper in `src/lib/` (`canCreateRound(userId)`), unit tested; UI reads from it, never counts rounds itself.
- Admin/owner allowlist env var for testers and club pros in phase 0.

**Done when** a new Google sign-in can log exactly one round and is shown the paywall on the second, and tests cover the boundary.

---

### 5. Stripe subscription (€7/month Player)
Labels: billing

**Scope.**
- Stripe Checkout for a single monthly price (€7). Annual plan later.
- `subscriptions` table via Drizzle: user id, Stripe customer id, subscription id, status, current period end. Migration + migration check in CI.
- Webhook route (`checkout.session.completed`, `customer.subscription.updated/deleted`) with signature verification; idempotent.
- Customer portal link on a `/account` page for cancel/update card.
- `.env.example` entries; secret scan must not flag them.
- Entitlement (issue 4) reads `status in ('active','trialing')`.

**Done when** a test-mode purchase unlocks round 2 within one webhook delivery, and cancelling re-locks at period end.

---

### 6. Practice plan: "Next session"
Labels: product

**Why.** The strategy's promise is "what to practise, proven". The app ranks skill areas; it doesn't yet turn that into a session.

**Scope.**
- Extend `src/lib/insights/trends.ts` practice priority into a plan: top 3 areas ranked by strokes at stake per round over the last N rounds (N=6 default, min 3), with the distance band that's costing most (e.g. approach 140–170).
- Drill library (static JSON to start) keyed by area × band: name, instructions, pass mark, rationale. Seed with: random-practice approach ladder (9 balls, 3 targets, scored), wedge distance matrix (3 clubs × 3 lengths), 4–8 ft circle putting (16/20), lag putting 30–50 ft (inside 3 ft), bunker to 10 ft. Every drill is random practice with a score; no blocked-practice drills.
- `/practice` page: the plan, each drill's pass mark, and a "log session" form (date, drill, score, pass/fail).
- Store sessions; show pass rate trend per drill on `/practice` and reference it on `/trends`.
- Copy voice per handover. Never "leak".

**Done when** a user with ≥3 rounds sees a ranked plan with drills and can log a session against it.

---

### 7. Head Game × strokes gained
Labels: product

**Why.** README lists this as not built. It's the wedge feature nobody else has.

**Scope.**
- On `/insights`: mean SG per shot for committed vs hesitant, external vs internal focus, with shot counts and a minimum-sample guard (hide until ≥20 tagged shots per side).
- Per round: BTT ratings vs round SG scatter or table across rounds (min 4 rounds).
- "Hesitant shots cost you 0.31 each; you hit six on Sunday" style callout in the round recap.
- Pure functions in `src/lib/insights/` with tests; UI copy per handover ("The shot before the shot").

**Done when** a user with tagged shots sees the split and the recap callout; users without tags see nothing (no empty charts).

---

### 8. Club leaderboard
Labels: product

**Scope.**
- Per club (course library group): members, SG per round (last 10), rounds played, best round. Sorted by SG.
- Read-only, respects existing invite-only friends model.
- Link from `/insights` and the round page. Mono numbers, tour-style colours.

**Done when** two invited users at the same club see each other on the board.

---

### 9. Logging speed: under 10 seconds per hole
Labels: product, growth

**Why.** Manual shot entry is the number-one churn reason for every strokes-gained app. This is the most important product work in the plan.

**Scope (investigate, then split into sub-issues).**
- Baseline: time a real round on the current `/rounds/[id]` UI; record median seconds per hole and per shot.
- GPS auto-distance to the green centre (course data already in the library; add green coordinates where missing).
- Offline-first entry with sync (service worker or local queue).
- Voice entry prototype ("seven iron, 165, fairway").
- Apple Watch feasibility note (probably a native app; document the cost).

**Done when** the baseline is documented and the sub-issues exist with estimates.

---

### 10. Coach tier (epic)
Labels: epic, product

**Why.** One coach brings 30–100 golfers. Sales motion for phase 3.

**Scope, to be split later.**
- Coach role and student links (student grants read access).
- Roster: SG by area per student, last round date, trend arrow.
- Weekly digest email: who lost what, where.
- Lesson notes attached to a round or a drill.
- Pricing placeholder €49/month; validate with three club pros before building billing.

**Done when** the epic is split into shippable issues after the first three coach conversations.

---

## After the issues exist

Suggested order: 1 → 2 → 3 in one week; 4 → 5 next; 6 and 7 are the product wedge; 9 runs alongside as investigation. 8 and 10 wait.
