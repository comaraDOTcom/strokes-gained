/**
 * Round recap — the story of one round, for the click-through at /rounds/[id]/recap:
 * headline, best/worst holes, best/worst shots, strongest/weakest area. Pure: takes the
 * round's EnrichedShots (display units: feet on the green, yards elsewhere).
 *
 * "Best" and "worst" lists never overlap, and shrink sensibly for short rounds (a 3-hole
 * round gets 2 best + 1 worst, not the same holes twice). Only FINISHED holes count as holes;
 * every logged shot counts as a shot.
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
export type RecapShot = { holeNo: number; shotNo: number; par: number; category: Category; sg: number; text: string; penalty: boolean };
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
  bestShots: RecapShot[];
  worstShots: RecapShot[];
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
    .map((s) => ({
      holeNo: s.holeNo, shotNo: s.shotNo, par: s.par, category: s.category, sg: s.sg,
      text: describeShot(s), penalty: s.penaltyStrokes > 0,
    }));
  const sh = bestAndWorst(allShots, 5);

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
    bestShots: sh.best,
    worstShots: sh.worst,
    strongArea: areas.length >= 2 ? areas[0]! : null,
    weakArea: areas.length >= 2 ? areas[areas.length - 1]! : null,
    areas,
  };
}
