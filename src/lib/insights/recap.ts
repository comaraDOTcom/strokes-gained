/**
 * Round recap — the story of one round, for the click-through at /rounds/[id]/recap:
 * headline, best/worst holes, best/worst shots, strongest/weakest area. Pure: takes the
 * round's EnrichedShots (display units: feet on the green, yards elsewhere).
 *
 * "Best" and "worst" lists never overlap, and shrink sensibly for short rounds (a 3-hole
 * round gets 2 best + 1 worst, not the same holes twice). Only FINISHED holes count as holes;
 * every logged shot counts as a shot.
 *
 * Shots are ranked in TWO groups — tee-to-green and putts — because a holed putt swings SG in
 * one stroke (expected ~1.8 more -> done), so a single list is nothing but putts.
 */
import type { Category } from '../sg/categorise';
import type { Lie } from '../sg/baseline-scratch';
import type { EnrichedShot } from './aggregate';

export const CATEGORY_LABEL: Record<Category, string> = {
  OFF_THE_TEE: 'Off the tee',
  APPROACH: 'Approach',
  SHORT_GAME: 'Short game',
  BUNKER: 'Bunker',
  PUTTING: 'Putting',
  RECOVERY: 'Recovery',
};

export type RecapHole = { holeNo: number; par: number; score: number; toPar: number; result: string; sg: number };
export type RecapShot = {
  roundId: number;
  playedOn: string;
  holeNo: number;
  shotNo: number;
  par: number;
  category: Category;
  sg: number;
  text: string;
  penalty: boolean;
};
export type ShotGroups = { longGame: RecapShot[]; putts: RecapShot[] };
export type RecapArea = { category: Category; label: string; sg: number; shots: number; perShot: number };

export type RoundRecap = {
  holesPlayed: number;
  score: number;
  par: number;
  toPar: number;
  sgTotal: number;
  shotCount: number;
  bestHoles: RecapHole[];
  worstHoles: RecapHole[];
  /** Finished holes in neither list (so best + worst + other = every finished hole). */
  otherHoles: RecapHole[];
  /** Up to 3 each. `longGame` = every non-putt (tee shots, approaches, short game, bunker, recovery). */
  bestShots: ShotGroups;
  worstShots: ShotGroups;
  /** Best and worst category by total SG; null when only one category has shots. */
  strongArea: RecapArea | null;
  weakArea: RecapArea | null;
  areas: RecapArea[];
};

const LIE_PHRASE: Record<Lie, { from: string; at: string }> = {
  TEE: { from: 'off the tee', at: 'back on the tee' },
  FAIRWAY: { from: 'from the fairway', at: 'on the fairway' },
  ROUGH: { from: 'from the rough', at: 'in the rough' },
  SAND: { from: 'from the sand', at: 'in the sand' },
  RECOVERY: { from: 'from trouble', at: 'in trouble' },
  GREEN: { from: 'on the green', at: 'on the green' },
};

const n = (v: number) => String(Math.round(v));

/** "165y from the fairway to 12ft" · "22ft putt, holed" · "Drive: 413y off the tee to 140y on the fairway". */
export function describeShot(s: Pick<EnrichedShot, 'startLie' | 'startDistance' | 'endLie' | 'endDistance' | 'holed' | 'penaltyStrokes' | 'penaltyType'>): string {
  const start = s.startLie === 'GREEN' ? `${n(s.startDistance)}ft putt` : `${n(s.startDistance)}y ${LIE_PHRASE[s.startLie].from}`;
  let end: string;
  if (s.holed) end = s.startLie === 'GREEN' ? ', holed' : ' — holed!';
  else if (s.penaltyType === 'STROKE_AND_DISTANCE') end = ', lost ball / out of bounds — replayed';
  else if (s.endLie === 'GREEN') end = ` to ${n(s.endDistance)}ft`;
  else if (s.endLie) end = ` to ${n(s.endDistance)}y ${LIE_PHRASE[s.endLie].at}`;
  else end = '';
  const pen = s.penaltyStrokes > 0 && s.penaltyType !== 'STROKE_AND_DISTANCE' ? ` (+${s.penaltyStrokes} penalty)` : '';
  return `${start}${end}${pen}`;
}

