/**
 * Shot categorisation, per BUILD.md. The six rules are resolved in strict
 * priority order — first match wins. Do not reorder them.
 */
import type { Lie } from './baseline-scratch';

export type Category =
  | 'OFF_THE_TEE'
  | 'APPROACH'
  | 'SHORT_GAME'
  | 'BUNKER'
  | 'PUTTING'
  | 'RECOVERY';

export type BunkerSubtype = 'greenside' | 'fairway';

export type CategoryResult = {
  category: Category;
  /** Only populated when category === 'BUNKER'. */
  bunkerSubtype: BunkerSubtype | null;
};

/**
 * Categorise a shot by its START position (lie + distance) and the hole's par.
 *
 * Rules, in order (first match wins):
 * 1. startLie === 'GREEN'                       -> PUTTING
 * 2. startLie === 'SAND'                         -> BUNKER
 *      (greenside when startDistance <= 30y, else fairway)
 * 3. startLie === 'RECOVERY'                     -> RECOVERY
 * 4. startLie === 'TEE' && par >= 4              -> OFF_THE_TEE
 * 5. startDistance > 30 (yards)                  -> APPROACH (incl. par-3 tee shots)
 * 6. otherwise                                   -> SHORT_GAME
 */
export function categoriseShot(
  startLie: Lie,
  startDistance: number,
  par: number,
): CategoryResult {
  if (startLie === 'GREEN') {
    return { category: 'PUTTING', bunkerSubtype: null };
  }

  if (startLie === 'SAND') {
    const bunkerSubtype: BunkerSubtype = startDistance <= 30 ? 'greenside' : 'fairway';
    return { category: 'BUNKER', bunkerSubtype };
  }

  if (startLie === 'RECOVERY') {
    return { category: 'RECOVERY', bunkerSubtype: null };
  }

  if (startLie === 'TEE' && par >= 4) {
    return { category: 'OFF_THE_TEE', bunkerSubtype: null };
  }

  if (startDistance > 30) {
    return { category: 'APPROACH', bunkerSubtype: null };
  }

  return { category: 'SHORT_GAME', bunkerSubtype: null };
}
