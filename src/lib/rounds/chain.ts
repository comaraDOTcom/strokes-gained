/**
 * Editing a shot in place. A shot's START is always derived from the previous
 * shot's END (see the shots API), so when shot N's result changes, every later
 * shot's start has to follow — and a stroke-and-distance shot's END is defined
 * as its START, so it moves too and carries the change further down the chain.
 * Results the user actually entered (lie/distance of a normal shot, lateral
 * drop positions, holed) are never touched.
 */
import type { PenaltyType } from '../sg/compute';

export type ChainShot = {
  shotNo: number;
  startLie: string;
  startYards: number;
  endLie: string | null;
  endYards: number;
  holed: boolean;
  penaltyType: PenaltyType | string | null;
};

/**
 * `shots` is one hole's shots in shot order, with `shots[index]` already holding
 * its new result. Returns the shots AFTER `index` with starts (and stroke-and-
 * distance ends) re-derived. If the edited shot finished the hole, nothing can
 * follow it, so the tail is dropped.
 */
export function propagateChain<T extends ChainShot>(shots: readonly T[], index: number): T[] {
  const edited = shots[index]!;
  if (edited.holed) return [];

  const out: T[] = [];
  let prev: ChainShot = edited;
  for (const s of shots.slice(index + 1)) {
    const next: T = { ...s, startLie: prev.endLie as string, startYards: prev.endYards };
    if (next.penaltyType === 'STROKE_AND_DISTANCE') {
      next.endLie = next.startLie;
      next.endYards = next.startYards;
    }
    out.push(next);
    prev = next;
  }
  return out;
}
