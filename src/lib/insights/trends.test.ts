import { describe, expect, it } from 'vitest';
import {
  classifySignalStrength,
  categoryTrends,
  practicePriority,
  difficultyAdjustment,
} from './trends';
import { expectedStrokes } from '../sg/interpolate';
import { ELM_PARK, PORTMARNOCK } from '../../db/seed-courses';
import type { EnrichedShot } from './aggregate';

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
    missDirection: null,
    puttSlope: null,
    puttBreak: null,
    ...overrides,
  };
}

describe('classifySignalStrength', () => {
  it('labels a small move on a tiny sample as noise (the BUILD.md worked example)', () => {
    // ~120 putts across 4 rounds vs 6 bunker shots: the 6-shot case must be noise.
    const priorBunkerShots = [-0.1, 0.05, -0.2, 0.1, -0.05]; // 5 shots, small spread
    expect(classifySignalStrength(0.3, 6, priorBunkerShots)).toBe('noise');
  });

  it('labels a consistent, well-sampled move as signal', () => {
    // Large, consistent prior sample with low variance, and a latest round
    // that moves clearly away from it with plenty of shots.
    const priorPutts = Array.from({ length: 90 }, () => -0.02);
    expect(classifySignalStrength(1.5, 30, priorPutts)).toBe('signal');
  });

  it('never returns signal below the minimum shot-count gate, however large the delta', () => {
    expect(classifySignalStrength(5, 3, [-0.1, -0.1, -0.1, -0.1, -0.1])).toBe('noise');
  });
});

describe('categoryTrends', () => {
  it('flags a putting trend from ~120 shots as signal, and a 6-shot bunker move as noise', () => {
    const shots: EnrichedShot[] = [];
    const rounds = ['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22'];
    for (let r = 0; r < rounds.length; r++) {
      const roundId = r + 1;
      const puttSg = r < 3 ? -0.02 : 0.05; // clear, consistent improvement in the latest round
      for (let i = 0; i < 30; i++) {
        shots.push(shot({ roundId, playedOn: rounds[r]!, category: 'PUTTING', sg: puttSg }));
      }
      // Bunker: tiny, noisy sample every round.
      const bunkerSg = r === rounds.length - 1 ? 0.3 : -0.1;
      shots.push(shot({ roundId, playedOn: rounds[r]!, category: 'BUNKER', sg: bunkerSg, bunkerSubtype: 'greenside' }));
    }

    const trends = categoryTrends(shots, 3);
    const putting = trends.find((t) => t.category === 'PUTTING')!;
    const bunker = trends.find((t) => t.category === 'BUNKER')!;

    expect(putting.signal).toBe('signal');
    expect(bunker.signal).toBe('noise');
  });
});

describe('practicePriority', () => {
  it('ranks negative-SG buckets worst-first and excludes positive buckets', () => {
    const shots: EnrichedShot[] = [
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'PUTTING', startLie: 'GREEN', startDistance: 8, sg: -0.3 }),
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'PUTTING', startLie: 'GREEN', startDistance: 8, sg: -0.3 }),
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'PUTTING', startLie: 'GREEN', startDistance: 8, sg: -0.4 }),
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'BUNKER', startLie: 'SAND', startDistance: 10, sg: 0.2, bunkerSubtype: 'greenside' }),
      shot({ roundId: 1, playedOn: '2026-01-01', category: 'OFF_THE_TEE', penaltyStrokes: 1, sg: -2 }),
    ];
    const priorities = practicePriority(shots, 4);
    expect(priorities[0]!.label).toBe('Off the tee'); // -2, worst
    expect(priorities[0]!.sgLost).toBeCloseTo(-2, 6);
    expect(priorities.some((p) => p.label.startsWith('Putting'))).toBe(true);
    expect(priorities.some((p) => p.label.startsWith('Bunker'))).toBe(false); // was net positive, excluded
    // Sorted ascending (most negative first)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]!.sgLost).toBeGreaterThanOrEqual(priorities[i - 1]!.sgLost);
    }
  });

  it('only considers the last N rounds', () => {
    const old = shot({ roundId: 1, playedOn: '2020-01-01', category: 'PUTTING', startLie: 'GREEN', startDistance: 8, sg: -5 });
    const recent = [1, 2, 3, 4].map((n) =>
      shot({ roundId: n + 1, playedOn: `2026-0${n}-01`, category: 'PUTTING', startLie: 'GREEN', startDistance: 8, sg: -0.1 }),
    );
    const priorities = practicePriority([old, ...recent], 4);
    const putting = priorities.find((p) => p.label.startsWith('Putting'))!;
    expect(putting.attempts).toBe(4); // the very old round's -5 shot is excluded
  });
});

describe('difficultyAdjustment', () => {
  it('is a small correction for Elm Park Blue, matching the baseline file header comment', () => {
    const blue = ELM_PARK.tees.find((t) => t.name === 'Blue')!;
    const holeYards = ELM_PARK.holes.map((h) => h.yards['Blue']!);
    const predicted = holeYards.reduce((sum, y) => sum + expectedStrokes('TEE', y), 0);
    const result = difficultyAdjustment(1, blue.courseRating, holeYards);
    expect(result.perHoleAdjustment).not.toBeNull();
    expect(result.perHoleAdjustment).toBeCloseTo((blue.courseRating! - predicted) / 18, 9);
    // Baseline header comment: predicts 68.56 vs card CR 68.5 -> understates by ~0.06 total.
    expect(Math.abs(result.perHoleAdjustment!)).toBeLessThan(0.02);
  });

  it('is null for a tee with no course rating on file (Portmarnock, per the seed)', () => {
    const anyPortmarnockTee = PORTMARNOCK.tees[0]!;
    const holeYards = PORTMARNOCK.holes.map((h) => h.yards[anyPortmarnockTee.name]!);
    expect(anyPortmarnockTee.courseRating).toBeNull();
    const result = difficultyAdjustment(2, anyPortmarnockTee.courseRating, holeYards);
    expect(result.perHoleAdjustment).toBeNull();
  });
});
