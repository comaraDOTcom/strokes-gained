/**
 * The only file in `src/lib/insights` that touches the DB. Reads a user's shots
 * across their rounds, joins in the course/tee/hole context each aggregate
 * function in `aggregate.ts` needs, and converts stored yards to display
 * units (feet on GREEN) — the one conversion point rule from
 * `src/lib/units.ts` applies here too.
 *
 * EVERY function that reads rounds/shots takes a `userId` and reads only that
 * user's rounds. Nothing here returns another user's data unless the caller
 * deliberately passes that user's id (the read-only `/players/[id]` view does,
 * and it strips the private fields itself).
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { rounds, courses, tees, teeHoles, shots as shotsTable, user } from '../../db/schema';
import { yardsToFeet } from '../units';
import type { Lie } from '../sg/baseline-scratch';
import type { Category, BunkerSubtype } from '../sg/categorise';
import type { PenaltyType } from '../sg/compute';
import type { EnrichedShot } from './aggregate';
import type { CourseOption } from './course-filter';
import type { RoundDetails } from '../rounds/details';

/** Name / commentary / mentality per round for one user — kept out of `EnrichedShot`
 * (which is shot-level and SG-only) and joined in by round id where a screen needs it. */
export async function getRoundDetailsById(userId: string): Promise<Map<number, RoundDetails>> {
  const rows = await db.select().from(rounds).where(eq(rounds.userId, userId));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        name: r.name,
        notes: r.notes,
        mentalBalance: r.mentalBalance,
        mentalTempo: r.mentalTempo,
        mentalTension: r.mentalTension,
      },
    ]),
  );
}

/** The courses THIS user has logged at least one round on, with their round count and most
 * recent round — the course filter's options. The course library is shared and grows with every
 * player, so courses you've never played are left out (the filter would otherwise fill up with
 * other people's clubs). Ordered by id so button order is stable. */
export async function getCourseOptions(userId: string): Promise<CourseOption[]> {
  const myRounds = await db.select().from(rounds).where(eq(rounds.userId, userId));
  if (myRounds.length === 0) return [];
  const played = await db
    .select()
    .from(courses)
    .where(inArray(courses.id, [...new Set(myRounds.map((r) => r.courseId))]));
  return played
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const mine = myRounds.filter((r) => r.courseId === c.id);
      const last = mine.reduce<(typeof mine)[number] | null>(
        (best, r) => (!best || r.playedOn > best.playedOn || (r.playedOn === best.playedOn && r.id > best.id) ? r : best),
        null,
      );
      return {
        courseId: c.id,
        name: c.name,
        roundCount: mine.length,
        lastRound: last ? { playedOn: last.playedOn, roundId: last.id } : null,
      };
    });
}

/** One user's shots across their rounds (or just one course's, when `courseId` is
 * given), enriched with course/tee/hole context. */
export async function getAllEnrichedShots(userId: string, courseId?: number): Promise<EnrichedShot[]> {
  const where =
    courseId === undefined ? eq(rounds.userId, userId) : and(eq(rounds.userId, userId), eq(rounds.courseId, courseId));
  const allRounds = await db.select().from(rounds).where(where);
  if (allRounds.length === 0) return [];

  const roundIds = allRounds.map((r) => r.id);
  const courseIds = [...new Set(allRounds.map((r) => r.courseId))];
  const teeIds = [...new Set(allRounds.map((r) => r.teeId))];

  const [courseRows, teeRows, holeRows, allShots] = await Promise.all([
    db.select().from(courses).where(inArray(courses.id, courseIds)),
    db.select().from(tees).where(inArray(tees.id, teeIds)),
    db.select().from(teeHoles).where(inArray(teeHoles.teeId, teeIds)),
    db.select().from(shotsTable).where(inArray(shotsTable.roundId, roundIds)),
  ]);

  const allCourses = new Map(courseRows.map((c) => [c.id, c]));
  const allTees = new Map(teeRows.map((t) => [t.id, t]));
  const holesByTee = new Map<number, Map<number, (typeof holeRows)[number]>>();
  for (const h of holeRows) {
    const m = holesByTee.get(h.teeId) ?? holesByTee.set(h.teeId, new Map()).get(h.teeId)!;
    m.set(h.holeNo, h);
  }
  const shotsByRound = new Map<number, typeof allShots>();
  for (const s of allShots) {
    (shotsByRound.get(s.roundId) ?? shotsByRound.set(s.roundId, []).get(s.roundId)!).push(s);
  }

  const out: EnrichedShot[] = [];
  for (const round of allRounds) {
    const course = allCourses.get(round.courseId);
    const tee = allTees.get(round.teeId);
    const holeMap = holesByTee.get(round.teeId);
    const roundShots = shotsByRound.get(round.id) ?? [];

    for (const s of roundShots) {
      // A shot with no sg yet (mid-mutation, or a hole that was deleted out
      // from under it) is dropped rather than silently counted as 0 — a
      // dashboard number must never look right by accident.
      if (s.sg === null || s.category === null) continue;
      const hole = holeMap?.get(s.holeNo);
      if (!hole) continue;

      const startLie = s.startLie as Lie;
      const endLie = s.endLie as Lie | null;

      out.push({
        roundId: round.id,
        playedOn: round.playedOn,
        courseId: round.courseId,
        courseName: course?.name ?? 'Unknown course',
        teeId: round.teeId,
        teeName: tee?.name ?? 'Unknown tee',
        holeNo: s.holeNo,
        par: hole.par,
        shotNo: s.shotNo,
        startLie,
        startDistance: startLie === 'GREEN' ? yardsToFeet(s.startYards) : s.startYards,
        endLie,
        endDistance: endLie === 'GREEN' ? yardsToFeet(s.endYards) : s.endYards,
        holed: s.holed,
        penaltyStrokes: s.penaltyStrokes,
        penaltyType: s.penaltyType as PenaltyType,
        sg: s.sg,
        category: s.category as Category,
        bunkerSubtype: s.bunkerSubtype as BunkerSubtype | null,
      });
    }
  }

  return out;
}

