import { describe, expect, it } from 'vitest';
import type { EnrichedShot } from '../insights/aggregate';
import {
  DEFAULT_PLAN_ROUNDS,
  MIN_PLAN_ROUNDS,
  buildPracticePlan,
  focusFor,
  formatRange,
  parsePlanRounds,
  planSentence,
  type PracticePlan,
} from './plan';

function shot(o: Partial<EnrichedShot>): EnrichedShot {
  return {
    roundId: 1,
    playedOn: '2026-01-01',
    courseId: 1,
    courseName: 'Elm Park',
    teeId: 1,
    teeName: 'Blue',
    holeNo: 1,
    par: 4,
    shotNo: 1,
    startLie: 'TEE',
    startDistance: 400,
    endLie: 'FAIRWAY',
    endDistance: 150,
    holed: false,
    penaltyStrokes: 0,
    penaltyType: null,
    sg: 0,
    category: 'OFF_THE_TEE',
    bunkerSubtype: null,
    missDirection: null,
    puttSlope: null,
    puttBreak: null,
    ...o,
  };
}
const approach = (yards: number, sg: number) => ({ category: 'APPROACH' as const, startLie: 'FAIRWAY' as const, startDistance: yards, sg });
const putt = (feet: number, sg: number) => ({ category: 'PUTTING' as const, startLie: 'GREEN' as const, startDistance: feet, sg });
const bunker = (yards: number, sg: number) => ({
  category: 'BUNKER' as const,
  startLie: 'SAND' as const,
  startDistance: yards,
  sg,
  bunkerSubtype: (yards <= 30 ? 'greenside' : 'fairway') as 'greenside' | 'fairway',
});

/**
 * `n` rounds, each `holes` holes long (a zero-SG tee shot per hole so the per-18 maths is exact),
 * plus whatever `perRound(r)` adds. Round ids run backwards so the tests prove the plan orders
 * rounds by date, not id.
 */
function rounds(n: number, perRound: (r: number) => Partial<EnrichedShot>[], holes = 18): EnrichedShot[] {
  const out: EnrichedShot[] = [];
  for (let r = 0; r < n; r++) {
    const roundId = 100 - r;
    const playedOn = `2026-${String(r + 1).padStart(2, '0')}-01`;
    for (let h = 1; h <= holes; h++) out.push(shot({ roundId, playedOn, holeNo: h }));
    perRound(r).forEach((o, i) => out.push(shot({ roundId, playedOn, holeNo: (i % holes) + 1, ...o })));
  }
  return out;
}

const ready = (p: PracticePlan) => {
  if (p.status !== 'ready') throw new Error(`expected a plan, got ${p.status}`);
  return p;
};

describe('buildPracticePlan: when there is a plan', () => {
  it('needs at least 3 rounds', () => {
    expect(MIN_PLAN_ROUNDS).toBe(3);
    expect(buildPracticePlan(rounds(2, () => [approach(150, -1)]))).toEqual({
      status: 'not-enough-rounds',
      roundsTotal: 2,
      minRounds: 3,
    });
    expect(buildPracticePlan([]).status).toBe('not-enough-rounds');
    expect(ready(buildPracticePlan(rounds(3, () => [approach(150, -1)]))).roundsUsed).toBe(3);
  });

  it('uses the last 6 rounds by date by default, or the window asked for', () => {
    expect(DEFAULT_PLAN_ROUNDS).toBe(6);
    // Rounds 0–1 lose heavily on putts; the last six lose only on approach.
    const shots = rounds(8, (r) => (r < 2 ? [putt(5, -5)] : [approach(150, -0.5)]));
    const p = ready(buildPracticePlan(shots));
    expect(p.roundsUsed).toBe(6);
    expect(p.roundsTotal).toBe(8);
    expect(p.firstPlayedOn).toBe('2026-03-01');
    expect(p.lastPlayedOn).toBe('2026-08-01');
    expect(p.items.map((i) => i.area)).toEqual(['APPROACH']);
    // All 8 rounds: putting's 10 strokes over 8 rounds (1.25 a round) outranks approach's 0.375.
    expect(ready(buildPracticePlan(shots, { roundWindow: 8 })).items.map((i) => i.area)).toEqual(['PUTTING', 'APPROACH']);
    // A window under 3 is raised to 3.
    expect(ready(buildPracticePlan(shots, { roundWindow: 1 })).roundsUsed).toBe(3);
  });
});

describe('buildPracticePlan: ranking', () => {
  it('ranks parts of the game by strokes lost a round, top 3, skipping areas that gain', () => {
    const shots = rounds(6, () => [
      approach(150, -0.5), // 0.5 a round
      putt(6, -0.3), // 0.3
      bunker(15, -0.2), // 0.2
      { category: 'SHORT_GAME', startLie: 'ROUGH', startDistance: 15, sg: -0.1 }, // 0.1: 4th, dropped
      { category: 'OFF_THE_TEE', sg: 0.4 }, // gains: never a priority
    ]);
    const p = ready(buildPracticePlan(shots));
    expect(p.items.map((i) => [i.area, Number(i.strokesPerRound.toFixed(3))])).toEqual([
      ['APPROACH', 0.5],
      ['PUTTING', 0.3],
      ['BUNKER', 0.2],
    ]);
  });

  it('prices a 9-hole round as half a round', () => {
    // Three 9-hole rounds losing 0.5 each on approach = 1.5 strokes over 27 holes = 1.0 per 18.
    const p = ready(buildPracticePlan(rounds(3, () => [approach(150, -0.5)], 9)));
    expect(p.holes).toBe(27);
    expect(p.items[0]!.strokesPerRound).toBeCloseTo(1, 9);
  });

  it('is empty when nothing loses strokes', () => {
    const p = ready(buildPracticePlan(rounds(4, () => [putt(6, 0.2), approach(150, 0.1)])));
    expect(p.items).toEqual([]);
  });

  it('ignores an area losing under 0.05 a round (it would print as 0.0)', () => {
    const p = ready(buildPracticePlan(rounds(6, () => [putt(6, -0.04), approach(150, -0.5)])));
    expect(p.items.map((i) => i.area)).toEqual(['APPROACH']);
  });
});

