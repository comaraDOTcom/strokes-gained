/**
 * Applying a verified Stripe webhook event to our `subscriptions` cache.
 * The route (src/app/api/billing/webhook/route.ts) verifies the signature and passes the event here.
 *
 * - Idempotent: the event id goes into `stripe_events` in the same transaction as the change, so a
 *   retried delivery is skipped and a failed one rolls back and is retried by Stripe.
 * - Order-proof: the payload is never trusted for state. The subscription is fetched fresh from
 *   Stripe, so an old event arriving late writes today's state, not yesterday's.
 * - One set of free rounds per card: a card that has already used free rounds on another account
 *   brings that count with it.
 */
import { and, eq, max, ne } from 'drizzle-orm';
import { db, type DbOrTx } from '../../db/client';
import { stripeEvents, subscriptions } from '../../db/schema';
import { FREE_ROUNDS } from './entitlement';
import { assignMemberNumber } from './store';
import { subscriptionToRow, userIdOf, type SubscriptionLike } from './stripe';

/** Just the parts of a Stripe event we read. `Stripe.Event` fits this shape. */
export type EventLike = {
  id: string;
  type: string;
  data: { object: { id?: string; object?: string; client_reference_id?: string | null; subscription?: string | { id: string } | null } };
};

export type Deps = {
  /** `stripe.subscriptions.retrieve(id, { expand: ['default_payment_method'] })` in production. */
  fetchSubscription: (id: string) => Promise<SubscriptionLike>;
  conn?: DbOrTx;
};

export type Outcome = 'applied' | 'duplicate' | 'ignored';

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

/** Which subscription (and, from Checkout, which user) an event is about. Null = not ours to handle. */
function subjectOf(event: EventLike): { subscriptionId: string; userId: string | null } | null {
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const sub = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
    return sub ? { subscriptionId: sub, userId: obj.client_reference_id ?? null } : null;
  }
  if (SUBSCRIPTION_EVENTS.has(event.type) && obj.id) return { subscriptionId: obj.id, userId: null };
  return null;
}

export async function applyStripeEvent(event: EventLike, deps: Deps): Promise<Outcome> {
  const conn = deps.conn ?? db;

  // Cheap early exit for a retry, before calling Stripe. The insert below is the real guard.
  const [seen] = await conn.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, event.id));
  if (seen) return 'duplicate';

  const subject = subjectOf(event);
  // Fetch outside the transaction: no DB connection is held open across a network call.
  const sub = subject ? await deps.fetchSubscription(subject.subscriptionId) : null;

  return conn.transaction(async (tx) => {
    const [fresh] = await tx
      .insert(stripeEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: stripeEvents.id });
    if (!fresh) return 'duplicate';
    if (!subject || !sub) return 'ignored';

    const row = subscriptionToRow(sub);
    const userId =
      subject.userId ??
      userIdOf(sub) ??
      (await tx.select({ userId: subscriptions.userId }).from(subscriptions).where(eq(subscriptions.stripeCustomerId, row.stripeCustomerId)))[0]?.userId ??
      null;
    if (!userId) return 'ignored'; // not a subscription this app created

    await tx
      .insert(subscriptions)
      .values({ userId, ...row })
      .onConflictDoUpdate({ target: subscriptions.userId, set: { ...row, updatedAt: new Date() } });

    if (row.cardFingerprint) await carryFreeRoundsForCard(userId, row.cardFingerprint, tx);
    if (event.type === 'checkout.session.completed') await assignMemberNumber(userId, tx);
    return 'applied';
  });
}

/** Give this account the highest free-round count any other account has used on the same card. */
async function carryFreeRoundsForCard(userId: string, fingerprint: string, tx: DbOrTx): Promise<void> {
  const [others] = await tx
    .select({ used: max(subscriptions.freeRoundsUsed) })
    .from(subscriptions)
    .where(and(eq(subscriptions.cardFingerprint, fingerprint), ne(subscriptions.userId, userId)));
  const used = Math.min(FREE_ROUNDS, others?.used ?? 0);
  if (used === 0) return;
  const [mine] = await tx.select({ used: subscriptions.freeRoundsUsed }).from(subscriptions).where(eq(subscriptions.userId, userId));
  if ((mine?.used ?? 0) < used) {
    await tx.update(subscriptions).set({ freeRoundsUsed: used }).where(eq(subscriptions.userId, userId));
  }
}
