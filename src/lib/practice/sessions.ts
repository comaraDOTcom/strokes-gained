/**
 * The practice log (issue #55): store a validated session (`entry.ts`), read a player's sessions
 * back. Sessions are private to the player, like rounds. Pass or fail is decided here from the
 * drill's pass mark, never taken from the client, and the pass mark is stored with the session so
 * changing a drill later doesn't rewrite history.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { practiceSessions } from '../../db/schema';
import { drillById, passes } from './drills';
import type { SessionEntry } from './entry';
import type { SessionRow } from './progress';

const COLUMNS = {
  id: practiceSessions.id,
  practisedOn: practiceSessions.practisedOn,
  drillId: practiceSessions.drillId,
  score: practiceSessions.score,
  outOf: practiceSessions.outOf,
  passMark: practiceSessions.passMark,
  passed: practiceSessions.passed,
};

/** Store a validated session for `userId`, with pass/fail worked out from the drill. */
export async function logSession(userId: string, entry: SessionEntry): Promise<SessionRow> {
  const drill = drillById(entry.drillId);
  if (!drill) throw new Error(`Unknown drill ${entry.drillId}`); // parseSessionEntry already checked
  const [row] = await db
    .insert(practiceSessions)
    .values({
      userId,
      practisedOn: entry.practisedOn,
      drillId: drill.id,
      score: entry.score,
      outOf: drill.outOf,
      passMark: drill.passMark,
      passed: passes(entry.score, drill.passMark),
    })
    .returning(COLUMNS);
  return row!;
}

/** Every session `userId` has logged, oldest first. */
export async function listSessions(userId: string): Promise<SessionRow[]> {
  return db
    .select(COLUMNS)
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, userId))
    .orderBy(asc(practiceSessions.practisedOn), asc(practiceSessions.id));
}

/** Who owns a session, or null if there's no such session. For the guard in `guards.ts`. */
export async function sessionOwner(id: number): Promise<string | null> {
  const [row] = await db.select({ userId: practiceSessions.userId }).from(practiceSessions).where(eq(practiceSessions.id, id));
  return row?.userId ?? null;
}

/** Delete one of `userId`'s sessions. False if it wasn't theirs or didn't exist. */
export async function deleteSession(userId: string, id: number): Promise<boolean> {
  const rows = await db
    .delete(practiceSessions)
    .where(and(eq(practiceSessions.id, id), eq(practiceSessions.userId, userId)))
    .returning({ id: practiceSessions.id });
  return rows.length > 0;
}
