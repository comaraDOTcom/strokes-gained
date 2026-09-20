/**
 * Round-entry form defaults. Kept pure (no React) so the rule is unit-tested.
 */
import type { Lie } from '../sg/baseline-scratch';

/**
 * The result-lie to pre-select for the *next* shot on a hole. Once a shot has
 * finished on the GREEN, the next one is almost certainly another putt that
 * ends on the green (or holes out), so pre-select GREEN and save a tap per
 * putt. Anything else — no shots yet, hole already finished, last shot ended
 * off the green or was a penalty replay (no end lie) — pre-selects nothing,
 * because guessing wrong there would silently record the wrong lie.
 */
export function defaultResultLie(
  holeShots: readonly { holed: boolean; endLie: string | null }[],
): Lie | null {
  const last = holeShots[holeShots.length - 1];
  if (!last || last.holed) return null;
  return last.endLie === 'GREEN' ? 'GREEN' : null;
}
