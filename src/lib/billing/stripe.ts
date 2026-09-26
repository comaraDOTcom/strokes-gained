/**
 * The Stripe client, and the one place a Stripe subscription is turned into our `subscriptions` row.
 * Everything else reads the row, never Stripe.
 *
 *   STRIPE_SECRET_KEY   sk_test_… everywhere except Vercel Production. A live key is refused
 *                       outside production so a local run can never charge a real card.
 */
import Stripe from 'stripe';

/** Why a key can't be used, or null when it can. */
export function stripeKeyProblem(key: string | undefined, nodeEnv: string | undefined): string | null {
  if (!key) return 'STRIPE_SECRET_KEY is not set';
  if (!/^(sk|rk)_(test|live)_/.test(key)) return 'STRIPE_SECRET_KEY is not a Stripe secret key (sk_… or rk_…)';
  if (/^(sk|rk)_live_/.test(key) && nodeEnv !== 'production') return 'A live Stripe key is refused outside production';
  return null;
}

let client: Stripe | null = null;

/** The Stripe client. Throws (fails closed) when the key is missing or unsafe for this environment. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  const problem = stripeKeyProblem(key, process.env.NODE_ENV);
  if (problem) throw new Error(problem);
  client = new Stripe(key!, { appInfo: { name: 'Better Than Most' } });
  return client;
}

/**
 * The parts of a Stripe subscription we store. `Stripe.Subscription` fits this shape; tests pass plain
 * objects. Fetch with `expand: ['default_payment_method']` to get the card fingerprint.
 */
export type SubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, string> | null;
  items: { data: Array<{ price: { id: string }; current_period_end: number }> };
  default_payment_method: string | { card?: { fingerprint?: string | null } | null } | null;
};

export type SubscriptionRowPatch = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cardFingerprint: string | null;
};

const fromUnix = (s: number | null | undefined) => (typeof s === 'number' ? new Date(s * 1000) : null);

/** Stripe subscription -> our row. Pure. `current_period_end` lives on the item in current API versions. */
export function subscriptionToRow(sub: SubscriptionLike): SubscriptionRowPatch {
  const item = sub.items.data[0];
  const pm = sub.default_payment_method;
  return {
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    priceId: item?.price.id ?? null,
    trialEnd: fromUnix(sub.trial_end),
    currentPeriodEnd: fromUnix(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cardFingerprint: pm && typeof pm !== 'string' ? (pm.card?.fingerprint ?? null) : null,
  };
}

/** Our user id, stamped on the subscription at Checkout (`subscription_data.metadata.userId`). */
export function userIdOf(sub: SubscriptionLike): string | null {
  return sub.metadata?.userId || null;
}
