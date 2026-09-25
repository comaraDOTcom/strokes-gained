# Connecting to Golf Ireland — research notes

Tracks [issue #6](https://github.com/comaraDOTcom/strokes-gained/issues/6) ("connect to golfireland
api somehow"). Researched 25 Sept 2026. Everything below comes from public sources; the
Golf Ireland, DotGolf and app-store pages themselves could not be opened from the research
session (network policy), so a few details are marked **verify** — they are from search
snippets, not the page itself.

## TL;DR

- The "Golf Ireland app" is not new: it launched in April 2021 and is built by **DotGolf**
  (a Golf New Zealand subsidiary) on the same codebase as England's MyEG, My Scottish Golf and
  the Golf NZ app. It got minor updates in June and July 2026.
- There is **no golfer-facing API, no data export and no "sign in with Golf Ireland"**. The only
  APIs are the DotGolf **ISV API** and **Union API** on `clubhouse.golfireland.ie`, which are
  licensed to club-software vendors and tournament organisers, priced per club, and not designed
  for a consumer app.
- The realistic connector today is **manual**: course rating + slope per tee (which the app shows
  you) and hole-by-hole gross scores from your scoring record. Both are cheap to support in this
  app and unblock things already on the backlog (Portmarnock's missing rating, scoring views for
  rounds you didn't shot-track).
- The bigger story is that **Golf Ireland launched its own Strokes Gained Ratings in March 2026**,
  built by Quantum Sports Data from hole-by-hole scores in Clubhouse. Theirs is score-level and
  field-adjusted ("how good"); this app is shot-level Broadie ("why"). That is a complementary
  pitch to Golf Ireland's High Performance side, and it is the most credible route to any money.
- Funding: no scheme pays an individual for a side project. The paths are (a) Golf Ireland or a
  club/coach paying for it, (b) Sport Ireland's Digital Catalyst Fund with Golf Ireland as the
  applicant and you as the vendor, or (c) forming a company and going to Enterprise Ireland's
  Pre-Seed Start Fund. All three start with the same conversation.

## 1. What the Golf Ireland app is

| | |
|---|---|
| Publisher / developer | Golf Ireland; built and published by **DotGolf NZ LP** (Albany, Auckland; `apps@dotgolf.co.nz`) |
| Package / store ids | Android `ie.golfireland.mygolf`; iOS id `1525650676` |
| Launched | April 2021, alongside WHS |
| Recent releases | 9 Jun 2026 and 15 Jul 2026 — "general improvements and bug fixes" (e.g. text when no active tees exist for scorecard creation) **verify** |
| Sibling apps (same DotGolf platform) | MyEG (England Golf), My Scottish Golf, Golf NZ, HNA Handicaps (South Africa), Wales Golf |

**What a member can do in it**

- See Handicap Index, scoring history, and which scores count toward the index.
- See a **hole-by-hole record** for each round.
- **General play scores**: pre-register (geo-fenced to the course; a time lag before a score can be
  posted), pick a marker/attester, enter the score, and the attester verifies in the app.
- **Digital scorecard** with a chosen marker (DotGolf feature; the NZ help centre documents it).
- Course rating, slope, score differential, PCC and course handicap are shown on the score detail
  screen when you pick a course and tee.
- Follow friends, get notifications; iGolf subscribers use the same app.
- **Cross-border GB&I scoring** since 2023: general play at affiliated courses in England, Scotland
  and Wales from the same app.

**What it does not do**

- No export (CSV/PDF), no share-to-third-party, no OAuth. Google Play's data-safety label says the
  app "doesn't share user data with other companies or organisations".
- No shot-level data. Golf NZ's build of the app has a **MyStats** layer (fairways, GIR, putts,
  bunkers, penalties over all / last / last-5 rounds); it is not confirmed in the Irish build
  **verify**. If DotGolf ships it here, it is the "traditional stats" layer that `PLAN.md` argues
  against — strokes gained stays the differentiator.

## 2. The APIs that exist

All on the DotGolf "Clubhouse" platform that Golf Ireland uses for WHS. Docs/Swagger UI look
publicly readable in a browser; calling anything needs credentials that Golf Ireland issues.

| API | URL | Who it is for | What it does |
|---|---|---|---|
| **ISV API** | `https://isvapi.clubhouse.golfireland.ie/index.html` (Swagger), `/v1documentation` (supplementary docs) | Licensed Independent Software Vendors (club software) | JWT auth: obtain an access + refresh token, send `Authorization: Bearer …`. Resource areas seen in the docs: **Club Members, Courses, Scores, Visitors**. This is how BRS, ClubV1, Golfgraffix, MasterScoreboard etc. pull Handicap Index and push competition scores. |
| **Union API** | `https://unionapi.clubhouse.golfireland.ie/index.html` | Unions / tournament organisers (e.g. Golf Genius) | "Create scores, update existing scores, and delete scores from a player's handicap record." |
| **SSO** | `https://sso.clubhouse.golfireland.ie/` | Club administrators | Login for Clubhouse itself; not an OAuth provider for third parties. |
| Same product elsewhere | `isvapi.whsplatform.englandgolf.org`, `unionapi.clubhouse.scottishgolf.org`, `isvapi.golf.co.nz`, `isvapi.wa.dotgolf.co.uk` | | Useful because England Golf publishes more about the licence terms. |

Also relevant: the USGA/R&A **WHS Software Accreditation and Interoperability Programme** (2024).
It standardises "retrieval of a Handicap Index and the return of away scores" between national
associations and accredited software, and says third-party products may verify golfer data
programmatically "depending on the organisation's approved use case". In practice the national
association (Golf Ireland) decides who gets in.

Course rating and slope data sits inside the same platform. There is no public Golf Ireland
course-rating database; third-party sites (coursehandicap.com, golfpass, bluegolf) republish it
with mixed quality — for Portmarnock, golfpass lists slopes of 151 / 135 / 129 (Blue / White /
Green) while bluegolf shows a placeholder 70.0 / 110 for every tee. **Take the numbers from the
app's score-detail screen, not from those sites.**

## 3. How access is licensed today

- ISVs sign a **WHS licence** with the home union (CONGU terms) and are then listed as licensed
  providers. Golf Ireland keeps a "Licensed Competition Management Software Providers /
  Tournament Organisers" page in its Club Hub **verify**. Known licensees across GB&I: Club
  Systems (ClubV1 / HowDidiDo), Intelligent Golf, BRS Golf, Golfgraffix, MasterScoreboard,
  GolfBox, Golf Genius, HandicapMaster, Golf Autoscore, DotGolf itself.
- It is priced **per club**: reported at €50 per club per year in Ireland (2021) and £74.50 + VAT
  per club per six months in England. The model assumes the vendor acts *for a club*, which is why
  a member-facing app has no obvious slot — a consumer app isn't "a club".
- Consumer apps in GB&I (Hole19, Golfshake, Golf GameBook) do **not** post general play scores to
  Golf Ireland or England Golf; only the official apps do. (In the US, GHIN licenses apps such as
  Golfshot and 18Birdies to post scores — there is no equivalent programme here yet.)
- So "register/license to get access" (the issue's wording) means: **write to Golf Ireland
  handicapping / club support and to DotGolf with a specific, narrow ask**, and expect the answer
  to be shaped by whether Golf Ireland wants what you're offering (see §5), not by a form.

## 4. Connectivity options, ranked

| # | Option | Needs a licence? | Effort here | What it unlocks | Verdict |
|---|---|---|---|---|---|
| A | **Type in course rating + slope per tee** from the app's score-detail screen | No | Nothing to build — `tees.course_rating` / `slope_rating` already exist | Portmarnock rating (currently missing), which turns on the cross-course `difficultyAdjustment` in `/trends` and net/Stableford on the scorecard | **Do this week** |
| B | **"Add a round from your Golf Ireland record"**: gross per hole (+ playing handicap, tee) for rounds you didn't shot-track | No | Small: a shot-less round type; scoring views (`scorecard.ts`, `scoreDistribution`, eclectic, play calendar) already work off gross per hole. SG views must skip these rounds — the per-hole SG invariant can't hold without shots | Full score history in `/scoring` and `/trends` even when you don't shot-track; a bridge to the benchmark data in `docs/benchmarks.md` | **Worth building** |
| C | **Read Handicap Index** (ISV API "Club Members") | Yes | Small once credentialed: a nightly fetch → `rounds.playing_handicap` default, course handicap per tee | Auto-filled playing handicap; index trend next to SG trend | Ask for it; don't build ahead of an answer |
| D | **Submit general play scores** (Union/ISV "Scores") | Yes, plus WHS rules (pre-registration, attester, geofence, PCC) | Large, and compliance-heavy | The app becomes a scoring client | Not for a solo project; only as part of a Golf Ireland partnership |
| E | **Reverse-engineer the app's private endpoints** | — | — | — | **No.** Breaches the app terms, touches other members' data (friends, attesters), and would end any partnership conversation before it starts |
| F | **GDPR subject access request** to Golf Ireland for your own scoring record | No | One email | A one-off backfill of your history (format unknown — likely PDF/CSV) | Useful once, not a connector |

## 5. Golf Ireland's own Strokes Gained Ratings (the opportunity)

- Announced **31 March 2026** at the season launch in Carton House; live at
  `golfireland.quantumsportsdata.com`. Built with **Quantum Sports Data** (Dublin; founder/CEO
  Dylan Beirne, ex-SIG golf trading; raised ~€700k, round led by SportsContentCo, Dec 2025; the
  company's core business is golf betting data).
- Method: **Adjusted Strokes Gained (ASG)** per round = your score minus the estimated
  average-championship-player score for that course/day, estimated from the field's scores.
  Rolling two-year window, exponential decay on older rounds, minimum 20 rounds (men) / 10
  (women) to be ranked. Data source: **hole-by-hole scores returned to Clubhouse** from Golf
  Ireland championships and the Senior Scratch Cups.
- Pilot through 2026; intended from **2027 as the primary qualification route** for men's and
  women's championships on the Bridgestone Orders of Merit, and "potentially" for talent
  identification and selection for teams and coaching panels.

Why it matters for this project:

1. Golf Ireland has just proven it will **partner with a small Irish data company** on strokes
   gained. The appetite exists.
2. ASG answers *how good* a player is relative to a field. It cannot say *where* the strokes go —
   it has no shot data. This app does exactly that (Broadie categories, recovery/penalty
   attribution, mentality tags, "what to work on"). For **performance panels and coaches** the
   two together are a whole picture; alone, each is half.
3. The gap to fill to be credible: a scratch/plus baseline they'd trust (`baseline-scratch.ts` is
   length-only and calibrated to Elm Park — the header says so), the Broadie importance shares
   still marked placeholder in `importance-broadie.ts`, and a multi-player/coach view.

Possible partners, in order: Golf Ireland High Performance (owns the panels and the 2027 plan);
Quantum Sports Data (would gain shot-level data; but note their commercial focus is betting, so be
clear about what data you would and wouldn't share); provincial branches and coaches running
panels; clubs with scratch-cup fields.

## 6. Funding — what actually exists

| Route | Who applies | Size | Fit |
|---|---|---|---|
| **Golf Ireland (or a branch/club) pays for a pilot** | Them | Small, but real | Best first step; also the precondition for API access |
| **Sport Ireland Digital Catalyst Fund** | NGBs, LSPs, Sport-Ireland-funded bodies — **not individuals** | Small (the 2027 scheme is up to €15k per project; 2026 total across two schemes ≈ €555k) **verify** | Golf Ireland applies; you are the delivery partner. Explicitly covers "data collection, analytics… enhance performance of athletes" |
| **Enterprise Ireland Pre-Seed Start Fund** | A company (needs incorporation, HPSU ambition) | €50–100k | Only if you want to make this a business |
| **Enterprise Ireland Innovation Voucher** | A company + a college | ~€5k | e.g. baseline validation with a university sports-science group |
| **DTIF Call 8** | Consortia | €40m pot; opens 1 Oct 2026, closes 3 Feb 2027 | Not realistic for this |
| **Sport Ireland Golf Ireland Professional Scheme** | Players | €30k each | Not applicable (it's for tour pros) |

Honest read: the money follows the partnership, not the other way round. The one-page pitch in §7
is the asset to make first.

## 7. Next steps

1. **Now, no permission needed**
   - Open the Golf Ireland app → Enter Score → pick Portmarnock and each tee → copy course rating
     and slope into the course editor. Do the same for Elm Park to cross-check the on-file values.
   - Open the ISV API Swagger UI and `/v1documentation` in a browser and save the page/JSON under
     `archive/golf-ireland/` for reference (they're readable without a login, as far as search
     shows — **verify**).
   - Send the outreach email below.
2. **Product (small, independent of any answer)**
   - Option B: shot-less rounds from a Golf Ireland scoring record. Keep them out of SG
     aggregates; include them in `/scoring` and `/trends` scoring views; badge them "score only".
   - Show course handicap per tee when a tee has rating + slope (`Course Handicap =
     Index × Slope/113 + (CR − Par)`, WHS GB&I; playing handicap = 95% in singles stroke play).
3. **If Golf Ireland engages**
   - Ask for ISV API read access scoped to *consenting members' own records* (Handicap Index,
     scoring record). Offer to sign the standard WHS licence terms.
   - Only then design Option C; leave Option D unless they ask for it.
4. **Pitch material**: a one-pager: what shot-level SG adds to ASG for panels; a sample report
   from your own rounds; the baseline caveats stated plainly (they'll respect it more).

### Draft outreach email (to Golf Ireland handicapping/club support, cc DotGolf apps@dotgolf.co.nz)

> Subject: Shot-level strokes gained for Irish golfers — request for ISV API information
>
> Hi team,
>
> I'm an Irish club golfer and software engineer. I've built a strokes-gained app that logs every
> shot (lie and distance) and reports strokes gained by category against a scratch baseline,
> along with practice priorities — the shot-level layer underneath the Adjusted Strokes Gained
> ratings you launched with Quantum Sports Data this spring.
>
> I'd like to understand two things:
>
> 1. Whether there is a route for a member-facing app to read a golfer's own Handicap Index and
>    scoring record from the Clubhouse platform with that golfer's consent — for example a
>    read-only ISV licence, or the WHS interoperability programme — and what the terms are.
> 2. Whether Golf Ireland's High Performance team would be interested in a small pilot with a
>    panel or a coach, where shot-level strokes gained sits alongside the ASG ratings.
>
> Happy to share a demo with my own rounds. Thanks for your time.
>
> Conor

## Sources

- Golf Ireland app: [App Store](https://apps.apple.com/ie/app/golf-ireland/id1525650676),
  [Google Play](https://play.google.com/store/apps/details?id=ie.golfireland.mygolf),
  [launch story, Irish Golfer, Apr 2021](https://irishgolfer.ie/latest-golf-news/2021/04/20/golf-ireland-app-launched-introducing-flexible-playing-options/),
  [Golf Ireland app FAQs](https://www.golfireland.ie/club-hub-detail/golf-ireland-app-faqs),
  [My golf app](https://www.golfireland.ie/my-golf-app),
  [Handicap system](https://www.golfireland.ie/handicap-system)
- DotGolf APIs: [ISV API (Golf Ireland)](https://isvapi.clubhouse.golfireland.ie/index.html),
  [ISV API supplementary docs](https://isvapi.clubhouse.golfireland.ie/v1documentation),
  [Union API (Golf Ireland)](https://unionapi.clubhouse.golfireland.ie/index.html),
  [ISV API (England Golf)](https://isvapi.whsplatform.englandgolf.org/v1documentation),
  [DotGolf NZ LP developer page](https://apps.apple.com/gb/developer/dotgolf-nz-lp/id1772181062),
  [Golf NZ app (MyStats)](https://apps.apple.com/nz/app/golf-nz/id1362149135)
- Licensing: [England Golf licensed ISVs](https://www.englandgolf.org/licensed-independent-software-vendors),
  [ISV fees passed to clubs (2021)](https://thegolfbusiness.co.uk/2021/02/england-golf-disappointed-isvs-handicap-cost-clubs/),
  [Golf Genius WHS licence for home nations](https://golfbusinessnews.com/news/corporate/golf-genius-approved-to-deliver-whs-for-home-nations/),
  [Golf Ireland licensed competition software providers](https://www.golfireland.ie/club-hub-detail/licensed-competition-management-software-providers),
  [WHS software accreditation](https://www.whs.com/softwareaccreditation.html),
  [WHS Interoperability Standard v1.0 (PDF)](https://www.whs.com/content/dam/whs/documents/World%20Handicap%20System%20Interoperability%20Standard%20v1.0_.pdf),
  [Cross-border scoring in GB&I](https://www.englandgolf.org/news-detail?newsarticleid=539)
- Strokes Gained Ratings: [Irish Golfer, 31 Mar 2026](https://irishgolfer.ie/latest-golf-news/2026/03/31/golf-ireland-launch-new-strokes-gained-ratings-system/),
  [Irish Examiner](https://www.irishexaminer.com/sport/golf/arid-41820005.html),
  [ratings site](https://golfireland.quantumsportsdata.com/),
  [Bogey Men podcast ep. 298 with Dylan Beirne](https://podcasts.apple.com/ie/podcast/dylan-beirne-explains-golf-irelands-new-stroke-gained/id1510331480?i=1000764641977),
  [East of Ireland reserve list column, May 2026](https://irishgolfer.ie/latest-golf-news/columns/2026/05/28/east-of-ireland-reserve-list-shows-strokes-gained-system-is-needed/),
  [QSD funding round](https://www.morningstar.com/news/business-wire/20251222669222/sportscontentco-leads-investment-round-in-quantum-sports-data)
- Course ratings: [Portmarnock on GolfPass](https://www.golfpass.com/travel-advisor/courses/25773-portmarnock-golf-club-championship-course),
  [Portmarnock on BlueGolf](https://course.bluegolf.com/bluegolf/course/course/portmarnock/detailedscorecard.htm),
  [coursehandicap.com Ireland](https://coursehandicap.com/ireland/)
- Funding: [Sport Ireland Digital Catalyst Fund 2026](https://www.sportireland.ie/research/digital-catalyst-fund-2026),
  [Sport Ireland grants 2027 (UL summary)](https://www.ul.ie/ehs/pess/pepays-ireland/news/sport-ireland-research-evaluation-digital-catalyst-grants-2027),
  [Enterprise Ireland programmes guide](https://priyalifescience.com/article/enterprise-ireland-funding-programmes-pssf-hpsu-founder-guide),
  [DTIF Call 8](https://enterprise.gov.ie/en/what-we-do/innovation-research-development/disruptive-technologies-innovation-fund/)
