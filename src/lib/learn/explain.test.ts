import { describe, expect, it } from 'vitest';
import { explainQuality, qualityBand, qualityLadder } from './explain';
import { qualityStat } from '../insights/quality';

const stat = (shots: number, sg: number) => qualityStat([...Array(shots)].map(() => ({ sg: sg / shots })))!;

describe('explainQuality', () => {
  it('reads the Medal Final round: 79 shots, −10.44 → 87', () => {
    const e = explainQuality(stat(79, -10.44));
    expect(e.headline).toBe("87 means your average shot lost 0.13 strokes to a scratch golfer's.");
    expect(e.detail).toBe('Over these 79 shots that adds up to 10.4 strokes lost (-10.4).');
    expect(e.caveat).toBeNull();
  });

  it('reads a round better than scratch', () => {
    expect(explainQuality(stat(68, 4)).headline).toBe("106 means your average shot gained 0.06 strokes on a scratch golfer's.");
  });

  it('reads exactly scratch', () => {
    const e = explainQuality(stat(72, 0));
    expect(e.headline).toMatch(/^100 means your shots were as good/);
    expect(e.detail).toMatch(/level with scratch/);
  });

  it('adds a caveat under 10 shots', () => {
    expect(explainQuality(stat(3, -0.6)).caveat).toBe('Only 3 shots, so treat it as a hint: it needs 10 to mean much.');
  });
});

describe('qualityBand', () => {
  it('names each band by the rounded score', () => {
    expect(qualityBand(105)).toBe('better than scratch');
    expect(qualityBand(99.6)).toBe('scratch level');
    expect(qualityBand(96)).toBe('close to scratch');
    expect(qualityBand(90)).toBe('a solid club golfer');
    expect(qualityBand(87)).toBe('a mid-handicap round');
    expect(qualityBand(70)).toBe('a tough day');
  });
});

describe('qualityLadder', () => {
  it('turns a score into strokes per round, consistent with the formula', () => {
    const ladder = qualityLadder(72);
    const at = (q: number) => ladder.find((r) => r.quality === q)!;
    expect(at(100).strokesPerRound).toBe(0);
    expect(at(90).strokesPerRound).toBeCloseTo(8, 9); // 80 shots, 8 lost: 100 − 100×8/80 = 90
    expect(at(80).strokesPerRound).toBeCloseTo(18, 9);
    expect(at(105).strokesPerRound).toBeLessThan(0);
    for (const r of ladder) {
      expect(100 - (100 * r.strokesPerRound) / r.shots).toBeCloseTo(r.quality, 9);
    }
  });
});
