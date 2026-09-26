# Billing plan: the Member's card, a free first round, then €7 a month

For [issue #54](https://github.com/comaraDOTcom/strokes-gained/issues/54) (Stripe subscription), and it
reshapes [issue #53](https://github.com/comaraDOTcom/strokes-gained/issues/53) (free tier).
Status: **planned, groundwork merged-ready (schema, entitlement rules)**, no Stripe calls yet.
Design mock: [`member-card.html`](member-card.html) (open it in a browser).

## 1. What changes from the handover

The handover and #53 say *first round free, no card*. This plan takes the card **up front** and makes
handing it over the reward moment: add a card, and your first round is on the house. Nothing is charged
until the player chooses to start round two.

Why card-first:
- Round two becomes one tap ("Start membership · €7") instead of a cold Checkout form after the hook.
- One free round per **card**, not per Google account (Stripe card fingerprints), so the free round
  can't be farmed with fresh sign-ins.
- A player who hands over a card is a qualified lead; the drop-off moves to before round one, where
  we can see it and tune the copy.

Knock-on edits (listed in the build steps): landing pricing card ("No card needed"), the handover's
pricing line, and #53's rules.

## 2. The player's path (the game)

Clubhouse, not casino: no points, no streaks. Four objects the player can see and one consumable.

| Moment | Where | What they see |
|---|---|---|
| **1. Claim** | `/rounds/new` when the gate is `claim-free-round` (straight after the welcome tour for a new player) | A blank Member's card in forest green with the gold BTM mark, their name, and a perforated ticket on it: **"Round one · on the house"**. One button: **Claim your free round**. Under it: *Nothing is taken today. €7 a month starts only when you tee up round two. Cancel any time.* |
| **2. Card on file** | `/billing/welcome` (Checkout's return URL) | The card "embosses": name, **Member No. 0042**, *Member since September 2026*. The ticket gets a gold **FREE ROUND** stamp. Button: **Tee off** to the new-round form. |
| **3. Free round played** | Last slide of the round-one recap | The ticket is punched: **PLAYED**. The hook, in one line from the recap: *"Your costliest area was approach: −2.4. Round two tells you whether that was a one-off."* Button: **Keep the card active**. |
| **4. Start membership** | `/rounds/new` when the gate is `start-membership` | The card with a punched ticket. **Start membership · €7 today, then monthly**. On success the card gains a gold rule and **Player**, then the new-round form opens. |

Other gates reuse the same card with a different line: `fix-payment` (*"Your card was declined. Update it
and you're back on the tee."*) and `rejoin` (*"Your membership ended on 3 October. Your rounds are all
still here."*).

**Member numbers.** Allocated in order at step 2. Numbers 1–100 print *Founding member* on the card. It's
cheap scarcity that suits "one club at a time". Needs one extra column; see decision D5.

**Copy rules** (handover): dry clubhouse voice, never "leak", "win the club championship" stays on the
landing page only.

## 3. How it maps onto Stripe

**The trial is the free round.** Checkout puts the card on file as a `trialing` subscription to the €7
Player price. Nothing is charged. When the player starts round two, we end the trial ourselves.

| Step | Stripe call | Notes |
|---|---|---|
| Claim | `checkout.sessions.create` | `mode: 'subscription'`, the Player price, `subscription_data.trial_period_days` (D2), `payment_method_collection: 'always'`, `trial_settings.end_behavior.missing_payment_method: 'cancel'`, `client_reference_id: userId`, reused `customer`, `consent_collection.terms_of_service: 'required'` (needs a terms page, D6), `custom_text.submit`: the "nothing today" line. A `rejoin` gets the same session **without** a trial. |
| Card on file | webhook `checkout.session.completed` | Link customer and subscription to the user; read the card fingerprint; if that fingerprint already spent a free round on another account, set `free_round_used_at` now. |
| Round one | none | `POST /api/rounds` spends the free round in the same transaction as the insert (`spendFreeRound`, conditional update, so two taps can't both be free). |
| Start membership | `subscriptions.update(id, { trial_end: 'now', payment_behavior: 'pending_if_incomplete', proration_behavior: 'none' })` | Charges €7 now. If the charge fails nothing changes (still `trialing`) and we show the decline. If 3-D Secure is needed, send them to `latest_invoice.hosted_invoice_url`. On success write `active` from the response straight away, so round two unlocks without waiting for the webhook; the webhook then confirms it. Verify `pending_if_incomplete` accepts `trial_end` in test mode first. |
| Manage | `billingPortal.sessions.create` from `/account` | Portal config: update card, cancel **at period end**, no plan switching yet. |
| Keep in sync | webhook `customer.subscription.created/updated/deleted`, `invoice.payment_failed` | On every event, **re-fetch the subscription** and write its current state, so retried or out-of-order events can't regress it. |

**Webhook route** `src/app/api/billing/webhook/route.ts`: raw body (`await req.text()`),
`stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`, then in one transaction insert the event id
into `stripe_events` (`on conflict do nothing`; already there means skip) and apply the change. A failure
rolls both back and Stripe retries. The route must be added to `PUBLIC` in `src/middleware.ts` (Stripe has
no session cookie). `current_period_end` lives on the subscription **item** in current API versions.

**Entitlement** (`src/lib/billing/entitlement.ts`, done): pages and routes ask `getEntitlement(viewer)` and
act on `{ canCreateRound, reason | gate }`. They never count rounds or read Stripe statuses themselves.

| Subscription | Free round | New round? |
|---|---|---|
| billing off (`BILLING_ENABLED` unset) | any | yes (`billing-off`) |
| admin, or on `BILLING_EXEMPT_EMAILS` | any | yes (`exempt`) |
| none, abandoned Checkout, cancelled in trial | unused | no, `claim-free-round` |
| `trialing` | unused | **yes, `free-round`** |
| `trialing` | used | no, `start-membership` |
| `active` (incl. cancelling at period end) | used | yes (`member`, warns if ending) |
| `past_due` (Stripe still retrying) | used | yes, with a "card failing" warning |
| `unpaid` | used | no, `fix-payment` |
| `canceled`, `paused`, unknown | used | no, `rejoin` |

Viewing is never gated. A lapsed player can open every round they logged. Friends' read-only views follow
the viewer's entitlement (#53).

## 4. Build steps

Each step is a commit on this PR's branch; tests run against PGlite as usual.

- [x] 1. This plan and the mock (`docs/billing/`).
- [x] 2. `subscriptions` and `stripe_events` tables, migration `0007`.
- [x] 3. Entitlement rules (`entitlement.ts`, pure) and store (`store.ts`: `getEntitlement`, `spendFreeRound`), tested including the round-one/round-two boundary and the double-tap race.
- [x] 4. `.env.example`: `BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PLAYER`, `BILLING_EXEMPT_EMAILS` (empty values; the secret scan stays green).
- [ ] 5. `stripe` dependency; `src/lib/billing/stripe.ts` (client, fails closed without a key) and a pure `subscriptionToRow()` mapper tested against fixture objects.
- [ ] 6. Webhook route, middleware allowlist, idempotency test (same event twice, events out of order).
- [ ] 7. Claim: `POST /api/billing/checkout`, the Member's card gate on `/rounds/new`, `/billing/welcome` return page.
- [ ] 8. Enforce: `POST /api/rounds` returns 402 with the gate unless allowed; spends the free round in the insert transaction.
- [ ] 9. Start membership: `POST /api/billing/start-membership` and its gate screen, including decline and 3-D Secure paths.
- [ ] 10. `/account`: status, next charge date, free-round state, portal link.
- [ ] 11. Recap: the "free round played" last slide.
- [ ] 12. Copy: landing pricing card, handover pricing line, #53 rules; README billing section.
- [ ] 13. Test-mode run-through (Stripe CLI `stripe listen`), screenshots in the PR, then CHANGELOG and a release.

**Done when** (from #54, adjusted): in test mode a new player adds a card and is charged nothing; logs
round one free; is asked to start the membership on round two; a €7 test charge unlocks round two
immediately and the webhook agrees within one delivery; cancelling in the portal keeps access to the
period end and re-locks after it; a second account with the same test card gets no free round.

## 5. Decisions for Conor

| # | Decision | Recommendation |
|---|---|---|
| D1 | Card up front, against the handover's "no card". | Card up front, as asked. Update the landing page and #53 in step 12. |
| D2 | Trial clock. Stripe trials need an end date. Open-ended (730 days, the max) means only round two ever charges. 30 days means a player who logs one round and vanishes is charged on day 30. | **Open-ended.** "First round free" stays literally true; a clock turns it into a 30-day trial and invites chargebacks. |
| D3 | Founding players (everyone invited before billing goes live). | Put them on `BILLING_EXEMPT_EMAILS` for phase 0; decide later whether they stay free. |
| D4 | `past_due`: play on or lock? | Play on with a warning while Stripe retries; lock only at `unpaid`. |
| D5 | Member numbers and *Founding member* on the first 100 cards. | Yes. One more column (`member_no`, identity) in step 7. |
| D6 | Terms of service and privacy pages (Checkout consent, EU 14-day withdrawal waiver for digital services). | Needed before live mode. Short pages; the consent line can go in Checkout's `custom_text`. |
| D7 | VAT. EU consumers owe VAT where they live (OSS). | €7 **inclusive** of VAT, Stripe Tax on. Needs the Irish VAT registration details in Stripe. |

## 6. Risks

- **3-D Secure on round two.** Most EU cards will challenge the first real charge. The hosted invoice page handles it; the gate must survive the round trip (return URL back to `/rounds/new`).
- **Deleted accounts.** `subscriptions` cascades with the user, but the Stripe subscription doesn't. Cancel it in the account-deletion path (there isn't one yet; note it when there is).
- **Invites stay.** Billing does not replace the invite gate; sign-up is still invite-only until the landing page (#52) opens it.
- **Price changes.** Store `price_id` per row so a later annual plan or price rise can be read per player.
