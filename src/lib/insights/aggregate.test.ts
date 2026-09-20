import { describe, expect, it } from 'vitest';
import {
  roundSummaries,
  categorySeries,
  latestVsPriorMean,
  rollingAverageByCategory,
  impliedMakeRate,
  puttingBandStats,
  penaltyAndRecoveryByHole,
  type EnrichedShot,
} from './aggregate';
import { expectedStrokes } from '../sg/interpolate';

function shot(overrides: Partial<EnrichedShot>): EnrichedShot {
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
    ...overrides,
  };
}

describe('roundSummaries', () => {
  it('sums gross score, SG total and SG by category for a simple 1-hole round', () => {
    const shots: EnrichedShot[] = [
      shot({ shotNo: 1, startLie: 'TEE', startDistance: 413, endLie: 'FAIRWAY', endDistance: 150, sg: 0.032, category: 'OFF_THE_TEE' }),
      shot({ shotNo: 2, startLie: 'FAIRWAY', startDistance: 150, endLie: 'GREEN', endDistance: 20, sg: 0.18, category: 'APPROACH' }),
      shot({ shotNo: 3, startLie: 'GREEN', startDistance: 20, endLie: null, endDistance: 0, holed: true, sg: 0.93, category: 'PUTTING' }),
    ];
    const [summary] = roundSummaries(shots);
    expect(summary!.grossScore).toBe(3);
    expect(summary!.par).toBe(4);
    expect(summary!.sgTotal).toBeCloseTo(1.142, 3);
    expect(summary!.sgByCategory.OFF_THE_TEE).toBeCloseTo(0.032, 3);
    expect(summary!.sgByCategory.APPROACH).toBeCloseTo(0.18, 3);
    expect(summary!.sgByCategory.PUTTING).toBeCloseTo(0.93, 3);
    expect(summary!.traditional.girCount).toBe(1);
    expect(summary!.traditional.girTotal).toBe(1);
  });

  it('orders newest round first', () => {
    const older = shot({ roundId: 1, playedOn: '2026-01-01' });
    const newer = shot({ roundId: 2, playedOn: '2026-02-01' });
    const summaries = roundSummaries([older, newer]);
    expect(summaries[0]!.roundId).toBe(2);
    expect(summaries[1]!.roundId).toBe(1);
  });
});

describe('categorySeries + latestVsPriorMean', () => {
  it('computes latest vs mean of prior rounds per category', () => {
    const shots: EnrichedShot[] = [
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'PUTTING', sg: -1.0 }),
      shot({ roundId: 2, playedOn: '2026-01-08', category: 'PUTTING', sg: -0.5 }),
      shot({ roundId: 3, playedOn: '2026-01-15', category: 'PUTTING', sg: 0.0 }),
      shot({ roundId: 4, playedOn: '2026-01-22', category: 'PUTTING', sg: 1.0 }),
    ];
    const series = categorySeries(shots);
    const result = latestVsPriorMean(series, 3);
    const putting = result.find((r) => r.category === 'PUTTING')!;
    expect(putting.latestSg).toBe(1.0);
    expect(putting.priorMeanSg).toBeCloseTo((-1.0 - 0.5 + 0.0) / 3, 6);
    expect(putting.delta).toBeCloseTo(1.0 - (-1.5 / 3), 6);
    expect(putting.priorRoundCount).toBe(3);
  });

  it('returns nothing for a category with fewer than 2 rounds of history', () => {
    const shots: EnrichedShot[] = [shot({ roundId: 1, category: 'BUNKER', sg: -0.2 })];
    expect(latestVsPriorMean(categorySeries(shots))).toEqual([]);
  });
});

describe('rollingAverageByCategory', () => {
  it('is a trailing window average, capped at windowSize', () => {
    const shots: EnrichedShot[] = [
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'OFF_THE_TEE', sg: 1 }),
      shot({ roundId: 2, playedOn: '2026-01-08', category: 'OFF_THE_TEE', sg: 2 }),
      shot({ roundId: 3, playedOn: '2026-01-15', category: 'OFF_THE_TEE', sg: 3 }),
      shot({ roundId: 4, playedOn: '2026-01-22', category: 'OFF_THE_TEE', sg: 4 }),
    ];
    const rolling = rollingAverageByCategory(categorySeries(shots), 3);
    // round 4's rolling avg should be mean of rounds 2,3,4 = 3
    expect(rolling.find((r) => r.roundId === 4)!.rollingAvg).toBeCloseTo(3, 6);
    // round 2's rolling avg should be mean of rounds 1,2 = 1.5 (window not full yet)
    expect(rolling.find((r) => r.roundId === 2)!.rollingAvg).toBeCloseTo(1.5, 6);
  });
});

describe('impliedMakeRate', () => {
  it('is ~1.0 very close to the hole and 0 at the two-putt crossover', () => {
    expect(impliedMakeRate(1)).toBeCloseTo(2 - expectedStrokes('GREEN', 1), 6);
    expect(impliedMakeRate(1)).toBeGreaterThan(0.9);
    // Crossover is 24-26ft per the baseline structural test; comfortably past it should clamp to 0.
    expect(impliedMakeRate(60)).toBe(0);
  });

  it('is monotonically decreasing with distance', () => {
    expect(impliedMakeRate(3)).toBeGreaterThan(impliedMakeRate(10));
    expect(impliedMakeRate(10)).toBeGreaterThan(impliedMakeRate(25));
  });
});

describe('puttingBandStats', () => {
  it('computes make% and compares to the implied baseline', () => {
    const shots: EnrichedShot[] = [
      shot({ category: 'PUTTING', startLie: 'GREEN', startDistance: 2, holed: true, sg: 0.5 }),
      shot({ category: 'PUTTING', startLie: 'GREEN', startDistance: 2, holed: false, endLie: 'GREEN', endDistance: 1, sg: -0.2 }),
    ];
    const [band] = puttingBandStats(shots);
    expect(band!.band).toBe('0-3ft');
    expect(band!.attempts).toBe(2);
    expect(band!.makes).toBe(1);
    expect(band!.makePct).toBeCloseTo(0.5, 6);
    expect(band!.impliedBaselineMakePct).toBeGreaterThan(0.9); // very short putts are ~always implied-holed
  });
});

describe('penaltyAndRecoveryByHole', () => {
  it('reports penalty strokes and recovery SG per hole, and drops holes with neither', () => {
    const shots: EnrichedShot[] = [
      shot({ holeNo: 5, courseName: 'Elm Park', startLie: 'TEE', endLie: 'TEE', penaltyStrokes: 1, sg: -2, category: 'OFF_THE_TEE' }),
      shot({ holeNo: 5, courseName: 'Elm Park', shotNo: 2, startLie: 'RECOVERY', startDistance: 60, endLie: 'GREEN', endDistance: 10, sg: -0.4, category: 'RECOVERY' }),
      shot({ holeNo: 6, courseName: 'Elm Park', startLie: 'TEE', endLie: 'FAIRWAY', sg: 0.1, category: 'OFF_THE_TEE' }),
    ];
    const holeStats = penaltyAndRecoveryByHole(shots);
    expect(holeStats).toHaveLength(1);
    expect(holeStats[0]!.holeNo).toBe(5);
    expect(holeStats[0]!.penaltyStrokes).toBe(1);
    expect(holeStats[0]!.penaltySgLost).toBe(-1);
    expect(holeStats[0]!.recoverySgLost).toBeCloseTo(-0.4, 6);
    expect(holeStats[0]!.recoveryShotCount).toBe(1);
  });
});
