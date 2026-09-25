/**
 * Where you miss, and how you putt — from the optional Detailed-entry tags
 * (`shots.miss_direction`, `putt_slope`, `putt_break`). Nothing here feeds SG.
 *
 * Every result carries its counts and an `enough` flag: tags are optional and
 * sparse, so a view with 3 tagged misses must say so rather than draw a "trend".
 * Every function filters by category, so a stale tag on a re-categorised shot
 * can never land in the wrong profile.
 *
 * Pure and DB-free, like the rest of `src/lib/insights`.
 */
import { sideOfMiss, type MissDirection, type PuttBreak, type PuttSlope } from '../rounds/entry';
import type { EnrichedShot } from './aggregate';
import { approachBand, puttingBand, shortGameBand, type Band } from './bands';

/** A cross, band row or putting row needs this many tagged shots before it's shown as a finding. */
export const MIN_TAGGED = 8;
/** A per-break putting row needs this many left/right misses. */
export const MIN_BREAK_ROW = 5;

const DIRECTIONS: readonly MissDirection[] = ['LEFT', 'RIGHT', 'LONG', 'SHORT'];
export type MissCounts = Record<MissDirection, number>;
const zeroCounts = (): MissCounts => ({ LEFT: 0, RIGHT: 0, LONG: 0, SHORT: 0 });
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

// ---------------------------------------------------------------------------
// Approach and short game: where shots that miss the green finish
// ---------------------------------------------------------------------------

export type GreenMissProfile = {
  /** 'All' for the overall profile. */
  band: string;
  /** −1 for the overall profile. */
  order: number;
  shots: number;
  /** Finished on the green or holed. */
  onGreen: number;
  onGreenPct: number;
  missed: number;
  /** Misses with a direction tagged. */
  tagged: number;
  untagged: number;
  misses: MissCounts;
  /** Of ALL shots, so the four sectors + on-green + untagged add up to 100%. */
  shares: MissCounts;
  /** The most common tagged miss; null on a tie or with none. */
  dominant: MissDirection | null;
  enough: boolean;
};

function greenProfile(shots: readonly EnrichedShot[], band: string, order: number): GreenMissProfile {
  const onGreen = shots.filter((s) => s.holed || s.endLie === 'GREEN').length;
  const misses = zeroCounts();
  let tagged = 0;
  for (const s of shots) {
    if (s.holed || s.endLie === 'GREEN' || !s.missDirection) continue;
    misses[s.missDirection] += 1;
    tagged += 1;
  }
  const missed = shots.length - onGreen;
  const shares = zeroCounts();
  for (const d of DIRECTIONS) shares[d] = ratio(misses[d], shots.length);
  const top = Math.max(...DIRECTIONS.map((d) => misses[d]));
  const leaders = DIRECTIONS.filter((d) => misses[d] === top);
  return {
    band,
    order,
    shots: shots.length,
    onGreen,
    onGreenPct: ratio(onGreen, shots.length),
    missed,
    tagged,
    untagged: missed - tagged,
    misses,
    shares,
    dominant: top > 0 && leaders.length === 1 ? leaders[0]! : null,
    enough: tagged >= MIN_TAGGED,
  };
}

function byBand(
  shots: readonly EnrichedShot[],
  bandOf: (d: number) => Band,
): { overall: GreenMissProfile; bands: GreenMissProfile[] } {
  const groups = new Map<string, { order: number; shots: EnrichedShot[] }>();
  for (const s of shots) {
    const b = bandOf(s.startDistance);
    const g = groups.get(b.label) ?? { order: b.order, shots: [] };
    g.shots.push(s);
    groups.set(b.label, g);
  }
  return {
    overall: greenProfile(shots, 'All', -1),
    bands: [...groups.entries()]
      .map(([label, g]) => greenProfile(g.shots, label, g.order))
      .sort((a, b) => a.order - b.order),
  };
}

const notReplay = (s: EnrichedShot) => s.penaltyType !== 'STROKE_AND_DISTANCE';

