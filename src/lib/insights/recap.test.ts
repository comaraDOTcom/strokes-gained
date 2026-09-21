import { describe, it, expect } from 'vitest';
import { buildRoundRecap, describeShot, holeResult } from './recap';
import type { EnrichedShot } from './aggregate';

const shot = (o: Partial<EnrichedShot> & { holeNo: number; shotNo: number; sg: number }): EnrichedShot => ({
  roundId: 1, playedOn: '2026-09-20', courseId: 1, courseName: 'Elm Park', teeId: 1, teeName: 'Blue',
  par: 4, startLie: 'FAIRWAY', startDistance: 150, endLie: 'GREEN', endDistance: 20, holed: false,
  penaltyStrokes: 0, penaltyType: null, category: 'APPROACH', bunkerSubtype: null, ...o,
});
/** A finished hole: `sgs` = SG of each shot, last one holed. */
const hole = (holeNo: number, par: number, sgs: number[], cat: EnrichedShot['category'] = 'APPROACH') =>
  sgs.map((sg, i) => shot({ holeNo, shotNo: i + 1, par, sg, category: cat, holed: i === sgs.length - 1 }));

describe('describeShot', () => {
  it('reads like a sentence, in yards off the green and feet on it', () => {
    expect(describeShot(shot({ holeNo: 1, shotNo: 2, sg: 0 }))).toBe('150y from the fairway to 20ft');
    expect(describeShot(shot({ holeNo: 1, shotNo: 1, sg: 0, startLie: 'TEE', startDistance: 413, endLie: 'ROUGH', endDistance: 140 }))).toBe('413y off the tee to 140y in the rough');
    expect(describeShot(shot({ holeNo: 1, shotNo: 3, sg: 0, startLie: 'GREEN', startDistance: 22, endLie: null, endDistance: 0, holed: true }))).toBe('22ft putt, holed');
    expect(describeShot(shot({ holeNo: 1, shotNo: 2, sg: 0, startLie: 'SAND', startDistance: 18, endLie: null, endDistance: 0, holed: true }))).toBe('18y from the sand — holed!');
  });
  it('names penalties', () => {
    expect(describeShot(shot({ holeNo: 1, shotNo: 1, sg: -2, startLie: 'TEE', startDistance: 400, endLie: 'TEE', endDistance: 400, penaltyStrokes: 1, penaltyType: 'STROKE_AND_DISTANCE' }))).toBe('400y off the tee, lost ball / out of bounds — replayed');
    expect(describeShot(shot({ holeNo: 1, shotNo: 1, sg: -1, endLie: 'ROUGH', endDistance: 60, penaltyStrokes: 1, penaltyType: 'LATERAL' }))).toBe('150y from the fairway to 60y in the rough (+1 penalty)');
  });
});

describe('holeResult', () => {
  it('names the score', () => {
    expect([-2, -1, 0, 1, 2, 3, 4].map((d) => holeResult(d, 4 + d))).toEqual(['Eagle', 'Birdie', 'Par', 'Bogey', 'Double bogey', 'Triple bogey', '+4']);
    expect(holeResult(-2, 1)).toBe('Hole in one');
  });
});

describe('buildRoundRecap', () => {
  const round = [
    ...hole(1, 4, [0.3, 0.2, 0.1, 0.4]),          // +1.0  par
    ...hole(2, 4, [-0.5, -0.6, -0.4, -0.3, -0.2]), // -2.0  bogey
    ...hole(3, 3, [0.6, 0.9]),                     // +1.5  birdie
    ...hole(4, 5, [0, 0, 0, 0, -0.1]),             // -0.1  par
    ...hole(5, 4, [-1.2, -0.1, -0.1, -0.1, -0.1, -0.4], 'PUTTING'), // -2.0 double
    ...hole(6, 4, [0.1, 0.1, 0.1, 0.2]),           // +0.5
    ...hole(7, 4, [-0.2, -0.2, -0.2, -0.2, -0.1]), // -0.9
    shot({ holeNo: 8, shotNo: 1, sg: 0.8, startLie: 'TEE', category: 'OFF_THE_TEE' }), // unfinished hole
  ];

  it('totals only finished holes for the score, but every shot for SG', () => {
    const r = buildRoundRecap(round);
    expect(r.holesPlayed).toBe(7);
    expect(r.score).toBe(4 + 5 + 2 + 5 + 6 + 4 + 5);
    expect(r.par).toBe(28);
    expect(r.shotCount).toBe(round.length);
    expect(r.sgTotal).toBeCloseTo(round.reduce((a, s) => a + s.sg, 0));
  });

  it('picks the best 3 and worst 3 holes by SG, worst first, never overlapping', () => {
    const r = buildRoundRecap(round);
    expect(r.bestHoles.map((h) => h.holeNo)).toEqual([3, 1, 6]);
    expect(r.worstHoles.map((h) => h.holeNo)).toEqual([2, 5, 7]); // tie at -2.0 broken by hole order
    expect(r.bestHoles[0]).toMatchObject({ result: 'Birdie', toPar: -1 });
    expect(r.worstHoles[1]).toMatchObject({ result: 'Double bogey' });
  });

  it('picks the best 5 and worst 5 shots, including shots on an unfinished hole', () => {
    const r = buildRoundRecap(round);
    expect(r.bestShots.map((s) => s.sg)).toEqual([0.9, 0.8, 0.6, 0.4, 0.3]);
    expect(r.bestShots[1]).toMatchObject({ holeNo: 8, category: 'OFF_THE_TEE' });
    expect(r.worstShots[0]).toMatchObject({ holeNo: 5, shotNo: 1, sg: -1.2 });
    expect(r.worstShots).toHaveLength(5);
  });

  it('shrinks the lists for a short round instead of repeating holes', () => {
    const r = buildRoundRecap([...hole(1, 4, [0.5, 0.5]), ...hole(2, 4, [-1, -1]), ...hole(3, 4, [0.1, 0.1])]);
    expect(r.bestHoles.map((h) => h.holeNo)).toEqual([1, 3]);
    expect(r.worstHoles.map((h) => h.holeNo)).toEqual([2]);
    const one = buildRoundRecap(hole(1, 4, [0.2]));
    expect(one.bestHoles).toHaveLength(1);
    expect(one.worstHoles).toHaveLength(0);
    expect(one.bestShots).toHaveLength(1);
    expect(one.worstShots).toHaveLength(0);
  });

  it('names the strongest and weakest area with shot counts', () => {
    const r = buildRoundRecap(round);
    expect(r.strongArea).toMatchObject({ category: 'OFF_THE_TEE', shots: 1 });
    expect(r.weakArea).toMatchObject({ category: 'PUTTING', label: 'Putting', shots: 6 });
    expect(r.weakArea!.perShot).toBeCloseTo(-2 / 6);
    expect(buildRoundRecap(hole(1, 4, [0.2, 0.1])).strongArea).toBeNull(); // one category: nothing to compare
  });

  it('handles an empty round', () => {
    expect(buildRoundRecap([])).toMatchObject({ holesPlayed: 0, score: 0, shotCount: 0, bestHoles: [], worstShots: [], strongArea: null });
  });
});
