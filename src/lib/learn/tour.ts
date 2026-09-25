/**
 * The scroll-through strokes-gained tour on /learn: one bogey on a 400-yard par 4,
 * shot by shot. Every number comes from the real engine (`computeHole`, `expectedStrokes`),
 * so the tour can never disagree with what a player sees on their own rounds.
 */
import type { Lie } from '../sg/baseline-scratch';
import { computeHole, type ShotInput } from '../sg/compute';
import { expectedStrokes } from '../sg/interpolate';
import { fmtSg } from '../insights/chart-colors';

export const TOUR_HOLE = { yards: 400, par: 4 } as const;

/** A point on the hole diagram (viewBox 0 0 200 420: green at the top, tee at the bottom). */
export type Pt = { x: number; y: number };

type Plan = { endLie: Lie | null; endDistance: number; at: Pt; title: string; story: string };

/** The bogey, as a player would log it (distances in display units: feet on the green). */
const PLAN: Plan[] = [
  { endLie: 'FAIRWAY', endDistance: 130, at: { x: 92, y: 162 }, title: 'The drive', story: 'A good drive leaves 130 yards from the fairway.' },
  { endLie: 'SAND', endDistance: 12, at: { x: 58, y: 70 }, title: 'The approach', story: 'The approach comes up short and left, in the greenside bunker.' },
  { endLie: 'GREEN', endDistance: 6, at: { x: 110, y: 58 }, title: 'The bunker shot', story: 'A good splash out to 6 feet.' },
  { endLie: 'GREEN', endDistance: 2, at: { x: 104, y: 46 }, title: 'The first putt', story: 'The 6-footer slides by, 2 feet past.' },
  { endLie: null, endDistance: 0, at: { x: 100, y: 42 }, title: 'The tap-in', story: 'In. Five strokes: a bogey.' },
];

const TEE_AT: Pt = { x: 100, y: 396 };

const LIE_WORD: Record<Lie, string> = {
  TEE: 'on the tee',
  FAIRWAY: 'in the fairway',
  ROUGH: 'in the rough',
  SAND: 'in the bunker',
  RECOVERY: 'in a recovery position',
  GREEN: 'on the green',
};

export type TourPosition = { lie: Lie | null; distance: number; unit: 'y' | 'ft' | null; expected: number; at: Pt; label: string };

export type TourShot = {
  shotNo: number;
  title: string;
  story: string;
  from: TourPosition;
  to: TourPosition;
  sg: number;
  /** "4.09 − 3.03 − 1 = +0.06" */
  sum: string;
  /** Running total after this shot. */
  runningSg: number;
};

export type Tour = {
  yards: number;
  par: number;
  teeExpected: number;
  shots: TourShot[];
  totalSg: number;
  strokes: number;
};

const fmt2 = (v: number) => v.toFixed(2);

function position(lie: Lie | null, distance: number, at: Pt): TourPosition {
  if (lie === null) return { lie, distance: 0, unit: null, expected: 0, at, label: 'in the hole' };
  const unit = lie === 'GREEN' ? 'ft' : 'y';
  return { lie, distance, unit, expected: expectedStrokes(lie, distance), at, label: `${distance}${unit} ${LIE_WORD[lie]}` };
}

export function buildTour(): Tour {
  const inputs: ShotInput[] = [];
  let lie: Lie = 'TEE';
  let dist: number = TOUR_HOLE.yards;
  PLAN.forEach((p, i) => {
    inputs.push({
      holeNo: 1,
      shotNo: i + 1,
      startLie: lie,
      startDistance: dist,
      endLie: p.endLie,
      endDistance: p.endDistance,
      holed: p.endLie === null,
      penaltyStrokes: 0,
      penaltyType: null,
    });
    if (p.endLie) {
      lie = p.endLie;
      dist = p.endDistance;
    }
  });
  const scored = computeHole(inputs, TOUR_HOLE.yards, TOUR_HOLE.par);

  let running = 0;
  let prevAt = TEE_AT;
  const shots: TourShot[] = scored.map((s, i) => {
    const plan = PLAN[i]!;
    const from = position(s.startLie, s.startDistance, prevAt);
    const to = position(s.endLie, s.endDistance, plan.at);
    prevAt = plan.at;
    running += s.sg;
    return {
      shotNo: s.shotNo,
      title: plan.title,
      story: plan.story,
      from,
      to,
      sg: s.sg,
      sum: `${fmt2(from.expected)} − ${fmt2(to.expected)} − 1 = ${fmtSg(s.sg)}`,
      runningSg: running,
    };
  });

  return {
    yards: TOUR_HOLE.yards,
    par: TOUR_HOLE.par,
    teeExpected: expectedStrokes('TEE', TOUR_HOLE.yards),
    shots,
    totalSg: running,
    strokes: shots.length,
  };
}
