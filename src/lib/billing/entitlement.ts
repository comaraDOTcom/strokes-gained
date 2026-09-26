/**
 * Who may start a new round (issue #53 rules, reshaped by #54's card-first free round).
 * Pure: no DB, no Stripe, no env. `store.ts` loads the inputs; pages and routes act on the answer
 * and never count rounds or read subscription status themselves.
 *
 * The model (docs/billing/plan.md):
 *   1. A player puts a card on file. Stripe holds it as a `trialing` subscription; nothing is charged.
 *   2. Their first round is free. Starting it spends the free round (`freeRoundUsedAt`).
 *   3. Starting round two ends the trial: €7 is taken and the subscription goes `active`.
 * Viewing is never gated: every round a player logged stays readable whatever their status.
 */

/** Stripe's subscription statuses, stored verbatim. Anything else is treated as "no subscription". */
export type StripeStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export type SubscriptionFacts = {
  status: string | null;
  freeRoundUsedAt: Date | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
};

/** Why a new round is allowed. */
export type AllowReason =
  | 'billing-off' // BILLING_ENABLED is not set: everyone plays, as before billing existed
  | 'exempt' // the admin, testers, founding members (BILLING_EXEMPT_EMAILS)
  | 'free-round' // card on file, free round not yet spent; starting this round spends it
  | 'member'; // an active Player subscription

/** Which screen to show instead of the new-round form. */
export type Gate =
  | 'claim-free-round' // no card yet: the Member's card, "Round one is on the house"
  | 'start-membership' // free round played: confirm €7 to start round two
  | 'fix-payment' // Stripe gave up collecting: update the card in the customer portal
  | 'rejoin'; // cancelled (or never paid) after the free round: back to Checkout, no trial

export type Entitlement =
  | { canCreateRound: true; reason: AllowReason; warning?: 'payment-failing' | 'ends-at-period-end' }
  | { canCreateRound: false; gate: Gate };

export function decideEntitlement(input: {
  billingEnabled: boolean;
  exempt: boolean;
  sub: SubscriptionFacts | null;
}): Entitlement {
  if (!input.billingEnabled) return { canCreateRound: true, reason: 'billing-off' };
  if (input.exempt) return { canCreateRound: true, reason: 'exempt' };

  const sub = input.sub;
  const freeRoundLeft = !sub?.freeRoundUsedAt;

  switch (sub?.status) {
    case 'active':
      return sub.cancelAtPeriodEnd
        ? { canCreateRound: true, reason: 'member', warning: 'ends-at-period-end' }
        : { canCreateRound: true, reason: 'member' };
    case 'past_due':
      // Stripe is still retrying the card. Don't lock a player out on the first tee over it;
      // let them play and nag them to update the card.
      return { canCreateRound: true, reason: 'member', warning: 'payment-failing' };
    case 'unpaid':
      return { canCreateRound: false, gate: 'fix-payment' };
    case 'trialing':
      return freeRoundLeft
        ? { canCreateRound: true, reason: 'free-round' }
        : { canCreateRound: false, gate: 'start-membership' };
    default:
      // No row, checkout abandoned (null / incomplete / incomplete_expired), cancelled, paused,
      // or a status we don't know. A spent free round is never handed out twice.
      return { canCreateRound: false, gate: freeRoundLeft ? 'claim-free-round' : 'rejoin' };
  }
}

/**
 * Is `email` on the billing-exempt list (comma-separated, case-insensitive)? The admin is exempt
 * separately, by `SessionUser.isAdmin`, so a missing list never locks the admin out.
 */
export function isBillingExempt(email: string | null | undefined, list: string | null | undefined): boolean {
  if (!email || !list) return false;
  const target = email.trim().toLowerCase();
  return list
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .some((e) => e !== '' && e === target);
}

/** `BILLING_ENABLED=1` turns the paywall on. Anything else leaves it off, so the code can ship dark. */
export function isBillingEnabled(flag: string | null | undefined): boolean {
  return flag === '1' || flag === 'true';
}
