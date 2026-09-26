# Billing plan: the Member's card, four free rounds, then €12.99 a month

For [issue #54](https://github.com/comaraDOTcom/strokes-gained/issues/54) (Stripe subscription). It
reshapes [issue #53](https://github.com/comaraDOTcom/strokes-gained/issues/53) (free tier).
Status: **decisions made (section 5)**. Built: schema, entitlement rules, Stripe client, webhook, Checkout route. Next: the Member's card screens.
Design mock: [`member-card.html`](member-card.html). Open it in a browser.

## 1. What changes from the handover

The handover and #53 say *first round free, no card*. This plan changes two things:

- **The card comes first.** Handing it over is the reward moment: add a card, and your first four rounds
  are on the house. Nothing is charged until the player starts round five.
- **Four free rounds, not one.** We are in the sign-up and feedback stage, and four rounds is enough to
  see a pattern, not a one-off. The number is one constant (`FREE_ROUNDS` in
  `src/lib/billing/entitlement.ts`), so it can change later without touching anything else.

Why the card comes first:
- Round five becomes one tap ("Start membership · €12.99") instead of a cold Checkout form.
- One set of free rounds per **card**, not per Google account (Stripe card fingerprints), so fresh
  sign-ins can't farm them.
- Free rounds are **counted when started and never given back**. Deleting rounds does not reset the
  count.

**Price: €12.99 a month** (Conor, 26 September; the handover and landing page say €7). The copy reads it
from `PLAYER_PRICE_LABEL` in `src/lib/billing/checkout.ts`, which must match the Stripe price.

Knock-on edits are in build step 12: the landing page's pricing card ("No card needed", "Log one full
round", "€7"), the handover's pricing line, and #53's rules.

## 2. The player's path (the game)

Clubhouse, not casino: no points and no streaks. The player sees one card and a book of four tickets.

| Moment | Where | What they see |
|---|---|---|
| **1. Claim** | `/rounds/new` when the gate is `claim-free-rounds`. A new player gets here straight after the welcome tour. | A blank Member's card in forest green with the gold BTM mark and their name. Under it, a strip of four tickets: **"Four rounds on the house"**. One button: **Claim your free rounds**. Below it: *Nothing is taken today. €12.99 a month starts only when you tee up round five. Cancel any time.* |
| **2. Card on file** | `/billing/welcome`, where Checkout returns | The card embosses: **Member No. 0042**, *Member since September 2026*, and *Founding member* on cards 1 to 100. Button: **Tee off**. |
| **During** | New-round form and round page | A small ticket strip, one stub punched per round started: **3 of 4 free rounds left**. |
| **3. Free rounds played** | Last slide of the round-four recap | All four stubs punched. One line from the recap as the hook: *"Your costliest area over four rounds is approach: −2.1 a round."* Button: **Keep the card active**. |
| **4. Start membership** | `/rounds/new` when the gate is `start-membership` | The card with a gold rule and **Player**. **Start membership · €12.99 today, then monthly**. On success the new-round form opens. |

Other gates reuse the same card with a different line:
- `fix-payment`: *"Your card was declined. Update it to log new rounds. Every round you've logged is still here."*
- `rejoin`: *"Your membership ended on 3 October. Your rounds are all still here."*

**Copy rules** (handover): dry clubhouse voice. Never write "leak".

## 3. How it maps onto Stripe

**The trial covers the free rounds.** Checkout puts the card on file as a `trialing` subscription to the
€12.99 Player price, and nothing is charged. When the player starts round five, we end the trial ourselves.

| Step | Stripe call | Notes |
|---|---|---|
| Claim | `checkout.sessions.create` | `mode: 'subscription'` with the Player price and `subscription_data.trial_period_days: 730` (Stripe's maximum), so only round five ever charges. Also `payment_method_collection: 'always'`, `trial_settings.end_behavior.missing_payment_method: 'cancel'`, `client_reference_id: userId`, a reused `customer`, `consent_collection.terms_of_service: 'required'` (needs a terms page, D6), and `custom_text.submit` with the "nothing today" line. A `rejoin` gets the same session **without** a trial. |
| Card on file | webhook `checkout.session.completed` | Link the customer and subscription to the user and give them a member number (`assignMemberNumber`). Read the card fingerprint. If that card has already used its free rounds on another account, set `free_rounds_used` to `FREE_ROUNDS`. |
| Rounds 1 to 4 | none | `POST /api/rounds` counts the free round in the same transaction as the insert (`spendFreeRound`). The update is conditional, so two taps on the last free round count once. |
| Start membership | `subscriptions.update(id, { trial_end: 'now', payment_behavior: 'pending_if_incomplete', proration_behavior: 'none' })` | Charges €12.99 now. If the charge fails, nothing changes: the player stays `trialing` and sees the decline. If 3-D Secure is needed, send them to `latest_invoice.hosted_invoice_url`. On success, write `active` from the response straight away, so round five unlocks without waiting for the webhook. The webhook then confirms it. Check in test mode that `pending_if_incomplete` accepts `trial_end`. |
| Manage | `billingPortal.sessions.create` from `/account` | Portal settings: update card, cancel **at period end**, no plan switching yet. |
| Keep in sync | webhook `customer.subscription.created/updated/deleted`, `invoice.payment_failed` | On every event, **fetch the subscription again** and write its current state. Retried or out-of-order events then can't roll it back. |

**Webhook route** (`src/app/api/billing/webhook/route.ts`):
- Read the raw body with `await req.text()` and verify it with `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`.
- In one transaction, insert the event id into `stripe_events` (`on conflict do nothing`) and apply the change. If the id is already there, skip the event. If anything fails, both roll back and Stripe retries.
- Add the route to `PUBLIC` in `src/middleware.ts`, because Stripe has no session cookie.
- In current API versions, `current_period_end` is on the subscription **item**, not the subscription.

**Entitlement** (`src/lib/billing/entitlement.ts`, built): pages and routes call `getEntitlement(viewer)`
and act on `{ canCreateRound, reason | gate }`. They never count rounds or read Stripe statuses themselves.

| Subscription | Free rounds used | New round? |
|---|---|---|
| billing off (`BILLING_ENABLED` unset) | any | yes (`billing-off`) |
| exempt (see below) | any | yes (`exempt`) |
| none, abandoned Checkout, cancelled during the trial | fewer than 4 | no, `claim-free-rounds` |
| `trialing` | fewer than 4 | **yes, `free-round`**, with how many are left |
| `trialing` | 4 | no, `start-membership` |
| `active`, including cancelling at period end | 4 | yes (`member`) |
| `past_due` or `unpaid` (a payment failed) | any | **no, `fix-payment`**, straight away |
| `canceled`, `paused`, unknown | 4 | no, `rejoin` |

**Exempt:**
- the admin;
- Conor's personal account, free for good. It's matched by a SHA-256 hash in code, because the repo is public;
- anyone on `BILLING_EXEMPT_EMAILS`;
- anyone whose account was created before `BILLING_EXEMPT_JOINED_BEFORE`. This covers the players already using the app.

Viewing is never gated. A lapsed player can open every round they logged. Friends' read-only views follow
the viewer's entitlement (#53). A failed payment blocks **new rounds** only. Shots can still be added to
a round that was started before the payment failed.

## 3a. Checkout Studio settings

Conor configured these in Stripe's Checkout Studio. They are used as given in
`src/lib/billing/checkout.ts`, alongside the plan's own parameters above.

| Parameter | Value | Note |
|---|---|---|
| `ui_mode` | `hosted_page` | Stripe's hosted page. No Stripe.js, so the **publishable key isn't used**. |
| `billing_address_collection` | `auto` | |
| `phone_number_collection` | enabled | Adds a field to the form. Worth reviewing: we don't use the number. |
| `automatic_tax` | off | So D7 (VAT) is "off for now". Turn it on here and in the dashboard when VAT is sorted. |
| `allow_promotion_codes` | false | |
| `payment_method_collection` | `always` | Also what the free-rounds trial needs. |
| `submit_type` | `auto` | Accepted in subscription mode (checked in the sandbox). |
| `name_collection.individual` | enabled, optional | |
| `integration_identifier`, `origin_context` | `hosted_web_0001`, `web` | Checkout Studio's own tags. |

Not set yet: `consent_collection.terms_of_service` needs a terms URL in the Stripe dashboard, and
that waits on D6.

## 3b. Setup (Conor)

Test mode first. Nothing here charges a real card.

1. **Keys, in `.env.local`:** `STRIPE_SECRET_KEY` (`sk_test_…`) is done. The publishable key isn't
   needed.
2. **Price:** done. The sandbox product "Better Than Most membership card" has a €12.99 monthly
   price, and its id is in `STRIPE_PRICE_PLAYER`. The same product also has a one-off €12.99 price
   that nothing uses; archive it to avoid picking it by mistake.
3. **Webhook secret:** install the Stripe CLI (`brew install stripe/stripe-cli/stripe`) and run
   `stripe login`. Then run `stripe listen --forward-to localhost:3000/api/billing/webhook` and put
   the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`.
4. **Switch it on locally:** `BILLING_ENABLED=1`.
5. **Test cards:**

   | Card | What it does |
   |---|---|
   | `4242 4242 4242 4242` | Succeeds |
   | `4000 0025 0000 3155` | Asks for 3-D Secure |
   | `4000 0000 0000 0341` | Attaches fine, then fails when charged (for the failed-payment gate) |

   Use any future expiry date and any CVC.
6. **Before live:**
   - activate the account with your business details and a bank account;
   - add a webhook endpoint in the dashboard for `https://<site>/api/billing/webhook`, with the events in section 3;
   - set up the customer portal;
   - add the terms and privacy pages (D6), and decide VAT (D7);
   - set the live keys in Vercel Production only.

## 4. Build steps

Each step is a commit on this PR's branch. Tests run against PGlite as usual.

- [x] 1. This plan and the mock (`docs/billing/`).
- [x] 2. `subscriptions` and `stripe_events` tables and `member_no_seq`, in migration `0007`.
- [x] 3. Entitlement rules (`entitlement.ts`), store (`store.ts`: `getEntitlement`, `spendFreeRound`, `assignMemberNumber`) and member numbers (`member-number.ts`). Tests cover the round 4 to round 5 boundary, deleting rounds, the double-tap race, failed payments, and each kind of exemption.
- [x] 4. `.env.example` entries for billing, left empty so the secret scan stays green.
- [x] 5. Add the `stripe` dependency, and `src/lib/billing/stripe.ts`: the client, which refuses to run without a key (and refuses a live key outside production), and a pure `subscriptionToRow()` mapper tested against fixture objects.
- [x] 6. Webhook route, the middleware allowlist, and an idempotency test (the same event twice, and events out of order). Checked on a local server: a missing or forged signature gets 400, a signed event is applied once and the repeat is skipped.
- [ ] 7. Claim: `POST /api/billing/checkout` (**built**; its parameters were checked in the Stripe sandbox: a claim opens at €0.00 today, a rejoin at €12.99), the Member's card gate on `/rounds/new`, and the `/billing/welcome` return page.
- [ ] 8. Enforce: `POST /api/rounds` returns 402 with the gate unless the player is allowed, and counts the free round in the insert transaction.
- [ ] 9. Start membership: `POST /api/billing/start-membership` and its gate screen, including the decline and 3-D Secure paths.
- [ ] 10. `/account`: member number, status, next charge date, free rounds left, and the portal link.
- [ ] 11. The ticket strip on the new-round form, and the "free rounds played" last slide on the round-four recap.
- [ ] 12. Copy: the landing pricing card, the handover pricing line, and #53's rules. Add a billing section to the README.
- [ ] 13. Test-mode run-through with the Stripe CLI (`stripe listen`), and screenshots in the PR. Then CHANGELOG and a release.

**Done when**, in test mode:
- a new player adds a card and is charged nothing;
- they log four rounds free, and deleting one doesn't give it back;
- round five asks them to start the membership;
- a €12.99 test charge unlocks round five straight away, and the webhook agrees within one delivery;
- a failed renewal blocks new rounds until the card is updated;
- cancelling in the portal keeps access until the period ends, then re-locks;
- a second account with the same test card gets no free rounds;
- Conor's personal account never sees a paywall.

## 5. Decisions

| # | Decision | Outcome |
|---|---|---|
| D1 | Card up front, against the handover's "no card" | **Card up front.** |
| D2 | Free allowance and trial clock | **4 free rounds**, counted when started and never given back. The trial is open-ended (730 days), so only round five charges. May change later: edit `FREE_ROUNDS`. |
| D3 | Players already using the app | **Exempt for now**, via `BILLING_EXEMPT_JOINED_BEFORE` set to the go-live date. |
| D4 | Failed payments | **No new rounds** until the card is updated, including while Stripe retries. |
| D5 | Member numbers, and *Founding member* on cards 1 to 100 | **Yes.** |
| D6 | Terms of service and privacy pages, needed for Checkout consent and the EU 14-day withdrawal waiver on digital services | Open. Needed before live mode. |
| D7 | VAT (EU consumers owe VAT where they live, under OSS) | **Off for now** (Checkout Studio: `automatic_tax` off). Before live: €12.99 **including** VAT, with Stripe Tax on. |
| D8 | Conor's personal account | **Free for good**, in code. |

## 6. Risks

- **3-D Secure on round five.** Most EU cards will ask for it on the first real charge. The hosted invoice page handles it. The gate must survive the round trip, with the return URL back to `/rounds/new`.
- **Deleted accounts.** `subscriptions` rows are deleted with the user, but the Stripe subscription isn't. Cancel it in the account-deletion path. There isn't one yet; add it when there is.
- **Invites stay.** Billing doesn't replace the invite gate. Sign-up stays invite-only until the landing page (#52) opens it.
- **Price changes.** `price_id` is stored per row, so a later annual plan or price rise can be read per player.
