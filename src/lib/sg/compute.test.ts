import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeHole, type ShotInput } from './compute';
import { expectedStrokes } from './interpolate';
import type { Lie } from './baseline-scratch';

describe('computeHole — golden hole (Elm Park Blue hole 2, 413y par 4)', () => {
  const holeYards = 413;
  const par = 4;
  const shots: ShotInput[] = [
    {
      holeNo: 2, shotNo: 1,
      startLie: 'TEE', startDistance: 413,
      endLie: 'FAIRWAY', endDistance: 150,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    },
    {
      holeNo: 2, shotNo: 2,
      startLie: 'FAIRWAY', startDistance: 150,
      endLie: 'GREEN', endDistance: 20,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    },
    {
      holeNo: 2, shotNo: 3,
      startLie: 'GREEN', startDistance: 20,
      endLie: null, endDistance: 0,
      holed: true, penaltyStrokes: 0, penaltyType: null,
    },
  ];

  const results = computeHole(shots, holeYards, par);

  it('shot 1 (TEE 413 -> FAIRWAY 150): SG = +0.032', () => {
    expect(results[0]!.sg).toBeCloseTo(0.032, 3);
  });

  it('shot 2 (FAIRWAY 150 -> GREEN 20ft): SG = +0.180', () => {
    expect(results[1]!.sg).toBeCloseTo(0.18, 3);
  });

  it('shot 3 (GREEN 20ft -> holed): SG = +0.930', () => {
    expect(results[2]!.sg).toBeCloseTo(0.93, 3);
  });

  it('total SG = +1.142 = E(TEE,413) - 3', () => {
    const total = results.reduce((sum, r) => sum + r.sg, 0);
    expect(expectedStrokes('TEE', 413)).toBeCloseTo(4.142, 3);
    expect(total).toBeCloseTo(1.142, 3);
    expect(total).toBeCloseTo(expectedStrokes('TEE', 413) - 3, 3);
  });
});

describe('computeHole — recovery vs fairway finish (300y par 4, drive leaves 60y)', () => {
  const holeYards = 300;
  const par = 4;

  const recoveryShot: ShotInput = {
    holeNo: 1, shotNo: 1,
    startLie: 'TEE', startDistance: 300,
    endLie: 'RECOVERY', endDistance: 60,
    holed: false, penaltyStrokes: 0, penaltyType: null,
  };
  const fairwayShot: ShotInput = {
    holeNo: 1, shotNo: 1,
    startLie: 'TEE', startDistance: 300,
    endLie: 'FAIRWAY', endDistance: 60,
    holed: false, penaltyStrokes: 0, penaltyType: null,
  };

  const recoverySg = computeHole([recoveryShot], holeYards, par)[0]!.sg;
  const fairwaySg = computeHole([fairwayShot], holeYards, par)[0]!.sg;

  it('ending in RECOVERY: SG = -0.69', () => {
    expect(recoverySg).toBeCloseTo(-0.69, 3);
  });

  it('ending in FAIRWAY: SG = -0.14', () => {
    expect(fairwaySg).toBeCloseTo(-0.14, 3);
  });

  it('the recovery finish is strictly worse, by ~0.55 strokes', () => {
    expect(recoverySg).toBeLessThan(fairwaySg);
    expect(fairwaySg - recoverySg).toBeCloseTo(0.55, 2);
  });
});

describe('computeHole — OB tee shot, stroke and distance', () => {
  it('SG === -2.0 exactly', () => {
    const holeYards = 400;
    const shot: ShotInput = {
      holeNo: 1, shotNo: 1,
      startLie: 'TEE', startDistance: 400,
      // These end fields should be IGNORED and overridden by the engine,
      // because penaltyType is STROKE_AND_DISTANCE.
      endLie: 'FAIRWAY', endDistance: 250,
      holed: false, penaltyStrokes: 1, penaltyType: 'STROKE_AND_DISTANCE',
    };
    const [result] = computeHole([shot], holeYards, 4);
    expect(result!.sg).toBe(-2.0);
    // The forced end position must equal the start position.
    expect(result!.endLie).toBe('TEE');
    expect(result!.endDistance).toBe(400);
  });

  it('throws if the caller tries to skip stroke-and-distance re-tee by mismatching the next shot start', () => {
    const holeYards = 400;
    const obShot: ShotInput = {
      holeNo: 1, shotNo: 1,
      startLie: 'TEE', startDistance: 400,
      endLie: 'FAIRWAY', endDistance: 250,
      holed: false, penaltyStrokes: 1, penaltyType: 'STROKE_AND_DISTANCE',
    };
    const badNextShot: ShotInput = {
      holeNo: 1, shotNo: 2,
      // Wrong: should be TEE 400 (the re-tee spot), not FAIRWAY 250.
      startLie: 'FAIRWAY', startDistance: 250,
      endLie: 'GREEN', endDistance: 20,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    };
    expect(() => computeHole([obShot, badNextShot], holeYards, 4)).toThrow(/broken chain/i);
  });
});

