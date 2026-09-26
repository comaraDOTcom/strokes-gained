/**
 * Who may start a new round (issue #53's rules, reshaped by #54's card-first free rounds).
 * Pure: no DB, no Stripe. `store.ts` loads the inputs; pages and routes act on the answer and never
 * count rounds or read subscription statuses themselves.
 *
 * The model (docs/billing/plan.md):
 *   1. A player puts a card on file. Stripe holds it as a `trialing` subscription; nothing is charged.
 *   2. Their first FREE_ROUNDS rounds are free. Each one started bumps `freeRoundsUsed`, which never
 *      goes down, so deleting rounds doesn't earn free rounds back.
 *   3. Starting the next round ends the trial: €7 is taken and the subscription goes `active`.
 * Viewing is never gated: every round a player logged stays readable whatever their status.
 */
import { createHash } from 'node:crypto';

/**
 * How many rounds a new player logs before paying. The one number to change: the counter and the
 * gates all read it. (Signing players up and hearing from them matters more than revenue right now.)
 */
export const FREE_ROUNDS = 4;

export type SubscriptionFacts = {
  /** Stripe's subscription status verbatim; null = Checkout started but not finished. */
  status: string | null;
  freeRoundsUsed: number;
  cancelAtPeriodEnd?: boolean;
};

/** Why a new round is allowed. */
export type Allow =
  | { canCreateRound: true; reason: 'billing-off' } // BILLING_ENABLED unset: everyone plays, as before billing
  | { canCreateRound: true; reason: 'exempt' } // see isBillingExempt
  | { canCreateRound: true; reason: 'free-round'; freeRoundsLeft: number } // includes this one
  | { canCreateRound: true; reason: 'member'; endsAtPeriodEnd: boolean };

/** Which screen to show instead of the new-round form. */
export type Gate =
  | 'claim-free-rounds' // no card yet: the Member's card, "Four rounds on the house"
  | 'start-membership' // free rounds played: confirm €7 to start the next one
  | 'fix-payment' // a renewal failed: no new rounds until the card is updated in the portal
  | 'rejoin'; // cancelled (or lapsed) after the free rounds: back to Checkout, no trial

export type Entitlement = Allow | { canCreateRound: false; gate: Gate };

export function decideEntitlement(input: {
  billingEnabled: boolean;
  exempt: boolean;
  sub: SubscriptionFacts | null;
}): Entitlement {
  if (!input.billingEnabled) return { canCreateRound: true, reason: 'billing-off' };
  if (input.exempt) return { canCreateRound: true, reason: 'exempt' };

  const sub = input.sub;
  const freeRoundsLeft = Math.max(0, FREE_ROUNDS - (sub?.freeRoundsUsed ?? 0));

  switch (sub?.status) {
    case 'active':
      return { canCreateRound: true, reason: 'member', endsAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd) };
    case 'past_due':
    case 'unpaid':
      // A failed payment stops new rounds straight away, even while Stripe retries the card.
      return { canCreateRound: false, gate: 'fix-payment' };
    case 'trialing':
      return freeRoundsLeft > 0
        ? { canCreateRound: true, reason: 'free-round', freeRoundsLeft }
        : { canCreateRound: false, gate: 'start-membership' };
    default:
      // No row, Checkout abandoned (null / incomplete / incomplete_expired), cancelled, paused, or a
      // status we don't know. Free rounds already used are never handed out again.
      return { canCreateRound: false, gate: freeRoundsLeft > 0 ? 'claim-free-rounds' : 'rejoin' };
  }
}

/**
 * Accounts that never pay, whatever the env says. SHA-256 of the lower-cased email, so the repo
 * (which is public) doesn't publish anyone's address.
 */
export const FREE_FOREVER_SHA256: ReadonlySet<string> = new Set([
  '9103c735af36593bc387b390d5ab2adf9bb8ebc7ae2b500ba62ff6e05a5bde00', // Conor's personal account
]);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type BillingEnv = Record<string, string | undefined>;

/**
 * Does this player skip billing?
 *  - the admin (ADMIN_EMAIL, verified), and the free-forever accounts above;
 *  - anyone on BILLING_EXEMPT_EMAILS (comma-separated): testers, club pros;
 *  - anyone whose account was created before BILLING_EXEMPT_JOINED_BEFORE (an ISO date): the
 *    players already using the app when billing goes live. Unset it to end that.
 */
export function isBillingExempt(
  viewer: { email: string; isAdmin: boolean; createdAt: Date | null },
  env: BillingEnv,
  freeForever: ReadonlySet<string> = FREE_FOREVER_SHA256,
): boolean {
  if (viewer.isAdmin) return true;
  const email = viewer.email.trim().toLowerCase();
  if (email === '') return false;
  if (freeForever.has(sha256(email))) return true;
  const listed = (env.BILLING_EXEMPT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email);
  if (listed) return true;
  const cutoff = parseCutoff(env.BILLING_EXEMPT_JOINED_BEFORE);
  return cutoff !== null && viewer.createdAt !== null && viewer.createdAt < cutoff;
}

/** An ISO date (or date-time) from the env, or null when unset or unreadable. */
export function parseCutoff(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `BILLING_ENABLED=1` turns the paywall on. Anything else leaves it off, so the code can ship dark. */
export function isBillingEnabled(flag: string | undefined): boolean {
  return flag === '1' || flag === 'true';
}
