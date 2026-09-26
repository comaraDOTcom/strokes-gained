/**
 * Billing reads and writes against our own `subscriptions` cache (never Stripe's API), so a page
 * can decide entitlement in one indexed lookup. Rules live in ./entitlement.ts.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db, type DbOrTx } from '../../db/client';
import { subscriptions } from '../../db/schema';
import { decideEntitlement, isBillingEnabled, isBillingExempt, type Entitlement } from './entitlement';

type Viewer = { id: string; email: string; isAdmin: boolean };
type BillingEnv = Record<string, string | undefined>; // reads BILLING_ENABLED, BILLING_EXEMPT_EMAILS

/** May `viewer` start a new round, and if not, which screen do they see? */
export async function getEntitlement(viewer: Viewer, conn: DbOrTx = db, env: BillingEnv = process.env): Promise<Entitlement> {
  const billingEnabled = isBillingEnabled(env.BILLING_ENABLED);
  const exempt = viewer.isAdmin || isBillingExempt(viewer.email, env.BILLING_EXEMPT_EMAILS);
  if (!billingEnabled || exempt) return decideEntitlement({ billingEnabled, exempt, sub: null });

  const [sub] = await conn
    .select({
      status: subscriptions.status,
      freeRoundUsedAt: subscriptions.freeRoundUsedAt,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, viewer.id));
  return decideEntitlement({ billingEnabled, exempt, sub: sub ?? null });
}

/**
 * Spend the free round. Call inside the transaction that inserts the round, only when the
 * entitlement reason was 'free-round'. Only the first caller wins (conditional update), so two
 * concurrent "Start round" taps can't both be free: the loser gets false and must roll back.
 */
export async function spendFreeRound(userId: string, conn: DbOrTx, now = new Date()): Promise<boolean> {
  const spent = await conn
    .update(subscriptions)
    .set({ freeRoundUsedAt: now, updatedAt: now })
    .where(and(eq(subscriptions.userId, userId), isNull(subscriptions.freeRoundUsedAt)))
    .returning({ userId: subscriptions.userId });
  return spent.length === 1;
}
