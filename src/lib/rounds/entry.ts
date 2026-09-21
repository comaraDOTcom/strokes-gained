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

// ---------------------------------------------------------------------------
// Optional per-shot mentality tags
// ---------------------------------------------------------------------------

export const FOCUS_VALUES = ['INTERNAL', 'EXTERNAL'] as const;
export type Focus = (typeof FOCUS_VALUES)[number];

export const COMMITMENT_VALUES = ['COMMITTED', 'HESITANT'] as const;
export type Commitment = (typeof COMMITMENT_VALUES)[number];

export type ShotTags = {
  /** `undefined` = not sent (on an edit, keep what's stored); `null` = explicitly cleared. */
  focus: Focus | null | undefined;
  commitment: Commitment | null | undefined;
};

export type ParseTagsResult = ({ ok: true } & ShotTags) | { ok: false; error: string };

/** Validate the optional focus/commitment tags on a shot submission. */
export function parseShotTags(input: { focus?: unknown; commitment?: unknown }): ParseTagsResult {
  const pick = <T extends string>(v: unknown, allowed: readonly T[], name: string) => {
    if (v === undefined) return { ok: true as const, value: undefined };
    if (v === null) return { ok: true as const, value: null };
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return { ok: true as const, value: v as T };
    return { ok: false as const, error: `${name} must be one of ${allowed.join(', ')}, or null` };
  };
  const focus = pick(input.focus, FOCUS_VALUES, 'focus');
  if (!focus.ok) return focus;
  const commitment = pick(input.commitment, COMMITMENT_VALUES, 'commitment');
  if (!commitment.ok) return commitment;
  return { ok: true, focus: focus.value, commitment: commitment.value };
}

// ---------------------------------------------------------------------------
// "Distance left" sanity feedback
// ---------------------------------------------------------------------------

/**
 * The distance box asks how far the ball FINISHED from the hole, but it's natural to type
 * how far you HIT it (a 290y drive on a 390y hole should be entered as 100). Given the
 * shot's start and the entered result, say what that entry implies so a mix-up is obvious
 * immediately: "travelled about 100y" for the mistaken 290, "about 290y" for the right 100.
 * Straight-line arithmetic, hence "about". `endDistance` is in display units (feet on GREEN).
 */
export function describeEntry(
  start: { lie: Lie; yards: number },
  endLie: Lie,
  endDistance: number,
): { kind: 'travelled'; text: string } | { kind: 'warning'; text: string } | null {
  if (!Number.isFinite(endDistance) || endDistance < 0) return null;
  const endYards = endLie === 'GREEN' ? endDistance / 3 : endDistance;
  const travelled = start.yards - endYards;

  if (travelled < -0.5) {
    return {
      kind: 'warning',
      text: `That's further from the hole than where you started (${fmt(start)}). Enter the distance LEFT to the hole, not how far you hit it.`,
    };
  }
  // Putts read naturally in feet; everything else in yards.
  const text =
    start.lie === 'GREEN' && endLie === 'GREEN'
      ? `This putt travelled about ${Math.round(travelled * 3)}ft`
      : `This shot travelled about ${Math.round(travelled)}y`;
  return { kind: 'travelled', text };
}

function fmt(start: { lie: Lie; yards: number }): string {
  return start.lie === 'GREEN' ? `${Math.round(start.yards * 3)}ft` : `${Math.round(start.yards)}y`;
}
