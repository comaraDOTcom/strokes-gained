import { describe, it, expect } from 'vitest';
import { buildBenchmark, compareToBenchmark, toBenchmarkBuckets, validateBenchmark, type BenchmarkFile } from './benchmarks';
import { buildRoundCard, scoreDistribution, type CardHoleMeta } from './scorecard';
import type { EnrichedShot } from './aggregate';
import scratch from './benchmark-data/scratch.json';

// Synthetic players — NOT real data.
const file: BenchmarkFile = {
  cohort: 'scratch',
  description: 'test',
  players: [
    { id: 'A', rounds: 2, holes: { eagle: 0, birdie: 8, par: 22, bogey: 5, doublePlus: 1 } },
    { id: 'B', rounds: 1, holes: { eagle: 1, birdie: 2, par: 12, bogey: 2, doublePlus: 1 } },
  ],
};

describe('buildBenchmark', () => {
  it('pools every hole, keeps the per-player spread and works out the ratios', () => {
    const b = buildBenchmark(file)!;
    expect(b).toMatchObject({ players: 2, rounds: 3, holes: 54 });
    expect(b.pooled.par).toBeCloseTo(34 / 54);
    expect(b.range.birdie.min).toBeCloseTo(2 / 18);
    expect(b.range.birdie.max).toBeCloseTo(8 / 36);
    expect(b.parOrBetterToBogey).toBeCloseTo(45 / 7);
    expect(b.parOrBetterToDoublePlus).toBeCloseTo(45 / 2);
  });

  it('is null until players have been added', () => {
    expect(buildBenchmark({ ...file, players: [] })).toBeNull();
  });
});

describe('validateBenchmark', () => {
  it('accepts a clean file', () => expect(validateBenchmark(file)).toEqual([]));

  it('rejects anything that looks like a name, and counts that cannot be right', () => {
    const bad: BenchmarkFile = {
      ...file,
      players: [
        { id: 'John', rounds: 1, holes: { eagle: 0, birdie: 2, par: 12, bogey: 3, doublePlus: 1 } },
        { id: 'B', rounds: 1, holes: { eagle: 0, birdie: 2, par: 20, bogey: 3, doublePlus: 1 } },
        { id: 'B', rounds: 1, holes: { eagle: -1, birdie: 2, par: 12, bogey: 3, doublePlus: 1 } },
      ],
    };
    const errors = validateBenchmark(bad).join('\n');
    expect(errors).toContain('no names');
    expect(errors).toContain('more than 1 rounds allow');
    expect(errors).toContain('appears twice');
    expect(errors).toContain('whole number');
  });

  it('the committed data file is always valid and anonymised', () => {
    expect(validateBenchmark(scratch as BenchmarkFile)).toEqual([]);
  });
});

describe('compareToBenchmark', () => {
  const META: CardHoleMeta[] = Array.from({ length: 18 }, (_, i) => ({ holeNo: i + 1, par: 4, strokeIndex: i + 1 }));
  const shot = (holeNo: number, shotNo: number, holed: boolean): EnrichedShot => ({
    roundId: 1, playedOn: '2026-09-20', courseId: 1, courseName: 'C', teeId: 1, teeName: 'T', holeNo, par: 4, shotNo,
    startLie: 'FAIRWAY', startDistance: 100, endLie: holed ? null : 'GREEN', endDistance: holed ? 0 : 10, holed,
    penaltyStrokes: 0, penaltyType: null, sg: 0, category: 'APPROACH', bunkerSubtype: null,
  });
  const play = (holeNo: number, n: number) => Array.from({ length: n }, (_, i) => shot(holeNo, i + 1, i === n - 1));
  // 4 holes: birdie, par, double, triple.
  const d = scoreDistribution([buildRoundCard(META, [...play(1, 3), ...play(2, 4), ...play(3, 6), ...play(4, 7)])]);

  it('folds double and triple+ into double+', () => {
    expect(toBenchmarkBuckets(d)).toEqual({ eagle: 0, birdie: 1, par: 1, bogey: 0, doublePlus: 2 });
  });

  it('shows each bucket against the pooled benchmark and whether it sits inside the scratch spread', () => {
    const c = compareToBenchmark(d, buildBenchmark(file)!);
    const dbl = c.find((x) => x.bucket === 'doublePlus')!;
    expect(dbl.mine).toBeCloseTo(0.5);
    expect(dbl.bench).toBeCloseTo(2 / 54);
    expect(dbl.diff).toBeCloseTo(0.5 - 2 / 54);
    expect(dbl.inRange).toBe(false);
  });
});
