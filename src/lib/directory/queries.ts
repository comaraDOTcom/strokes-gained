import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { courses, playedCourses, rounds } from '../../db/schema';
import { directoryCourse } from './index';

/** Ticked-off keys, and every round on a directory-linked course, for one player. */
export async function loadPlayedInputs(userId: string) {
  const [ticked, roundCourses] = await Promise.all([
    db.select({ key: playedCourses.courseKey }).from(playedCourses).where(eq(playedCourses.userId, userId)),
    db
      .select({ directoryKey: courses.directoryKey, playedOn: rounds.playedOn })
      .from(rounds)
      .innerJoin(courses, eq(courses.id, rounds.courseId))
      .where(and(eq(rounds.userId, userId), isNotNull(courses.directoryKey))),
  ]);
  return {
    tickedKeys: ticked.map((t) => t.key),
    roundCourses: roundCourses.map((r) => ({ directoryKey: r.directoryKey!, playedOn: r.playedOn })),
  };
}

export type PlayedToggle = { ok: true; key: string; played: boolean } | { ok: false; error: string };

/** Validate `{ key, played }` from the client. The key must be in the directory. */
export function parsePlayedToggle(body: unknown): PlayedToggle {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object' };
  const { key, played } = body as Record<string, unknown>;
  if (typeof key !== 'string' || !directoryCourse(key)) return { ok: false, error: 'Unknown course' };
  if (typeof played !== 'boolean') return { ok: false, error: 'played must be true or false' };
  return { ok: true, key, played };
}

/** Tick a course off (idempotent) or un-tick it. */
export async function setPlayed(userId: string, key: string, played: boolean): Promise<void> {
  if (played) {
    await db.insert(playedCourses).values({ userId, courseKey: key }).onConflictDoNothing();
  } else {
    await db.delete(playedCourses).where(and(eq(playedCourses.userId, userId), eq(playedCourses.courseKey, key)));
  }
}
