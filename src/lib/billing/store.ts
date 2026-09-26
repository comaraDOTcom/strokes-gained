/**
 * Billing reads and writes against our own `subscriptions` cache (never Stripe's API), so a page
 * can decide entitlement in one indexed lookup. Rules live in ./entitlement.ts.
 */
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '../../db/client';
import { subscriptions, user } from '../../db/schema';
import { decideEntitlement, FREE_ROUNDS, isBillingEnabled, isBillingExempt, type BillingEnv, type Entitlement } from './entitlement';

type Viewer = { id: string; email: string; isAdmin: boolean };

/** May `viewer` start a new round, and if not, which screen do they see? */
export async function getEntitlement(viewer: Viewer, conn: DbOrTx = db, env: BillingEnv = process.env): Promise<Entitlement> {
  const billingEnabled = isBillingEnabled(env.BILLING_ENABLED);
  if (!billingEnabled) return decideEntitlement({ billingEnabled, exempt: false, sub: null });

  const [row] = await conn
    .select({
      createdAt: user.createdAt,
      status: subscriptions.status,
      freeRoundsUsed: subscriptions.freeRoundsUsed,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      hasSub: subscriptions.userId,
    })
    .from(user)
    .leftJoin(subscriptions, eq(subscriptions.userId, user.id))
    .where(eq(user.id, viewer.id));

  const exempt = isBillingExempt({ email: viewer.email, isAdmin: viewer.isAdmin, createdAt: row?.createdAt ?? null }, env);
  const sub =
    row?.hasSub != null
      ? { status: row.status, freeRoundsUsed: row.freeRoundsUsed ?? 0, cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false }
      : null;
  return decideEntitlement({ billingEnabled, exempt, sub });
}

/**
 * Count one free round. Call inside the transaction that inserts the round, only when the
 * entitlement reason was 'free-round'. The conditional update means two concurrent "Start round"
 * taps on the last free round can't both be free: the loser gets false and must roll back.
 * The counter never goes down, so deleting a round doesn't give a free round back.
 */
export async function spendFreeRound(userId: string, conn: DbOrTx, now = new Date()): Promise<boolean> {
  const spent = await conn
    .update(subscriptions)
    .set({ freeRoundsUsed: sql`${subscriptions.freeRoundsUsed} + 1`, updatedAt: now })
    .where(and(eq(subscriptions.userId, userId), lt(subscriptions.freeRoundsUsed, FREE_ROUNDS)))
    .returning({ userId: subscriptions.userId });
  return spent.length === 1;
}

/**
 * The player's member number, allocated from member_no_seq the first time their card goes on file
 * (the webhook calls this on checkout.session.completed). Idempotent: a second call returns the
 * same number. Null when the player has no subscription row.
 */
export async function assignMemberNumber(userId: string, conn: DbOrTx = db): Promise<number | null> {
  const [fresh] = await conn
    .update(subscriptions)
    .set({ memberNo: sql`nextval('member_no_seq')` })
    .where(and(eq(subscriptions.userId, userId), isNull(subscriptions.memberNo)))
    .returning({ memberNo: subscriptions.memberNo });
  if (fresh) return fresh.memberNo;
  const [existing] = await conn.select({ memberNo: subscriptions.memberNo }).from(subscriptions).where(eq(subscriptions.userId, userId));
  return existing?.memberNo ?? null;
}

/**
 * The player's Stripe customer id: the one on their row, or a new customer (and a row with no
 * status yet) the first time. Reused on every later Checkout so a player is one customer in Stripe.
 */
export async function ensureCustomer(
  viewer: { id: string; email: string; name: string },
  createCustomer: (p: { email: string; name: string; metadata: { userId: string } }) => Promise<{ id: string }>,
  conn: DbOrTx = db,
): Promise<string> {
  const existing = await customerIdOf(viewer.id, conn);
  if (existing) return existing;
  const customer = await createCustomer({ email: viewer.email, name: viewer.name, metadata: { userId: viewer.id } });
  // Two taps can both get here; the first row wins and the spare Stripe customer is never used.
  await conn.insert(subscriptions).values({ userId: viewer.id, stripeCustomerId: customer.id }).onConflictDoNothing();
  return (await customerIdOf(viewer.id, conn))!;
}

async function customerIdOf(userId: string, conn: DbOrTx): Promise<string | null> {
  const [row] = await conn.select({ id: subscriptions.stripeCustomerId }).from(subscriptions).where(eq(subscriptions.userId, userId));
  return row?.id ?? null;
}
