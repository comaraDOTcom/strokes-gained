import { isNull } from 'drizzle-orm';
import { db, type DbOrTx } from '../../db/client';
import { rounds } from '../../db/schema';

/**
 * Rounds imported from the single-user SQLite era have no owner (`user_id` is
 * null). When the admin signs in for the first time they inherit all of them.
 * Idempotent; returns how many rounds were claimed.
 */
export async function claimLegacyData(userId: string, conn: DbOrTx = db): Promise<number> {
  const claimed = await conn.update(rounds).set({ userId }).where(isNull(rounds.userId)).returning({ id: rounds.id });
  return claimed.length;
}