/** Approach shots (incl. par-3 tee shots), by approach band. */
export function approachDispersion(shots: readonly EnrichedShot[]) {
  return byBand(
    shots.filter((s) => s.category === 'APPROACH' && notReplay(s)),
    approachBand,
  );
}

/** Short-game shots and greenside bunker shots, by short-game band. */
export function shortGameDispersion(shots: readonly EnrichedShot[]) {
  return byBand(
    shots.filter(
      (s) => (s.category === 'SHORT_GAME' || (s.category === 'BUNKER' && s.bunkerSubtype === 'greenside')) && notReplay(s),
    ),
    shortGameBand,
  );
}

// ---------------------------------------------------------------------------
// Off the tee: which side of the fairway
// ---------------------------------------------------------------------------

export type TeeDispersion = {
  teeShots: number;
  /** endLie FAIRWAY — the same definition as fairways hit in traditional-stats. */
  fairways: number;
  fairwayPct: number;
  /** Drove the green: neither a fairway nor a miss. */
  onGreen: number;
  left: number;
  right: number;
  /** Missed the fairway, side not tagged. */
  untagged: number;
  leftShare: number;
  rightShare: number;
  enough: boolean;
};

export function teeDispersion(shots: readonly EnrichedShot[]): TeeDispersion {
  const tee = shots.filter((s) => s.category === 'OFF_THE_TEE' && notReplay(s));
  const fairways = tee.filter((s) => s.endLie === 'FAIRWAY').length;
  const onGreen = tee.filter((s) => s.endLie === 'GREEN' || s.holed).length;
  const missedFairway = tee.filter((s) => !s.holed && s.endLie !== 'FAIRWAY' && s.endLie !== 'GREEN');
  // LONG/SHORT can't be stored on a tee shot, but never count one if it were.
  const left = missedFairway.filter((s) => s.missDirection === 'LEFT').length;
  const right = missedFairway.filter((s) => s.missDirection === 'RIGHT').length;
  return {
    teeShots: tee.length,
    fairways,
    fairwayPct: ratio(fairways, tee.length),
    onGreen,
    left,
    right,
    untagged: missedFairway.length - left - right,
    leftShare: ratio(left, tee.length),
    rightShare: ratio(right, tee.length),
    enough: left + right >= MIN_TAGGED,
  };
}

// ---------------------------------------------------------------------------
// Putting profile
// ---------------------------------------------------------------------------

export type SpeedTendency = 'conservative' | 'aggressive' | 'balanced';
/** Share of short/long misses that were short, at or above which speed reads as conservative. */
export const SPEED_CONSERVATIVE = 0.6;
/** …at or below which it reads as aggressive. */
export const SPEED_AGGRESSIVE = 0.4;

export type BreakRow = {
  break: PuttBreak | 'UNKNOWN';
  putts: number;
  made: number;
  missLeft: number;
  missRight: number;
  high: number;
  low: number;
  enough: boolean;
};

export type PuttingProfileBand = {
  band: string;
  order: number;
  putts: number;
  made: number;
  makePct: number;
  missed: number;
  /** Missed putts with a direction tagged. */
  tagged: number;
  short: number;
  long: number;
  left: number;
  right: number;
  /** Side misses on a breaking putt, from break + left/right. */
  high: number;
  low: number;
  /** Null until short + long reaches MIN_TAGGED. */
  speed: SpeedTendency | null;
  byBreak: BreakRow[];
  bySlope: { slope: PuttSlope; putts: number; made: number }[];
  enough: boolean;
};

const BREAKS: readonly (PuttBreak | 'UNKNOWN')[] = ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT', 'STRAIGHT', 'UNKNOWN'];
const SLOPES: readonly PuttSlope[] = ['UPHILL', 'DOWNHILL', 'FLAT'];

export function speedTendency(short: number, long: number): SpeedTendency | null {
  if (short + long < MIN_TAGGED) return null;
  const s = short / (short + long);
  if (s >= SPEED_CONSERVATIVE) return 'conservative';
  if (s <= SPEED_AGGRESSIVE) return 'aggressive';
  return 'balanced';
}

