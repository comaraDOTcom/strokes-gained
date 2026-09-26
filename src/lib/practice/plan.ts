/**
 * "Next session": the practice plan on `/practice` (issue #55). Turns strokes gained into what to
 * practise: the parts of your game that cost the most strokes a round over your last few rounds,
 * the distance range inside each that costs the most, and the drills for it.
 *
 * How it ranks, and why it differs from "What to work on" on `/trends` (`roadmap.ts`):
 * - The roadmap weights each area by Broadie's importance; this plan does not. It ranks by strokes
 *   at stake a round, `max(0, −ΣSG × 18 / holes played)`, because a practice session should go
 *   where the strokes are, whatever their share of scoring differences between golfers.
 * - Areas are parts of the game (strokes-gained categories), not distance bands, so the top three
 *   are three different things to practise, never three approach bands.
 * - Inside each area, the focus range is found by a sliding window (30 yards for approach, 10 for
 *   short game) or fixed putting ranges that match the drills (4–8 ft, 30–50 ft …), so it can say
 *   "140–170 yards" rather than the fixed 150–200y band. A window needs at least
 *   MIN_FOCUS_SHOTS shots, so one bad shot can't pick it on its own.
 *
 * Window: the last `roundWindow` rounds (default 6); no plan under MIN_PLAN_ROUNDS rounds.
 * Pure and DB-free, like `src/lib/insights`.
 */
import type { BunkerSubtype, Category } from '../sg/categorise';
import type { EnrichedShot } from '../insights/aggregate';
import { chronologicalRoundIds, holesPlayed, lastNRoundsShots } from '../insights/roadmap';
import { drillsFor, type Drill } from './drills';

export const DEFAULT_PLAN_ROUNDS = 6;
export const MIN_PLAN_ROUNDS = 3;
export const MAX_PLAN_ROUNDS = 20;
export const PLAN_SIZE = 3;
/** A focus range needs this many shots in it before it can be named. */
export const MIN_FOCUS_SHOTS = 3;
/** Fewer shots than this in an area = a hint, not a finding (same line as the roadmap). */
export const SMALL_SAMPLE_SHOTS = 10;
/** Areas losing less than this a round aren't worth a session (and would print as "0.0"). */
export const MIN_STROKES_AT_STAKE = 0.05;

export const AREA_LABEL: Record<Category, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker play',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery shots',
};

/** How the area reads inside a sentence: "You lose 1.4 strokes a round on approach shots". */
const AREA_PHRASE: Record<Category, string> = {
  OFF_THE_TEE: 'off the tee',
  APPROACH: 'on approach shots',
  SHORT_GAME: 'around the green',
  BUNKER: 'from bunkers',
  PUTTING: 'on the greens',
  RECOVERY: 'on recovery shots',
};

const AREAS: readonly Category[] = ['OFF_THE_TEE', 'APPROACH', 'SHORT_GAME', 'BUNKER', 'PUTTING', 'RECOVERY'];

// ---------------------------------------------------------------------------
// Focus ranges
// ---------------------------------------------------------------------------

type Window = { min: number; max: number; unit: 'yd' | 'ft' };

/** Putting ranges line up with the drills (circle putting 4–8 ft, lag putting 30–50 ft). */
const PUTTING_WINDOWS: readonly Window[] = [
  { min: 0, max: 4, unit: 'ft' },
  { min: 4, max: 8, unit: 'ft' },
  { min: 8, max: 15, unit: 'ft' },
  { min: 15, max: 30, unit: 'ft' },
  { min: 30, max: 50, unit: 'ft' },
  { min: 50, max: Infinity, unit: 'ft' },
];

function slidingWindows(distances: number[], width: number, step: number, unit: 'yd' | 'ft'): Window[] {
  if (distances.length === 0) return [];
  const lo = Math.floor(Math.min(...distances) / step) * step;
  const hi = Math.max(...distances);
  const out: Window[] = [];
  // Windows are (min, max]: a shot from exactly 140 yards sits in 110–140, not 140–170.
  for (let start = Math.max(0, lo - width); start < hi; start += step) out.push({ min: start, max: start + width, unit });
  return out;
}

function windowsFor(area: Category, shots: readonly EnrichedShot[]): Window[] {
  const d = shots.map((s) => s.startDistance);
  switch (area) {
    case 'APPROACH':
      return slidingWindows(d, 30, 10, 'yd');
    case 'SHORT_GAME':
      return slidingWindows(d, 10, 5, 'yd');
    case 'PUTTING':
      return [...PUTTING_WINDOWS];
    default:
      return [];
  }
}

const inWindow = (s: EnrichedShot, w: Window) => s.startDistance > w.min && s.startDistance <= w.max;

export function formatRange(w: { min: number; max: number }, unit: 'yd' | 'ft'): string {
  const u = unit === 'yd' ? 'yards' : 'ft';
  if (w.max === Infinity) return `${w.min}+ ${u}`;
  return `${w.min}–${w.max} ${u}`;
}

export type Focus = {
  /** "140–170 yards", "4–8 ft", "greenside bunkers". */
  label: string;
  range: { min: number; max: number } | null;
  bunkerSubtype: BunkerSubtype | null;
  strokesPerRound: number;
  attempts: number;
};

function bunkerSubtypeOf(s: EnrichedShot): BunkerSubtype {
  return s.bunkerSubtype ?? (s.startDistance <= 30 ? 'greenside' : 'fairway');
}

/**
 * The costliest range inside one area's shots. Null for areas with no distance to split by (off
 * the tee, recovery), or when no range with enough shots loses strokes.
 */