/** Only shots belonging to *finished* holes (last shot holed) — used wherever a
 * partial in-progress hole would otherwise skew an aggregate (e.g. counting
 * a GIR miss before the hole is actually over). */
export async function getFinishedHoleEnrichedShots(userId: string): Promise<EnrichedShot[]> {
  const all = await getAllEnrichedShots(userId);
  const finishedKey = new Set<string>();
  const byHole = new Map<string, EnrichedShot[]>();
  for (const s of all) {
    const key = `${s.roundId}::${s.holeNo}`;
    (byHole.get(key) ?? byHole.set(key, []).get(key)!).push(s);
  }
  for (const [key, hs] of byHole) {
    if (hs.some((s) => s.holed)) finishedKey.add(key);
  }
  return all.filter((s) => finishedKey.has(`${s.roundId}::${s.holeNo}`));
}

export async function getRoundCount(userId: string): Promise<number> {
  const rows = await db.select({ id: rounds.id }).from(rounds).where(eq(rounds.userId, userId));
  return rows.length;
}

/** Distinct courses this user has at least one round on — used by the
 * cross-course caveat (Phase 5) to warn when a comparison mixes courses. */
export async function getCoursesWithRounds(userId: string): Promise<{ courseId: number; courseName: string }[]> {
  const shots = await getAllEnrichedShots(userId);
  const seen = new Map<number, string>();
  for (const s of shots) seen.set(s.courseId, s.courseName);
  return [...seen.entries()].map(([courseId, courseName]) => ({ courseId, courseName }));
}

/** Tees this user has played, with their course rating (for difficultyAdjustment). */
export async function getTeesWithRounds(
  userId: string,
): Promise<{ teeId: number; teeName: string; courseId: number; courseRating: number | null }[]> {
  const shots = await getAllEnrichedShots(userId);
  const seen = new Map<number, { teeId: number; teeName: string; courseId: number }>();
  for (const s of shots) seen.set(s.teeId, { teeId: s.teeId, teeName: s.teeName, courseId: s.courseId });
  if (seen.size === 0) return [];
  const teeRows = await db
    .select()
    .from(tees)
    .where(inArray(tees.id, [...seen.keys()]));
  const ratingByTee = new Map(teeRows.map((t) => [t.id, t.courseRating]));
  return [...seen.values()].map((t) => ({ ...t, courseRating: ratingByTee.get(t.teeId) ?? null }));
}

/** Tee holes for a given tee, keyed by hole number — used by difficultyAdjustment.
 * Course data is a shared library, so this is not user-scoped. */
export async function getTeeHoleYardages(teeId: number): Promise<{ holeNo: number; yards: number }[]> {
  const rows = await db.select().from(teeHoles).where(eq(teeHoles.teeId, teeId));
  return rows.map((h) => ({ holeNo: h.holeNo, yards: h.yards }));
}

/** Everyone who has joined, with how many rounds they've logged — the players list. */
export async function getPlayers(): Promise<{ userId: string; name: string; roundCount: number }[]> {
  const [users, allRounds] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user),
    db.select({ userId: rounds.userId }).from(rounds),
  ]);
  const counts = new Map<string, number>();
  for (const r of allRounds) if (r.userId) counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
  return users
    .map((u) => ({ userId: u.id, name: u.name, roundCount: counts.get(u.id) ?? 0 }))
    .sort((a, b) => b.roundCount - a.roundCount || a.name.localeCompare(b.name));
}

/** Par and stroke index for every hole of the given tees (course data is a shared library). */
export async function getTeeHoleMeta(
  teeIds: readonly number[],
): Promise<Map<number, { holeNo: number; par: number; strokeIndex: number | null }[]>> {
  const out = new Map<number, { holeNo: number; par: number; strokeIndex: number | null }[]>();
  if (teeIds.length === 0) return out;
  const rows = await db.select().from(teeHoles).where(inArray(teeHoles.teeId, [...new Set(teeIds)]));
  for (const h of rows) {
    (out.get(h.teeId) ?? out.set(h.teeId, []).get(h.teeId)!).push({ holeNo: h.holeNo, par: h.par, strokeIndex: h.strokeIndex });
  }
  for (const list of out.values()) list.sort((a, b) => a.holeNo - b.holeNo);
  return out;
}