function puttProfile(putts: readonly EnrichedShot[], band: string, order: number): PuttingProfileBand {
  const made = putts.filter((s) => s.holed).length;
  const missedPutts = putts.filter((s) => !s.holed);
  const count = (d: MissDirection) => missedPutts.filter((s) => s.missDirection === d).length;
  const [short, long, left, right] = [count('SHORT'), count('LONG'), count('LEFT'), count('RIGHT')];
  let high = 0;
  let low = 0;
  for (const s of missedPutts) {
    const side = sideOfMiss(s.puttBreak, s.missDirection);
    if (side === 'HIGH') high += 1;
    if (side === 'LOW') low += 1;
  }
  const byBreak: BreakRow[] = [];
  for (const b of BREAKS) {
    const rows = putts.filter((s) => (s.puttBreak ?? 'UNKNOWN') === b);
    if (rows.length === 0) continue;
    const miss = rows.filter((s) => !s.holed);
    const missLeft = miss.filter((s) => s.missDirection === 'LEFT').length;
    const missRight = miss.filter((s) => s.missDirection === 'RIGHT').length;
    byBreak.push({
      break: b,
      putts: rows.length,
      made: rows.length - miss.length,
      missLeft,
      missRight,
      high: miss.filter((s) => sideOfMiss(s.puttBreak, s.missDirection) === 'HIGH').length,
      low: miss.filter((s) => sideOfMiss(s.puttBreak, s.missDirection) === 'LOW').length,
      enough: missLeft + missRight >= MIN_BREAK_ROW,
    });
  }
  const bySlope = SLOPES.map((slope) => {
    const rows = putts.filter((s) => s.puttSlope === slope);
    return { slope, putts: rows.length, made: rows.filter((s) => s.holed).length };
  }).filter((r) => r.putts > 0);
  const tagged = missedPutts.filter((s) => s.missDirection !== null).length;
  return {
    band,
    order,
    putts: putts.length,
    made,
    makePct: ratio(made, putts.length),
    missed: missedPutts.length,
    tagged,
    short,
    long,
    left,
    right,
    high,
    low,
    speed: speedTendency(short, long),
    byBreak,
    bySlope,
    enough: tagged >= MIN_TAGGED,
  };
}

/** Putting by distance band (feet): make rate, speed (short vs long) and which side you miss. */
export function puttingProfile(shots: readonly EnrichedShot[]): { overall: PuttingProfileBand; bands: PuttingProfileBand[] } {
  const putts = shots.filter((s) => s.category === 'PUTTING');
  const groups = new Map<string, { order: number; putts: EnrichedShot[] }>();
  for (const s of putts) {
    const b = puttingBand(s.startDistance);
    const g = groups.get(b.label) ?? { order: b.order, putts: [] };
    g.putts.push(s);
    groups.set(b.label, g);
  }
  return {
    overall: puttProfile(putts, 'All', -1),
    bands: [...groups.entries()].map(([label, g]) => puttProfile(g.putts, label, g.order)).sort((a, b) => a.order - b.order),
  };
}

// ---------------------------------------------------------------------------
// One sentence
// ---------------------------------------------------------------------------

const DIR_WORD: Record<MissDirection, string> = { LEFT: 'left', RIGHT: 'right', LONG: 'long', SHORT: 'short' };

/** The one thing worth knowing, once something has enough tags; null before then. */
export function dispersionHeadline(
  approach: { overall: GreenMissProfile },
  putting: { overall: PuttingProfileBand },
): string | null {
  const parts: string[] = [];
  const a = approach.overall;
  if (a.enough && a.dominant) {
    const pct = Math.round((a.misses[a.dominant] / a.tagged) * 100);
    parts.push(`approach shots that miss the green mostly finish ${DIR_WORD[a.dominant]} (${pct}% of ${a.tagged} tagged misses)`);
  }
  const speed = putting.overall.speed;
  if (speed === 'conservative') parts.push('putts you miss tend to finish short');
  else if (speed === 'aggressive') parts.push('putts you miss tend to finish long');
  else if (speed === 'balanced') parts.push('putts you miss split evenly between short and long');
  if (parts.length === 0) return null;
  const text = parts.join('; ');
  return `${text[0]!.toUpperCase()}${text.slice(1)}.`;
}
