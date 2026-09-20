/**
 * The ONE place feet<->yards conversion happens in this app.
 *
 * Storage (schema.ts) is always yards, for every lie including GREEN.
 * Display/input is feet for GREEN, yards for everything else (see
 * `UNIT_BY_LIE` in `src/lib/sg/baseline-scratch.ts`). Every read/write path
 * that crosses that boundary must go through these two functions — no
 * inline `* 3` or `/ 3` anywhere else.
 */
const FEET_PER_YARD = 3;

export function feetToYards(feet: number): number {
  return feet / FEET_PER_YARD;
}

export function yardsToFeet(yards: number): number {
  return yards * FEET_PER_YARD;
}
