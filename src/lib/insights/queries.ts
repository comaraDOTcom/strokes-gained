/**
 * The only file in `src/lib/insights` that touches the DB. Reads every shot
 * across every round, joins in the course/tee/hole context each aggregate
 * function in `aggregate.ts` needs, and converts stored yards to display
 * units (feet on GREEN) — the one conversion point rule from
 * `src/lib/units.ts` applies here too.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { rounds, courses, tees, teeHoles, shots as shotsTable } from '../../db/schema';
import { yardsToFeet } from '../units';
import type { Lie } from '../sg/baseline-scratch';
import type { Category, BunkerSubtype } from '../sg/categorise';
import type { PenaltyType } from '../sg/compute';
import type { EnrichedShot } from './aggregate';
import type { CourseOption } from './course-filter';
import type { RoundDetails } from '../rounds/details';

/** Name / commentary / mentality per round — kept out of `EnrichedShot` (which is
 * shot-level and SG-only) and joined in by round id where a screen needs it. */
export function getRoundDetailsById(): Map<number, RoundDetails> {
  return new Map(
    db
      .select()
      .from(rounds)
      .all()
      .map((r) => [
        r.id,
        {
          name: r.name,
          notes: r.notes,
          mentalConfidence: r.mentalConfidence,
          mentalFocus: r.mentalFocus,
          mentalComposure: r.mentalComposure,
        },
      ]),
  );
}

/** Every course (including ones with no rounds yet) with its round count and
 * most recent round — the course filter's options. Ordered by course id so the
 * button order is stable regardless of which course was played last. */
export function getCourseOptions(): CourseOption[] {
  const allRounds = db.select().from(rounds).all();
  return db
    .select()
    .from(courses)
    .all()
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const mine = allRounds.filter((r) => r.courseId === c.id);
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

/** Shots across all rounds (or just one course's, when `courseId` is given),
 * enriched with course/tee/hole context. */
export function getAllEnrichedShots(courseId?: number): EnrichedShot[] {
  const allRounds = (
    courseId === undefined
      ? db.select().from(rounds)
      : db.select().from(rounds).where(eq(rounds.courseId, courseId))
  ).all();
  if (allRounds.length === 0) return [];

  const allCourses = new Map(db.select().from(courses).all().map((c) => [c.id, c]));
  const allTees = new Map(db.select().from(tees).all().map((t) => [t.id, t]));
  const allHoles = db.select().from(teeHoles).all();
  const holesByTee = new Map<number, Map<number, (typeof allHoles)[number]>>();
  for (const h of allHoles) {
    const m = holesByTee.get(h.teeId) ?? holesByTee.set(h.teeId, new Map()).get(h.teeId)!;
    m.set(h.holeNo, h);
  }

  const allShots = db.select().from(shotsTable).all();
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
export function getFinishedHoleEnrichedShots(): EnrichedShot[] {
  const all = getAllEnrichedShots();
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

export function getRoundCount(): number {
  return db.select().from(rounds).all().length;
}

/** Distinct courses that have at least one round logged — used by the
 * cross-course caveat (Phase 5) to warn when a comparison mixes courses. */
export function getCoursesWithRounds(): { courseId: number; courseName: string }[] {
  const shots = getAllEnrichedShots();
  const seen = new Map<number, string>();
  for (const s of shots) seen.set(s.courseId, s.courseName);
  return [...seen.entries()].map(([courseId, courseName]) => ({ courseId, courseName }));
}

/** Tees referenced by at least one round, with their course rating (for difficultyAdjustment). */
export function getTeesWithRounds(): { teeId: number; teeName: string; courseId: number; courseRating: number | null }[] {
  const shots = getAllEnrichedShots();
  const seen = new Map<number, { teeId: number; teeName: string; courseId: number }>();
  for (const s of shots) seen.set(s.teeId, { teeId: s.teeId, teeName: s.teeName, courseId: s.courseId });
  const teeRows = db.select().from(tees).all();
  const ratingByTee = new Map(teeRows.map((t) => [t.id, t.courseRating]));
  return [...seen.values()].map((t) => ({ ...t, courseRating: ratingByTee.get(t.teeId) ?? null }));
}

/** Tee holes for a given tee, keyed by hole number — used by difficultyAdjustment. */
export function getTeeHoleYardages(teeId: number): { holeNo: number; yards: number }[] {
  return db
    .select()
    .from(teeHoles)
    .where(eq(teeHoles.teeId, teeId))
    .all()
    .map((h) => ({ holeNo: h.holeNo, yards: h.yards }));
}
