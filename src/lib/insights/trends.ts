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
import {
  categorySeries,
  latestVsPriorMean,
  puttingBandStats,
  shortGameBandStats,
  bunkerStats,
  approachBandStats,
  type EnrichedShot,
} from './aggregate';

// ---------------------------------------------------------------------------
// Trend + signal strength
// ---------------------------------------------------------------------------

export type SignalStrength = 'signal' | 'limited' | 'noise';

/**
 * A practical heuristic, not a rigorous statistical test (BUILD.md asks for
 * "a signal-strength indicator from shot count and variance", not a named
 * procedure). Converts the round-level latest-vs-prior delta into a
 * per-shot rate delta, estimates its standard error from the observed
 * per-shot SG variance in the prior window, and buckets the resulting
 * z-like score — gated by minimum shot counts so a handful of shots can
 * never be labelled anything but noise, regardless of how large the swing
 * looks. This is exactly the failure mode BUILD.md calls out: "a 0.3-stroke
 * move on 6 [bunker] shots must be labelled noise, not improvement."
 */
export function classifySignalStrength(
  latestSg: number,
  latestShotCount: number,
  priorShots: number[], // individual per-shot SG values from the prior window, pooled
): SignalStrength {
  const priorCount = priorShots.length;
  if (latestShotCount < 5 || priorCount < 5) return 'noise';

  const priorMean = priorShots.reduce((a, b) => a + b, 0) / priorCount;
  const variance = priorShots.reduce((a, b) => a + (b - priorMean) ** 2, 0) / Math.max(1, priorCount - 1);
  const stdev = Math.sqrt(variance);

  if (stdev === 0) return latestShotCount >= 10 && priorCount >= 10 ? 'signal' : 'limited';

  const latestRate = latestSg / latestShotCount;
  const priorRate = priorMean;
  const se = stdev * Math.sqrt(1 / latestShotCount + 1 / priorCount);
  const z = se > 0 ? Math.abs(latestRate - priorRate) / se : 0;

  if (z >= 2 && latestShotCount >= 10 && priorCount >= 10) return 'signal';
  if (z >= 1 && latestShotCount >= 8 && priorCount >= 8) return 'limited';
  return 'noise';
}

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

function lastNRoundsShots(shots: EnrichedShot[], n: number): EnrichedShot[] {
  const roundIds = [...new Set(shots.map((s) => s.roundId))];
  // roundId ordering follows insertion order from the DB query, which is
  // not guaranteed chronological — resolve via playedOn explicitly.
  const playedOnByRound = new Map<number, string>();
  for (const s of shots) playedOnByRound.set(s.roundId, s.playedOn);
  roundIds.sort((a, b) => playedOnByRound.get(a)!.localeCompare(playedOnByRound.get(b)!) || a - b);
  const lastN = new Set(roundIds.slice(-n));
  return shots.filter((s) => lastN.has(s.roundId));
}

/**
 * Ranked, most-costly-first, over the last `roundWindow` rounds (default
 * 4). Only negative-cumulative-SG buckets are practice priorities — a
 * positive bucket is a strength, not something to drill. Bucketed at the
 * same granularity as the `/insights` drill-downs (putting/short-game
 * bands, bunker subtype, approach bands) plus whole-category buckets for
 * off-the-tee, recovery and penalties, which BUILD.md does not ask to be
 * split into bands.
 */
export function practicePriority(shots: EnrichedShot[], roundWindow = 4): PracticePriorityItem[] {
  const recent = lastNRoundsShots(shots, roundWindow);
  const roundsCovered = new Set(recent.map((s) => s.roundId)).size;
  const items: PracticePriorityItem[] = [];

  for (const b of puttingBandStats(recent)) {
    items.push({ label: `Putting ${b.band}`, sgLost: b.sgTotal, attempts: b.attempts, roundsCovered });
  }
  for (const b of shortGameBandStats(recent)) {
    items.push({ label: `Short game ${b.band}`, sgLost: b.sgTotal, attempts: b.count, roundsCovered });
  }
  for (const b of bunkerStats(recent)) {
    items.push({
      label: `Bunker (${b.subtype === 'greenside' ? 'greenside' : 'fairway'})`,
      sgLost: b.sgTotal,
      attempts: b.count,
      roundsCovered,
    });
  }
  for (const b of approachBandStats(recent)) {
    items.push({ label: `Approach ${b.band}`, sgLost: b.sgTotal, attempts: b.count, roundsCovered });
  }

  const offTee = recent.filter((s) => s.category === 'OFF_THE_TEE');
  if (offTee.length > 0) {
    items.push({
      label: 'Off the tee',
      sgLost: offTee.reduce((a, s) => a + s.sg, 0),
      attempts: offTee.length,
      roundsCovered,
    });
  }

  const recovery = recent.filter((s) => s.category === 'RECOVERY');
  if (recovery.length > 0) {
    items.push({
      label: 'Recovery shots',
      sgLost: recovery.reduce((a, s) => a + s.sg, 0),
      attempts: recovery.length,
      roundsCovered,
    });
  }

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