export function holeResult(toPar: number, score: number): string {
  if (score === 1) return 'Hole in one';
  if (toPar <= -3) return 'Albatross';
  if (toPar === -2) return 'Eagle';
  if (toPar === -1) return 'Birdie';
  if (toPar === 0) return 'Par';
  if (toPar === 1) return 'Bogey';
  if (toPar === 2) return 'Double bogey';
  if (toPar === 3) return 'Triple bogey';
  return `+${toPar}`;
}

/** SG compared at 1e-9 so float noise in a sum never decides a tie — round order does. */
const cmpSg = (a: number, b: number) => (Math.abs(a - b) < 1e-9 ? 0 : a - b);

/**
 * Non-overlapping best/worst of up to `max` each, from items already in ROUND ORDER.
 * Best = highest SG first; worst = lowest SG first; ties keep round order in both.
 */
function bestAndWorst<T extends { sg: number }>(inRoundOrder: T[], max: number): { best: T[]; worst: T[] } {
  const total = inRoundOrder.length;
  const bestCount = Math.min(max, Math.ceil(total / 2));
  const worstCount = Math.min(max, total - bestCount);
  const best = [...inRoundOrder].sort((a, b) => cmpSg(b.sg, a.sg)).slice(0, bestCount); // Array.sort is stable
  const worst = [...inRoundOrder]
    .filter((x) => !best.includes(x))
    .sort((a, b) => cmpSg(a.sg, b.sg))
    .slice(0, worstCount);
  return { best, worst };
}

function toRecapShot(s: EnrichedShot): RecapShot {
  return {
    roundId: s.roundId, playedOn: s.playedOn, holeNo: s.holeNo, shotNo: s.shotNo, par: s.par, category: s.category, sg: s.sg,
    text: describeShot(s), penalty: s.penaltyStrokes > 0,
  };
}

export type AreaDrill = {
  roundId: number;
  category: Category;
  label: string;
  /** Every shot in the area that round. */
  shots: number;
  sg: number;
  /** How many of them lost strokes, and how many gained. */
  lost: number;
  gained: number;
  /** The costliest shots, biggest loss first (ties in round order). Only shots that lost strokes. */
  worst: RecapShot[];
};

/** One round, one skill area: where the strokes went, costliest shot first. */
export function drillArea(shots: readonly EnrichedShot[], roundId: number, category: Category, max = 5): AreaDrill {
  const inArea = shots
    .filter((s) => s.roundId === roundId && s.category === category)
    .sort((a, b) => a.holeNo - b.holeNo || a.shotNo - b.shotNo);
  return {
    roundId,
    category,
    label: CATEGORY_LABEL[category],
    shots: inArea.length,
    sg: inArea.reduce((a, s) => a + s.sg, 0),
    lost: inArea.filter((s) => cmpSg(s.sg, 0) < 0).length,
    gained: inArea.filter((s) => cmpSg(s.sg, 0) > 0).length,
    worst: inArea
      .map(toRecapShot)
      .filter((s) => cmpSg(s.sg, 0) < 0)
      .sort((a, b) => cmpSg(a.sg, b.sg))
      .slice(0, max),
  };
}

