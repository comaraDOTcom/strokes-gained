/**
 * Expected-strokes baseline for a SCRATCH (0-handicap) golfer.
 *
 * E(lie, distance) = expected strokes to hole out from that position.
 * This table is THE foundation of every number in this app. A wrong value here
 * produces output that looks plausible but is wrong, so it is deliberately
 * isolated in one reviewable file.
 *
 * PROVENANCE — read before trusting these numbers
 * -----------------------------------------------
 * Methodology: Mark Broadie, "Every Shot Counts" (2014) — the origin of strokes
 * gained. These anchor points approximate Broadie's published scratch-amateur
 * baseline. They are NOT transcribed from the book to 2dp; they are reconstructed
 * and then calibrated against an external, verifiable anchor (see below).
 *
 * CALIBRATION ANCHOR: a USGA/CONGU course rating is, by definition, the expected
 * score for a scratch golfer. So for any tee:
 *
 *     sum over 18 holes of E(TEE, hole_yards)  ~=  course rating
 *
 * The TEE curve below is calibrated against Elm Park's own card:
 *   Elm Park Blue  6006y par 69, card CR 68.5  ->  table predicts 68.56  (+0.06)
 *   Elm Park White 5745y par 69, card CR 67.7  ->  table predicts 67.48  (-0.22)
 *
 * KNOWN LIMITATION: this is a LENGTH-ONLY model. Course rating also includes
 * obstacle factors (wind, bunkering, green speed, fairway width). For Portmarnock
 * the table predicts ~72.5 off the White tees against a published CR well above
 * that, i.e. the model understates a hard links by several shots. Consequence:
 * raw SG at Portmarnock reads more negative than at Elm Park for the same quality
 * of golf. Do not compare SG across these two courses without the per-tee
 * difficulty adjustment (see difficultyAdjustment in compute.ts).
 *
 * Units: GREEN anchors are in FEET. All other lies are in YARDS.
 */

export type Lie = 'TEE' | 'FAIRWAY' | 'ROUGH' | 'SAND' | 'RECOVERY' | 'GREEN';

/** [distance, expectedStrokes] anchor pairs, ascending by distance. */
export type Anchors = ReadonlyArray<readonly [number, number]>;

/**
 * Tee shots, by hole length in yards. Covers par-3 tee shots at the short end
 * through par-5 tee shots at the long end. Calibrated to course rating.
 */
const TEE: Anchors = [
  [100, 2.80], [120, 2.90], [140, 3.00], [160, 3.08], [180, 3.15],
  [200, 3.23], [220, 3.30], [240, 3.37], [260, 3.45], [280, 3.55],
  [300, 3.67], [320, 3.77], [340, 3.85], [360, 3.93], [380, 4.01],
  [400, 4.09], [420, 4.17], [440, 4.25], [460, 4.33], [480, 4.41],
  [500, 4.50], [520, 4.59], [540, 4.68], [560, 4.77], [580, 4.86],
  [600, 4.95],
];

/** Fairway (and fringe/collar), yards to hole. */
const FAIRWAY: Anchors = [
  [5, 2.15], [10, 2.28], [15, 2.40], [20, 2.50], [30, 2.62],
  [40, 2.70], [50, 2.76], [60, 2.81], [70, 2.85], [80, 2.88],
  [90, 2.91], [100, 2.94], [110, 2.97], [120, 3.00], [130, 3.03],
  [140, 3.07], [150, 3.11], [160, 3.16], [170, 3.21], [180, 3.26],
  [190, 3.32], [200, 3.38], [220, 3.50], [240, 3.62], [260, 3.73],
  [280, 3.83], [300, 3.92],
];

/** Rough, yards to hole. */
const ROUGH: Anchors = [
  [5, 2.35], [10, 2.48], [15, 2.58], [20, 2.66], [30, 2.78],
  [40, 2.86], [50, 2.92], [60, 2.97], [70, 3.01], [80, 3.05],
  [90, 3.09], [100, 3.12], [110, 3.16], [120, 3.20], [130, 3.24],
  [140, 3.28], [150, 3.33], [160, 3.38], [170, 3.44], [180, 3.50],
  [190, 3.56], [200, 3.62], [220, 3.75], [240, 3.88], [260, 4.00],
  [280, 4.11], [300, 4.21],
];

/** Sand, yards to hole. Short end = greenside bunker, long end = fairway bunker. */
const SAND: Anchors = [
  [5, 2.45], [10, 2.55], [15, 2.62], [20, 2.68], [30, 2.80],
  [40, 2.90], [50, 2.99], [60, 3.07], [70, 3.14], [80, 3.20],
  [90, 3.26], [100, 3.31], [110, 3.36], [120, 3.41], [130, 3.46],
  [140, 3.51], [150, 3.57], [160, 3.63], [170, 3.69], [180, 3.76],
  [190, 3.83], [200, 3.90], [220, 4.04], [240, 4.18], [260, 4.31],
];

/**
 * Recovery: NO realistic shot at the green — must play sideways, out, or lay up.
 * Trees, gorse, deep dunes, blocked out.
 *
 * This curve sitting well above ROUGH at the SAME distance is the whole point:
 * it is what charges the cost of a blocked position to the shot that PUT you
 * there, rather than to the punch-out. The gap is widest at short range
 * (60y: RECOVERY 3.36 vs FAIRWAY 2.81 = 0.55 strokes), which is exactly where
 * punch-outs happen. This is the most important part of the table for a player
 * who loses shots off the tee.
 */
const RECOVERY: Anchors = [
  [10, 2.95], [20, 3.05], [30, 3.15], [40, 3.23], [50, 3.30],
  [60, 3.36], [70, 3.42], [80, 3.47], [90, 3.52], [100, 3.57],
  [120, 3.66], [140, 3.75], [160, 3.84], [180, 3.92], [200, 4.00],
  [220, 4.10], [240, 4.24], [260, 4.40],
];
// Tail (240-260y) was originally [4.20, 4.30], which let SAND's steeper long-range
// slope overtake it at d>253y -- a long fairway-bunker shot briefly reading as
// worse than being fully blocked out in recovery, which is wrong. Widened the gap
// so RECOVERY stays above SAND across the whole range (found by the Phase-1 test
// suite's SAND<RECOVERY ordering check, 2026-09-20).

/**
 * Putting, FEET to hole. Two-putt crossover (E = 2.0) lands at ~24.5 ft, which
 * is the scratch figure; Tour players reach it nearer 33 ft.
 */
const GREEN: Anchors = [
  [1, 1.001], [2, 1.01], [3, 1.06], [4, 1.16], [5, 1.27],
  [6, 1.38], [7, 1.47], [8, 1.54], [9, 1.60], [10, 1.65],
  [12, 1.73], [15, 1.82], [18, 1.89], [20, 1.93], [25, 2.01],
  [30, 2.07], [35, 2.12], [40, 2.16], [45, 2.20], [50, 2.24],
  [60, 2.30], [70, 2.36], [80, 2.41], [90, 2.46], [100, 2.50],
];

export const SCRATCH_BASELINE: Readonly<Record<Lie, Anchors>> = {
  TEE, FAIRWAY, ROUGH, SAND, RECOVERY, GREEN,
};

/** GREEN is indexed in feet; every other lie is indexed in yards. */
export const UNIT_BY_LIE: Readonly<Record<Lie, 'feet' | 'yards'>> = {
  TEE: 'yards', FAIRWAY: 'yards', ROUGH: 'yards',
  SAND: 'yards', RECOVERY: 'yards', GREEN: 'feet',
};

export const BASELINE_ID = 'scratch-v1';