export function focusFor(area: Category, areaShots: readonly EnrichedShot[], holes: number): Focus | null {
  const per18 = holes > 0 ? 18 / holes : 0;
  type Cand = { label: string; range: Focus['range']; bunkerSubtype: BunkerSubtype | null; shots: EnrichedShot[] };
  let cands: Cand[];
  if (area === 'BUNKER') {
    cands = (['greenside', 'fairway'] as const).map((sub) => ({
      label: `${sub} bunkers`,
      range: null,
      bunkerSubtype: sub,
      shots: areaShots.filter((s) => bunkerSubtypeOf(s) === sub),
    }));
  } else {
    cands = windowsFor(area, areaShots).map((w) => ({
      label: formatRange(w, w.unit),
      range: { min: w.min, max: w.max },
      bunkerSubtype: null,
      shots: areaShots.filter((s) => inWindow(s, w)),
    }));
  }
  let best: (Cand & { loss: number }) | null = null;
  for (const c of cands) {
    if (c.shots.length < MIN_FOCUS_SHOTS) continue;
    const loss = -c.shots.reduce((a, s) => a + s.sg, 0);
    // Strictly greater: on a tie the lower range (listed first) wins.
    if (loss > 0 && (best === null || loss > best.loss + 1e-9)) best = { ...c, loss };
  }
  if (!best) return null;
  return {
    label: best.label,
    range: best.range,
    bunkerSubtype: best.bunkerSubtype,
    strokesPerRound: best.loss * per18,
    attempts: best.shots.length,
  };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export type PlanItem = {
  area: Category;
  label: string;
  /** Strokes lost to scratch a round (per 18 holes) in this area. Positive. */
  strokesPerRound: number;
  sgTotal: number;
  attempts: number;
  penaltyStrokes: number;
  focus: Focus | null;
  /** Best match first; empty when the library has no drill for this yet. */
  drills: Drill[];
  smallSample: boolean;
  sentence: string;
};

export type PracticePlan =
  | { status: 'not-enough-rounds'; roundsTotal: number; minRounds: number }
  | {
      status: 'ready';
      roundsTotal: number;
      /** Rounds the plan is built from (the last `roundWindow`, or all when fewer). */
      roundsUsed: number;
      holes: number;
      firstPlayedOn: string;
      lastPlayedOn: string;
      /** Up to PLAN_SIZE areas, most strokes at stake first. Empty = nothing loses strokes. */
      items: PlanItem[];
    };

/** `?rounds=` from the URL: a whole number from MIN to MAX, else the default. */
export function parsePlanRounds(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= MIN_PLAN_ROUNDS && n <= MAX_PLAN_ROUNDS ? n : DEFAULT_PLAN_ROUNDS;
}

export function buildPracticePlan(
  shots: readonly EnrichedShot[],
  opts: { roundWindow?: number } = {},
): PracticePlan {
  const roundWindow = Math.max(MIN_PLAN_ROUNDS, opts.roundWindow ?? DEFAULT_PLAN_ROUNDS);
  const roundsTotal = chronologicalRoundIds(shots).length;
  if (roundsTotal < MIN_PLAN_ROUNDS) return { status: 'not-enough-rounds', roundsTotal, minRounds: MIN_PLAN_ROUNDS };

  const window = lastNRoundsShots(shots, roundWindow);
  const ids = chronologicalRoundIds(window);
  const holes = holesPlayed(window);
  const per18 = holes > 0 ? 18 / holes : 0;
  const playedOn = window.map((s) => s.playedOn).sort();

  const items: PlanItem[] = AREAS.map((area) => {
    const areaShots = window.filter((s) => s.category === area);
    const sgTotal = areaShots.reduce((a, s) => a + s.sg, 0);
    const focus = focusFor(area, areaShots, holes);
    const base = {
      area,
      label: AREA_LABEL[area],
      strokesPerRound: Math.max(0, -sgTotal * per18),
      sgTotal,
      attempts: areaShots.length,
      penaltyStrokes: areaShots.reduce((a, s) => a + s.penaltyStrokes, 0),
      focus,
      drills: drillsFor(area, focus?.range ?? null, focus?.bunkerSubtype ?? null),
      smallSample: areaShots.length < SMALL_SAMPLE_SHOTS,
    };
    return { ...base, sentence: planSentence(base) };
  })
    .filter((i) => i.attempts > 0 && i.strokesPerRound >= MIN_STROKES_AT_STAKE)
    .sort((a, b) => b.strokesPerRound - a.strokesPerRound || AREAS.indexOf(a.area) - AREAS.indexOf(b.area))
    .slice(0, PLAN_SIZE);

  return {
    status: 'ready',
    roundsTotal,
    roundsUsed: ids.length,
    holes,
    firstPlayedOn: playedOn[0]!,
    lastPlayedOn: playedOn[playedOn.length - 1]!,
    items,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One or two plain sentences for a plan card, which shows the area's name above it. */
export function planSentence(i: Omit<PlanItem, 'sentence'>): string {
  const penalties = i.penaltyStrokes > 0 ? `, including ${plural(i.penaltyStrokes, 'penalty stroke')}` : '';
  let out = `You lose ${i.strokesPerRound.toFixed(1)} strokes a round ${AREA_PHRASE[i.area]}${penalties}.`;
  if (i.focus) {
    const what = i.focus.bunkerSubtype
      ? capitalise(i.focus.label)
      : `${i.area === 'PUTTING' ? 'Putts' : 'Shots'} from ${i.focus.label}`;
    out += ` ${what} cost the most: ${i.focus.strokesPerRound.toFixed(1)} a round over ${plural(i.focus.attempts, 'shot')}.`;
  }
  if (i.smallSample) out += ` Only ${plural(i.attempts, 'shot')} so far, so treat it as a hint.`;
  return out;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
