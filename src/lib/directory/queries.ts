import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { courses, playedCourses, rounds } from '../../db/schema';
import { directoryCourse, keysFor, resolveKey } from './index';

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
  // Stored keys may predate a re-key in OSM; report them under the current key.
  return {
    tickedKeys: [...new Set(ticked.map((t) => resolveKey(t.key)))],
    roundCourses: roundCourses.map((r) => ({ directoryKey: resolveKey(r.directoryKey!), playedOn: r.playedOn })),
  };
}

export type PlayedToggle = { ok: true; key: string; played: boolean } | { ok: false; error: string };

/** Validate `{ key, played }` from the client. The key must be in the directory. */
export function parsePlayedToggle(body: unknown): PlayedToggle {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object' };
  const { key, played } = body as Record<string, unknown>;
  const course = typeof key === 'string' ? directoryCourse(key) : undefined;
  if (!course) return { ok: false, error: 'Unknown course' };
  if (typeof played !== 'boolean') return { ok: false, error: 'played must be true or false' };
  return { ok: true, key: course.key, played };
}

/** Tick a course off (idempotent) or un-tick it — including a tick stored under an old, aliased key. */
export async function setPlayed(userId: string, key: string, played: boolean): Promise<void> {
  if (played) {
    await db.insert(playedCourses).values({ userId, courseKey: key }).onConflictDoNothing();
  } else {
    await db
      .delete(playedCourses)
      .where(and(eq(playedCourses.userId, userId), inArray(playedCourses.courseKey, keysFor(key))));
  }
}
