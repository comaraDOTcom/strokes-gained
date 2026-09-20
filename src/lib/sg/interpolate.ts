/**
 * Linear interpolation over the scratch baseline anchor tables.
 *
 * See `baseline-scratch.ts` for the anchor data and its provenance. This file
 * only implements the interpolation/extrapolation/clamping rules described in
 * BUILD.md — it must not alter the anchor values themselves.
 */
import { SCRATCH_BASELINE, type Lie } from './baseline-scratch';

/**
 * Expected strokes to hole out from `distance` in the given `lie`.
 *
 * `distance` is in FEET when `lie === 'GREEN'`, YARDS for every other lie
 * (see `UNIT_BY_LIE`).
 */
export function expectedStrokes(lie: Lie, distance: number): number {
  if (distance === 0) return 0;

  const anchors = SCRATCH_BASELINE[lie];
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (!first || !last) {
    throw new Error(`No baseline anchors for lie ${lie}`);
  }

  // Below the first anchor: clamp toward holing out rather than extrapolate.
  if (distance <= first[0]) {
    if (lie === 'GREEN' && distance <= 1) return 1.0;
    return first[1];
  }

  // Above the last anchor: linear extrapolation using the final segment's slope.
  if (distance >= last[0]) {
    const secondLast = anchors[anchors.length - 2];
    if (!secondLast) return last[1];
    const slope = (last[1] - secondLast[1]) / (last[0] - secondLast[0]);
    return last[1] + slope * (distance - last[0]);
  }

  // Otherwise: linear interpolation between the two bracketing anchors.
  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (!lo || !hi) continue;
    if (distance >= lo[0] && distance <= hi[0]) {
      const t = (distance - lo[0]) / (hi[0] - lo[0]);
      return lo[1] + t * (hi[1] - lo[1]);
    }
  }

  // Unreachable given the checks above, but keep TypeScript (and future
  // refactors) honest.
  throw new Error(`Unable to interpolate ${lie} at distance ${distance}`);
}