export function buildRoundRecap(shots: readonly EnrichedShot[]): RoundRecap {
  const byHole = new Map<number, EnrichedShot[]>();
  for (const s of shots) (byHole.get(s.holeNo) ?? byHole.set(s.holeNo, []).get(s.holeNo)!).push(s);

  const holes: RecapHole[] = [];
  for (const [holeNo, hs] of byHole) {
    if (!hs.some((s) => s.holed)) continue; // unfinished hole: no score yet
    const score = hs.length + hs.reduce((a, s) => a + s.penaltyStrokes, 0);
    const par = hs[0]!.par;
    holes.push({ holeNo, par, score, toPar: score - par, result: holeResult(score - par, score), sg: hs.reduce((a, s) => a + s.sg, 0) });
  }
  holes.sort((a, b) => a.holeNo - b.holeNo); // round order
  const h = bestAndWorst(holes, 3);

  const allShots: RecapShot[] = [...shots]
    .sort((a, b) => a.holeNo - b.holeNo || a.shotNo - b.shotNo) // round order
    .map(toRecapShot);
  const long = bestAndWorst(allShots.filter((s) => s.category !== 'PUTTING'), 3);
  const putts = bestAndWorst(allShots.filter((s) => s.category === 'PUTTING'), 3);

  const areaMap = new Map<Category, { sg: number; shots: number }>();
  for (const s of shots) {
    const a = areaMap.get(s.category) ?? { sg: 0, shots: 0 };
    a.sg += s.sg;
    a.shots += 1;
    areaMap.set(s.category, a);
  }
  const areas: RecapArea[] = [...areaMap.entries()]
    .map(([category, a]) => ({ category, label: CATEGORY_LABEL[category], sg: a.sg, shots: a.shots, perShot: a.sg / a.shots }))
    .sort((a, b) => b.sg - a.sg);

  const score = holes.reduce((a, x) => a + x.score, 0);
  const par = holes.reduce((a, x) => a + x.par, 0);
  return {
    holesPlayed: holes.length,
    score,
    par,
    toPar: score - par,
    sgTotal: shots.reduce((a, s) => a + s.sg, 0),
    shotCount: shots.length,
    bestHoles: h.best,
    worstHoles: h.worst,
    otherHoles: holes.filter((x) => !h.best.includes(x) && !h.worst.includes(x)),
    bestShots: { longGame: long.best, putts: putts.best },
    worstShots: { longGame: long.worst, putts: putts.worst },
    strongArea: areas.length >= 2 ? areas[0]! : null,
    weakArea: areas.length >= 2 ? areas[areas.length - 1]! : null,
    areas,
  };
}

// ---------------------------------------------------------------------------
// The story across MANY rounds (the Insights page) — same ideas, averaged.
// Meant for one course at a time, so "hole 13" means the same hole every round.
// ---------------------------------------------------------------------------

export type StoryHole = { holeNo: number; par: number; plays: number; avgSg: number; avgToPar: number; sg: number };
/** `per18` = strokes gained per 18 holes played — fair to part-played rounds, unlike "per round". */
export type StoryArea = RecapArea & { per18: number };

export type CourseStory = {
  rounds: number;
  holesPlayed: number;
  sgPer18: number;
  /** By average SG per play; only holes finished at least once. Non-overlapping, up to 3 each. */
  bestHoles: StoryHole[];
  worstHoles: StoryHole[];
  bestShots: ShotGroups;
  worstShots: ShotGroups;
  strongArea: StoryArea | null;
  weakArea: StoryArea | null;
  areas: StoryArea[];
};

export function buildCourseStory(shots: readonly EnrichedShot[]): CourseStory {
  const roundIds = [...new Set(shots.map((s) => s.roundId))];
  const perRound = roundIds.map((id) => buildRoundRecap(shots.filter((s) => s.roundId === id)));

  // Holes: every finished play of each hole, across rounds.
  const plays = new Map<number, { par: number; sg: number[]; toPar: number[] }>();
  for (const r of perRound) {
    for (const h of [...r.bestHoles, ...r.worstHoles, ...r.otherHoles]) {
      const p = plays.get(h.holeNo) ?? { par: h.par, sg: [], toPar: [] };
      p.sg.push(h.sg);
      p.toPar.push(h.toPar);
      plays.set(h.holeNo, p);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const holes = [...plays.entries()]
    .map(([holeNo, p]) => ({ holeNo, par: p.par, plays: p.sg.length, avgSg: mean(p.sg), avgToPar: mean(p.toPar), sg: mean(p.sg) }))
    .sort((a, b) => a.holeNo - b.holeNo);
  const h = bestAndWorst(holes, 3);

  const all = buildRoundRecap(shots); // shots + areas are fine pooled; only its hole lists are per-round
  const holesPlayed = perRound.reduce((a, r) => a + r.holesPlayed, 0);
  const to18 = holesPlayed > 0 ? 18 / holesPlayed : 0;
  const areas: StoryArea[] = all.areas.map((a) => ({ ...a, per18: a.sg * to18 }));

  return {
    rounds: roundIds.length,
    holesPlayed,
    sgPer18: all.sgTotal * to18,
    bestHoles: h.best,
    worstHoles: h.worst,
    bestShots: all.bestShots,
    worstShots: all.worstShots,
    strongArea: areas.length >= 2 ? areas[0]! : null,
    weakArea: areas.length >= 2 ? areas[areas.length - 1]! : null,
    areas,
  };
}
