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
import { canEditRound, canEditCourse } from './permissions';

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

/** Any signed-in user may LOOK at any claimed round (read-only). 404 if it doesn't exist. */
export async function getRoundForViewer(roundId: number, viewer: SessionUser): Promise<{ round: Round; isOwner: boolean }> {
  const [round] = await db.select().from(rounds).where(eq(rounds.id, roundId));
  if (!round) throw new HttpError(404, 'Round not found');
  // An unclaimed legacy round (no owner yet) belongs to the admin-to-be: hide it from everyone else
  // rather than exposing it read-only in the window before the admin's first sign-in.
  if (round.userId === null && !viewer.isAdmin) throw new HttpError(404, 'Round not found');
  return { round, isOwner: canEditRound(viewer, round) };
}

/** The round, only if `viewer` may change it: 404 if missing, 403 if it isn't theirs. */
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