describe('focus range', () => {
  it('finds the costliest 30-yard approach window (worked example: 140–170 yards)', () => {
    // Every round: 145y and 165y cost 0.4 each; 120y and 190y are level with scratch.
    // Only (140, 170] holds both costly shots: 0.8 a round over 12 shots.
    const shots = rounds(6, () => [approach(120, 0), approach(145, -0.4), approach(165, -0.4), approach(190, 0)]);
    const item = ready(buildPracticePlan(shots)).items[0]!;
    expect(item.focus).toMatchObject({ label: '140–170 yards', range: { min: 140, max: 170 }, attempts: 12 });
    expect(item.focus!.strokesPerRound).toBeCloseTo(0.8, 9);
    expect(item.drills.map((d) => d.id)).toEqual(['approach-ladder']);
    expect(item.sentence).toBe(
      'You lose 0.8 strokes a round on approach shots. Shots from 140–170 yards cost the most: 0.8 a round over 12 shots.',
    );
  });

  it('says so when the range loses more than the whole area', () => {
    // 145y and 165y lose 0.6 each a round; 200y gains 0.7: the area loses 0.5, the range 1.2.
    const shots = rounds(6, () => [approach(145, -0.6), approach(165, -0.6), approach(200, 0.7)]);
    const item = ready(buildPracticePlan(shots)).items[0]!;
    expect(item.sentence).toBe(
      'You lose 0.5 strokes a round on approach shots. Shots from 140–170 yards cost the most: 1.2 a round over 12 shots. You win some of that back from other distances.',
    );
  });

  it('never names a range on one or two shots', () => {
    // One 230-yard disaster costs more than anything else, but a range needs 3 shots in it.
    const shots = rounds(6, (r) => [approach(80, -0.2), approach(85, -0.2), ...(r === 0 ? [approach(230, -3)] : [])]);
    const item = ready(buildPracticePlan(shots)).items[0]!;
    expect(item.focus!.label).toBe('60–90 yards');
    expect(item.drills.map((d) => d.id)).toEqual(['wedge-matrix']);
  });

  it('uses the drill-shaped putting ranges and bunker types', () => {
    const shots = rounds(6, () => [putt(5, -0.3), putt(7, -0.2), putt(40, -0.1), putt(2, 0.02)]);
    const item = ready(buildPracticePlan(shots)).items[0]!;
    expect(item.focus).toMatchObject({ label: '4–8 ft', attempts: 12 });
    expect(item.drills.map((d) => d.id)).toEqual(['circle-putting']);
    expect(item.sentence).toContain('Putts from 4–8 ft cost the most: 0.5 a round over 12 shots.');

    const b = ready(buildPracticePlan(rounds(3, () => [bunker(12, -0.5), bunker(60, -0.1)]))).items[0]!;
    expect(b.focus).toMatchObject({ label: 'greenside bunkers', bunkerSubtype: 'greenside', attempts: 3 });
    expect(b.drills.map((d) => d.id)).toEqual(['bunker-to-10ft']);
    expect(b.sentence).toContain('Greenside bunkers cost the most');
  });

  it('has no range off the tee, and says when the library has no drill yet', () => {
    const shots = rounds(3, () => [{ category: 'OFF_THE_TEE', sg: -1, penaltyStrokes: 1 }]);
    const item = ready(buildPracticePlan(shots)).items[0]!;
    expect(item.focus).toBeNull();
    expect(item.drills).toEqual([]);
    expect(item.penaltyStrokes).toBe(3);
    expect(item.sentence).toBe('You lose 1.0 strokes a round off the tee, including 3 penalty strokes.');
  });

  it('puts a shot from exactly 140 yards in 110–140, not 140–170', () => {
    const f = focusFor('APPROACH', [140, 140, 140].map((d) => shot(approach(d, -1))), 18)!;
    expect(f.range).toEqual({ min: 110, max: 140 });
  });

  it('is null when no range with enough shots loses strokes', () => {
    expect(focusFor('APPROACH', [shot(approach(150, -1)), shot(approach(150, -1))], 18)).toBeNull();
    expect(focusFor('APPROACH', [150, 155, 160].map((d) => shot(approach(d, 0.1))), 18)).toBeNull();
  });
});

describe('planSentence', () => {
  it('flags a small sample', () => {
    const s = planSentence({
      area: 'BUNKER',
      label: 'Bunker play',
      strokesPerRound: 0.4,
      sgTotal: -1.2,
      attempts: 4,
      penaltyStrokes: 0,
      focus: null,
      drills: [],
      smallSample: true,
    });
    expect(s).toBe('You lose 0.4 strokes a round from bunkers. Only 4 shots so far, so treat it as a hint.');
  });
});

describe('parsePlanRounds and formatRange', () => {
  it('takes a whole number from 3 to 20, else 6', () => {
    expect(parsePlanRounds('10')).toBe(10);
    expect(parsePlanRounds(['3'])).toBe(3);
    for (const bad of [undefined, '', '2', '21', '4.5', 'abc']) expect(parsePlanRounds(bad)).toBe(6);
  });

  it('labels open-ended ranges', () => {
    expect(formatRange({ min: 50, max: Infinity }, 'ft')).toBe('50+ ft');
    expect(formatRange({ min: 140, max: 170 }, 'yd')).toBe('140–170 yards');
  });
});