describe('computeHole — chain and structural validation', () => {
  it('throws if shot 1 does not start from TEE at holeYards', () => {
    const bad: ShotInput = {
      holeNo: 1, shotNo: 1,
      startLie: 'FAIRWAY', startDistance: 150,
      endLie: 'GREEN', endDistance: 20,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    };
    expect(() => computeHole([bad], 400, 4)).toThrow();
  });

  it('throws on a broken chain (shot n start != shot n-1 end)', () => {
    const s1: ShotInput = {
      holeNo: 1, shotNo: 1,
      startLie: 'TEE', startDistance: 400,
      endLie: 'FAIRWAY', endDistance: 150,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    };
    const s2: ShotInput = {
      holeNo: 1, shotNo: 2,
      startLie: 'FAIRWAY', startDistance: 140, // should be 150
      endLie: 'GREEN', endDistance: 20,
      holed: false, penaltyStrokes: 0, penaltyType: null,
    };
    expect(() => computeHole([s1, s2], 400, 4)).toThrow(/broken chain/i);
  });

  it('throws if a shot follows an already-holed shot', () => {
    const s1: ShotInput = {
      holeNo: 1, shotNo: 1,
      startLie: 'TEE', startDistance: 150,
      endLie: null, endDistance: 0,
      holed: true, penaltyStrokes: 0, penaltyType: null,
    };
    const s2: ShotInput = {
      holeNo: 1, shotNo: 2,
      startLie: 'GREEN', startDistance: 5,
      endLie: null, endDistance: 0,
      holed: true, penaltyStrokes: 0, penaltyType: null,
    };
    expect(() => computeHole([s1, s2], 150, 3)).toThrow();
  });
});

describe('computeHole — invariant property test', () => {
  const NON_TEE_LIES: Lie[] = ['FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY', 'GREEN'];

  const stepArb = fc.record({
    lie: fc.constantFrom(...NON_TEE_LIES),
    rawDistance: fc.integer({ min: 1, max: 300 }),
    penaltyStrokes: fc.constantFrom(0, 1),
  });

  const chainArb = fc.record({
    holeYards: fc.integer({ min: 100, max: 600 }),
    par: fc.constantFrom(3, 4, 5),
    steps: fc.array(stepArb, { minLength: 0, maxLength: 4 }),
  });

  function distanceFor(lie: Lie, raw: number): number {
    const max = lie === 'GREEN' ? 100 : 300;
    return 1 + (raw % max);
  }

  it('sum(SG) === E(TEE, holeYards) - grossScore for any valid, randomly generated shot chain', () => {
    fc.assert(
      fc.property(chainArb, ({ holeYards, par, steps }) => {
        const shots: ShotInput[] = [];
        let curLie: Lie = 'TEE';
        let curDistance = holeYards;
        let shotNo = 1;

        for (const step of steps) {
          const distance = distanceFor(step.lie, step.rawDistance);
          shots.push({
            holeNo: 1, shotNo,
            startLie: curLie, startDistance: curDistance,
            endLie: step.lie, endDistance: distance,
            holed: false,
            penaltyStrokes: step.penaltyStrokes,
            penaltyType: step.penaltyStrokes > 0 ? 'LATERAL' : null,
          });
          curLie = step.lie;
          curDistance = distance;
          shotNo++;
        }

        // Final shot always holes out from wherever the chain left off.
        shots.push({
          holeNo: 1, shotNo,
          startLie: curLie, startDistance: curDistance,
          endLie: null, endDistance: 0,
          holed: true, penaltyStrokes: 0, penaltyType: null,
        });

        const results = computeHole(shots, holeYards, par);

        const sumSg = results.reduce((sum, r) => sum + r.sg, 0);
        const grossScore = results.length + results.reduce((sum, r) => sum + r.penaltyStrokes, 0);
        const expected = expectedStrokes('TEE', holeYards) - grossScore;

        expect(Math.abs(sumSg - expected)).toBeLessThan(1e-6);
      }),
      { numRuns: 500 },
    );
  });
});
