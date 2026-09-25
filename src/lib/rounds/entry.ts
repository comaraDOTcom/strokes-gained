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

// ---------------------------------------------------------------------------
// Optional shot-shape tags (Detailed entry) — never feed SG
// ---------------------------------------------------------------------------

/** Where a shot finished relative to the target (for a tee shot, the fairway). */
export const MISS_DIRECTION_VALUES = ['LEFT', 'RIGHT', 'LONG', 'SHORT'] as const;
export type MissDirection = (typeof MISS_DIRECTION_VALUES)[number];

export const PUTT_SLOPE_VALUES = ['UPHILL', 'DOWNHILL', 'FLAT'] as const;
export type PuttSlope = (typeof PUTT_SLOPE_VALUES)[number];

export const PUTT_BREAK_VALUES = ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT', 'STRAIGHT'] as const;
export type PuttBreak = (typeof PUTT_BREAK_VALUES)[number];

export type ShotTags = {
  /** `undefined` = not sent (on an edit, keep what's stored); `null` = explicitly cleared. */
  focus: Focus | null | undefined;
  commitment: Commitment | null | undefined;
  missDirection: MissDirection | null | undefined;
  puttSlope: PuttSlope | null | undefined;
  puttBreak: PuttBreak | null | undefined;
};

/** Every tag, resolved: what gets stored. */
export type StoredShotTags = { [K in keyof ShotTags]: Exclude<ShotTags[K], undefined> };

export const SHOT_TAG_KEYS = ['focus', 'commitment', 'missDirection', 'puttSlope', 'puttBreak'] as const;

export type ParseTagsResult = ({ ok: true } & ShotTags) | { ok: false; error: string };

/** Validate the optional tags on a shot submission (values only; see `normaliseShotTags` for which apply). */
export function parseShotTags(input: {
  focus?: unknown;
  commitment?: unknown;
  missDirection?: unknown;
  puttSlope?: unknown;
  puttBreak?: unknown;
}): ParseTagsResult {
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
  const missDirection = pick(input.missDirection, MISS_DIRECTION_VALUES, 'missDirection');
  if (!missDirection.ok) return missDirection;
  const puttSlope = pick(input.puttSlope, PUTT_SLOPE_VALUES, 'puttSlope');
  if (!puttSlope.ok) return puttSlope;
  const puttBreak = pick(input.puttBreak, PUTT_BREAK_VALUES, 'puttBreak');
  if (!puttBreak.ok) return puttBreak;
  return {
    ok: true,
    focus: focus.value,
    commitment: commitment.value,
    missDirection: missDirection.value,
    puttSlope: puttSlope.value,
    puttBreak: puttBreak.value,
  };
}

/** Which kind of miss a shot can have: off the fairway, around the green, or a missed putt. */
export type MissKind = 'tee' | 'green' | 'putt';

export type TagContext = {
  startLie: Lie;
  par: number;
  /** Where it finished; null when holed (or not chosen yet). */
  endLie: Lie | null;
  holed: boolean;
  penaltyType: string | null;
};

/**
 * Which optional tag groups make sense for a shot.
 * - `putt`: slope and break, for any shot from the green (known before the stroke, so a holed putt
 *   keeps them).
 * - `miss`: where it went wrong. A tee shot on a par 4/5 that missed the fairway (left/right only);
 *   a putt that stayed on the green; any other shot that missed the green. Nothing for a holed
 *   shot, a shot that found the green or fairway it was aimed at, or a stroke-and-distance replay.
 */
export function tagGroupsFor(ctx: TagContext): { putt: boolean; miss: MissKind | null } {
  if (ctx.penaltyType === 'STROKE_AND_DISTANCE') return { putt: false, miss: null };
  const putt = ctx.startLie === 'GREEN';
  if (ctx.holed || ctx.endLie === null) return { putt, miss: null };
  if (ctx.startLie === 'TEE' && ctx.par >= 4) {
    return { putt, miss: ctx.endLie === 'FAIRWAY' || ctx.endLie === 'GREEN' ? null : 'tee' };
  }
  if (putt) return { putt, miss: ctx.endLie === 'GREEN' ? 'putt' : 'green' };
  return { putt, miss: ctx.endLie === 'GREEN' ? null : 'green' };
}

/** The miss buttons offered for each kind of miss, in screen order. */
export const MISS_OPTIONS: Record<MissKind, readonly MissDirection[]> = {
  tee: ['LEFT', 'RIGHT'],
  green: ['LEFT', 'RIGHT', 'LONG', 'SHORT'],
  putt: ['SHORT', 'LONG', 'LEFT', 'RIGHT'],
};

/**
 * Server-side: drop tag groups that don't apply to this shot (e.g. putt slope on a chip, after an
 * edit changed the lie) and reject a miss that can't happen (long or short of a fairway).
 * Mentality tags always apply. Pass the MERGED tags (stored row + this submission).
 */
export function normaliseShotTags(
  tags: StoredShotTags,
  ctx: TagContext,
): { ok: true; tags: StoredShotTags } | { ok: false; error: string } {
  const groups = tagGroupsFor(ctx);
  const out: StoredShotTags = { ...tags };
  if (!groups.putt) {
    out.puttSlope = null;
    out.puttBreak = null;
  }
  if (groups.miss === null) {
    out.missDirection = null;
  } else if (out.missDirection !== null && !MISS_OPTIONS[groups.miss].includes(out.missDirection)) {
    return { ok: false, error: 'A tee shot can only miss LEFT or RIGHT of the fairway' };
  }
  return { ok: true, tags: out };
}

/**
 * The side of the hole a missed putt finished on, from its break. On a left-to-right putt the
 * ball comes from the left, so missing LEFT is the high (amateur) side; on right-to-left, RIGHT
 * is high. Null for a straight putt, an unknown break, or a putt missed short or long.
 */
export function sideOfMiss(brk: PuttBreak | null, dir: MissDirection | null): 'HIGH' | 'LOW' | null {
  if (dir !== 'LEFT' && dir !== 'RIGHT') return null;
  if (brk === 'LEFT_TO_RIGHT') return dir === 'LEFT' ? 'HIGH' : 'LOW';
  if (brk === 'RIGHT_TO_LEFT') return dir === 'RIGHT' ? 'HIGH' : 'LOW';
  return null;
}

/** Button hint text for a putt miss: "high side" / "low side", or null. */
export function puttSideLabel(brk: PuttBreak | null, dir: MissDirection): 'high side' | 'low side' | null {
  const side = sideOfMiss(brk, dir);
  return side === 'HIGH' ? 'high side' : side === 'LOW' ? 'low side' : null;
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

// ---------------------------------------------------------------------------
// Swipe between holes
// ---------------------------------------------------------------------------

/**
 * Interpret a finished touch as a hole change. Deliberately strict so normal use never
 * triggers it: the finger must travel at least 60px, mostly horizontally (more than twice
 * the vertical travel, so scrolling the page is never a swipe), and must not have started
 * within 24px of a screen edge (that's iOS Safari's own back/forward gesture).
 * Swipe LEFT = next hole (content moves left, like turning a page); RIGHT = previous.
 */
export function swipeToHoleDelta(t: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  viewportWidth: number;
}): -1 | 0 | 1 {
  const EDGE = 24;
  if (t.startX < EDGE || t.startX > t.viewportWidth - EDGE) return 0;
  const dx = t.endX - t.startX;
  const dy = t.endY - t.startY;
  if (Math.abs(dx) < 60 || Math.abs(dx) <= 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
