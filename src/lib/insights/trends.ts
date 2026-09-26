/**
 * Phase 5 — trends and practice focus (BUILD.md "Phase 5"). Two things are
 * shown, and they are never conflated:
 *
 * - Trend: latest round vs mean of prior 3, per category, tagged with a
 *   signal-strength label so a 0.3-stroke move on 6 bunker shots reads as
 *   noise, not improvement, while the same move on 120 putts reads as real.
 * - Practice priority: ranked by CUMULATIVE SG lost over the last 4 rounds,
 *   drilled down to the specific band — a stable signal worth acting on,
 *   independent of whether the trend happens to be moving right now.
 *
 * Also: `difficultyAdjustment`, the cross-course caveat from BUILD.md's
 * "Cross-course caveat" section — off by default, clearly labelled, and
 * unavailable until Portmarnock has a course rating on file.
 */
import { expectedStrokes } from '../sg/interpolate';
import type { Category } from '../sg/categorise';
import { categorySeries, latestVsPriorMean, type EnrichedShot } from './aggregate';
import { bucketStats, lastNRoundsShots } from './roadmap';

// ---------------------------------------------------------------------------
// Trend + signal strength
// ---------------------------------------------------------------------------

export { classifySignalStrength, type SignalStrength } from './signal';
import { classifySignalStrength, type SignalStrength } from './signal';

export type CategoryTrend = {
  category: Category;
  latestSg: number;
  latestShotCount: number;
  priorMeanSg: number;
  priorRoundCount: number;
  delta: number;
  signal: SignalStrength;
};

/** Per-category latest-vs-prior-3 trend, each tagged with a signal-strength label. */
export function categoryTrends(shots: EnrichedShot[], priorWindow = 3): CategoryTrend[] {
  const series = categorySeries(shots);
  const comparisons = latestVsPriorMean(series, priorWindow);

  // Rounds, oldest-first, per category — needed to isolate exactly the
  // "prior window" rounds' individual shot SG values for variance.
  const roundsByCategory = new Map<Category, number[]>(); // ordered roundIds
  for (const p of series) {
    const list = roundsByCategory.get(p.category) ?? roundsByCategory.set(p.category, []).get(p.category)!;
    if (!list.includes(p.roundId)) list.push(p.roundId);
  }

  return comparisons.map((c) => {
    const roundIds = roundsByCategory.get(c.category) ?? [];
    const priorRoundIds = new Set(roundIds.slice(Math.max(0, roundIds.length - 1 - priorWindow), roundIds.length - 1));
    const priorShotSgs = shots
      .filter((s) => s.category === c.category && priorRoundIds.has(s.roundId))
      .map((s) => s.sg);

    return {
      category: c.category,
      latestSg: c.latestSg,
      latestShotCount: c.latestShotCount,
      priorMeanSg: c.priorMeanSg,
      priorRoundCount: c.priorRoundCount,
      delta: c.delta,
      signal: classifySignalStrength(c.latestSg, c.latestShotCount, priorShotSgs),
    };
  });
}

// ---------------------------------------------------------------------------
// Practice priority — cumulative SG lost over the last 4 rounds, by band
// ---------------------------------------------------------------------------

export type PracticePriorityItem = {
  label: string; // e.g. "Putting 6-10ft"
  sgLost: number; // negative = strokes lost
  attempts: number;
  roundsCovered: number;
};

/**
 * Ranked, most-costly-first, over the last `roundWindow` rounds (default
 * 4). Only negative-cumulative-SG buckets are practice priorities: a
 * positive bucket is a strength, not something to drill. Uses the same
 * buckets as the roadmap (`roadmap.ts`), which supersedes this on `/trends`
 * by adding importance and trend; this stays as the plain "SG lost" view,
 * plus a separate penalty-strokes line. The practice plan on `/practice` (`src/lib/practice/plan.ts`)
 * builds on the same windowing, by part of the game, with drills attached.
 */
export function practicePriority(shots: EnrichedShot[], roundWindow = 4): PracticePriorityItem[] {
  const recent = lastNRoundsShots(shots, roundWindow);
  const roundsCovered = new Set(recent.map((s) => s.roundId)).size;
  const items: PracticePriorityItem[] = bucketStats(recent)
    .filter((b) => b.attempts > 0)
    .map((b) => ({ label: b.label, sgLost: b.sgTotal, attempts: b.attempts, roundsCovered }));

  const penaltyStrokes = recent.reduce((a, s) => a + s.penaltyStrokes, 0);
  if (penaltyStrokes > 0) {
    items.push({ label: 'Penalty strokes', sgLost: -penaltyStrokes, attempts: penaltyStrokes, roundsCovered });
  }

  return items
    .filter((i) => i.sgLost < 0)
    .sort((a, b) => a.sgLost - b.sgLost);
}

// ---------------------------------------------------------------------------
// Cross-course difficulty adjustment — off by default
// ---------------------------------------------------------------------------

export type DifficultyAdjustment = {
  teeId: number;
  /** Strokes per hole to add to raw SG to correct for the length-only
   * baseline understating a harder course. Null when the tee has no
   * course rating on file (e.g. Portmarnock in the current seed). */
  perHoleAdjustment: number | null;
};

/**
 * difficultyAdjustment(teeId) = (courseRating - sum(E(TEE, holeYards))) / 18
 * — BUILD.md, "Cross-course caveat". Positive when the baseline
 * UNDERSTATES the course (predicted rating is lower than the real one,
 * i.e. the course is harder than length alone suggests) — add this many
 * strokes per hole back to raw SG to correct for it.
 */
export function difficultyAdjustment(
  teeId: number,
  courseRating: number | null,
  holeYards: number[],
): DifficultyAdjustment {
  if (courseRating === null || holeYards.length === 0) {
    return { teeId, perHoleAdjustment: null };
  }
  const predicted = holeYards.reduce((sum, y) => sum + expectedStrokes('TEE', y), 0);
  return { teeId, perHoleAdjustment: (courseRating - predicted) / 18 };
}
