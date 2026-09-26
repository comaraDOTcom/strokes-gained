/**
 * Authorization for route handlers and pages. Every route/page that takes an id
 * from the URL goes through one of these — no handler trusts a bare primary key.
 *
 * Route handlers: `try { const user = await requireApiUser(); … } catch (e) { return toErrorResponse(e); }`
 */
import { NextResponse } from 'next/server';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { rounds, courses, tees, type Round, type Course, type Tee } from '../../db/schema';
import { getSessionUser, type SessionUser } from './session';
import { canViewRound, canEditRound, canEditCourse } from './permissions';
import { sessionOwner } from '../practice/sessions';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e; // a real bug — let Next surface it as a 500
}

/** For route handlers: the signed-in user, or a 401. */
export async function requireApiUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new HttpError(401, 'Sign in required');
  return u;
}

/** The round, if `viewer` may see it: their own, or any round for the admin (read-only).
 * Anything else is a 404 — not a 403 — so round ids can't be probed for existence. */
export async function getRoundForViewer(roundId: number, viewer: SessionUser): Promise<{ round: Round; isOwner: boolean }> {
  const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId));
  if (!round) throw new HttpError(404, 'Round not found');
  if (!canViewRound(viewer, round)) throw new HttpError(404, 'Round not found');
  return { round, isOwner: canEditRound(viewer, round) };
}

/** The round, only if `viewer` may change it: 404 if missing or not visible to them; 403 for
 * the admin looking at someone else's (they can see it, but not change it). */
export async function requireRoundOwner(roundId: number, viewer: SessionUser): Promise<Round> {
  const { round, isOwner } = await getRoundForViewer(roundId, viewer);
  if (!isOwner) throw new HttpError(403, "You can't change someone else's round");
  return round;
}

/** The tee (and its course), only if `viewer` may edit its holes. */
export async function requireTeeEditor(teeId: number, viewer: SessionUser): Promise<{ tee: Tee; course: Course }> {
  const [tee] = await db.select().from(tees).where(eq(tees.id, teeId));
  if (!tee) throw new HttpError(404, 'Tee not found');
  const [course] = await db.select().from(courses).where(eq(courses.id, tee.courseId));
  if (!course) throw new HttpError(404, 'Course not found');

  const others = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(and(eq(rounds.teeId, teeId), or(isNull(rounds.userId), ne(rounds.userId, viewer.id))))
    .limit(1);

  if (!canEditCourse(viewer, course, others.length > 0)) {
    throw new HttpError(
      403,
      viewer.isAdmin || course.createdByUserId === viewer.id
        ? 'Other players have rounds on this tee, so only the admin can change its holes'
        : 'Only the person who added this course can edit it',
    );
  }
  return { tee, course };
}

/** Can `viewer` edit this tee's holes? Same rule as `requireTeeEditor`, as a boolean for the UI. */
export async function canEditTee(teeId: number, viewer: SessionUser): Promise<boolean> {
  try {
    await requireTeeEditor(teeId, viewer);
    return true;
  } catch (e) {
    if (e instanceof HttpError) return false;
    throw e;
  }
}

/** A practice session id, only if it's `viewer`'s own. Practice logs are private, the admin's
 * included: anything else is a 404, so ids can't be probed. */
export async function requirePracticeSessionOwner(id: number, viewer: SessionUser): Promise<number> {
  // Ids are Postgres `integer`: anything past its maximum would be a database error, not a 404.
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw new HttpError(404, 'Session not found');
  const owner = await sessionOwner(id);
  if (owner === null || owner !== viewer.id) throw new HttpError(404, 'Session not found');
  return id;
}
