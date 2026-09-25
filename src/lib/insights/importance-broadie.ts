/**
 * "Importance to scoring" — how much each part of the game explains the
 * difference in scores between golfers of different skill.
 *
 * This is REFERENCE DATA, isolated in one reviewable file for the same reason
 * `src/lib/sg/baseline-scratch.ts` is: the "What to work on" ranking on
 * `/trends` multiplies every opportunity by these numbers, so a wrong value
 * quietly re-orders the advice.
 *
 * PROVENANCE — read before trusting these numbers
 * -----------------------------------------------
 * Source: Mark Broadie, "Every Shot Counts" (2014). Broadie splits the
 * strokes-gained difference between groups of golfers (e.g. a 90-golfer vs
 * an 80-golfer, or amateurs vs tour pros) into four parts of the game, and
 * finds the long game (driving + approach) explains about two-thirds of it.
 *
 * STATUS: PLACEHOLDER. The shares below are the rounded headline split
 * (driving ~28%, approach ~40%, short game ~17%, putting ~15%), NOT
 * transcribed from a specific table. Until someone fills in `where` and
 * `comparison` from the book and flips `status` to 'transcribed', the Trends
 * page shows a caveat next to the ranking.
 *
 * BROADIE'S CATEGORIES ARE NOT THIS APP'S CATEGORIES
 * --------------------------------------------------
 * Broadie groups shots by where they START, with a 100-yard line:
 *   - Driving     = tee shots on par 4s and 5s
 *   - Approach    = shots from more than 100 yards (incl. par-3 tee shots,
 *                   fairway bunkers and long recovery shots)
 *   - Short game  = shots from 100 yards or less, not on the green
 *                   (incl. greenside bunkers and short recoveries)
 *   - Putting     = shots on the green
 * The app's own categories draw the short-game line at 30 yards and split
 * out bunker and recovery. So the app's "Approach <100y" band carries
 * Broadie's SHORT-GAME weight, not his approach weight. `broadieGroup` in
 * `roadmap.ts` maps each shot to Broadie's group before weighting it.
 */

export type BroadieGroup = 'OFF_THE_TEE' | 'APPROACH' | 'SHORT_GAME' | 'PUTTING';

export const BROADIE_GROUPS: readonly BroadieGroup[] = ['OFF_THE_TEE', 'APPROACH', 'SHORT_GAME', 'PUTTING'];

export const BROADIE_GROUP_LABEL: Record<BroadieGroup, string> = {
  OFF_THE_TEE: 'Driving',
  APPROACH: 'Approach (>100y)',
  SHORT_GAME: 'Short game (≤100y)',
  PUTTING: 'Putting',
};

export type ImportanceTable = {
  source: {
    title: string;
    author: string;
    year: number;
    /** Chapter / table / page the shares were transcribed from. */
    where: string;
    /** Which golfers the split compares, e.g. "90-golfer vs 80-golfer" — the split shifts with the skill gap. */
    comparison: string;
    status: 'placeholder' | 'transcribed';
  };
  /** Share of the scoring difference between skill levels explained by each group. Sums to 1. */
  share: Record<BroadieGroup, number>;
  /**
   * Optional finer split, if the book gives one, keyed by a roadmap bucket key
   * (e.g. 'APPROACH:100-150y'). Each value is that bucket's share of ALL
   * scoring differences. Overrides the share derived from how often you hit
   * that shot. Empty until transcribed.
   */
  bucketShare?: Partial<Record<string, number>>;
};

export const BROADIE_IMPORTANCE: ImportanceTable = {
  source: {
    title: 'Every Shot Counts',
    author: 'Mark Broadie',
    year: 2014,
    where: 'TODO(broadie): chapter / table / page',
    comparison: 'TODO(broadie): which golfers the split compares',
    status: 'placeholder',
  },
  // TODO(broadie): transcribe. Rounded headline figures, long game ≈ 2/3.
  share: { OFF_THE_TEE: 0.28, APPROACH: 0.4, SHORT_GAME: 0.17, PUTTING: 0.15 },
};

/** Problems in plain words; empty when the table is usable. Mirrors `validateBenchmark`. */
export function validateImportance(t: ImportanceTable): string[] {
  const problems: string[] = [];
  if (t.source.status !== 'placeholder' && t.source.status !== 'transcribed') {
    problems.push(`source.status must be 'placeholder' or 'transcribed', got '${String(t.source.status)}'`);
  }
  let total = 0;
  for (const g of BROADIE_GROUPS) {
    const v = t.share[g];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v >= 1) {
      problems.push(`share.${g} must be a number between 0 and 1, got ${String(v)}`);
      continue;
    }
    total += v;
  }
  if (problems.length === 0 && Math.abs(total - 1) > 0.005) {
    problems.push(`shares must add up to 1, they add up to ${total.toFixed(3)}`);
  }
  for (const [key, v] of Object.entries(t.bucketShare ?? {})) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      problems.push(`bucketShare['${key}'] must be between 0 and 1, got ${String(v)}`);
    }
  }
  return problems;
}
