import { describe, expect, it } from 'vitest';
import {
  formatQuality,
  isoDaysBefore,
  qualityAxis,
  qualityByCategory,
  qualityStat,
  qualityTone,
  qualityTrend,
  qualityTrends,
  roundQuality,
  shotQuality,
} from './quality';
import { roundSummaries, type EnrichedShot } from './aggregate';

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

/** `n` shots whose SG adds up to `total`, all in one category and round. */
const many = (n: number, total: number, o: Partial<EnrichedShot> = {}) =>
  [...Array(n)].map((_, i) => shot({ holeNo: (i % 18) + 1, shotNo: i + 1, sg: total / n, ...o }));

describe('shotQuality / qualityStat', () => {
  it('10 shots totalling +0.5 is 105', () => {
    expect(shotQuality(many(10, 0.5))).toBeCloseTo(105, 9);
    const s = qualityStat(many(10, 0.5))!;
    expect(s.shots).toBe(10);
    expect(s.sg).toBeCloseTo(0.5, 9);
    expect(s.thin).toBe(false);
  });

  it('reproduces Clippd’s example: +4 over 68 shots is 106', () => {
    const q = shotQuality(many(68, 4))!;
    expect(q).toBeCloseTo(105.88, 2);
    expect(formatQuality(q)).toBe('106');
  });

  it('a 20-strokes-behind round of 90 shots is 78', () => {
    expect(formatQuality(shotQuality(many(90, -20)))).toBe('78');
  });

  it('is null for no shots', () => {
    expect(shotQuality([])).toBeNull();
    expect(qualityStat([])).toBeNull();
    expect(formatQuality(null)).toBe('—');
  });

  it('does not clamp a one-shot extreme', () => {
    expect(shotQuality([shot({ sg: -2.1 })])).toBeCloseTo(-110, 9);
  });

  it('is thin under 10 shots', () => {
    expect(qualityStat(many(9, 0))!.thin).toBe(true);
    expect(qualityStat(many(10, 0))!.thin).toBe(false);
  });

  it('counts a penalty shot once in the denominator', () => {
    const shots = [shot({ sg: -2, penaltyStrokes: 1 }), shot({ sg: 0.2 }), shot({ sg: 0.1 }), shot({ sg: 0.1 })];
    expect(shotQuality(shots)).toBeCloseTo(60, 9); // mean −0.4 over 4 shots
  });
});

describe('qualityByCategory / roundQuality', () => {
  const shots = [
    shot({ category: 'PUTTING', sg: -0.1 }),
    shot({ category: 'OFF_THE_TEE', sg: 0.1 }),
    shot({ category: 'PUTTING', sg: -0.1 }),
    shot({ category: 'OFF_THE_TEE', sg: 0.3 }),
    shot({ category: 'PUTTING', sg: -0.1 }),
  ];

  it('splits by category in table order and leaves out categories with no shots', () => {
    const cats = qualityByCategory(shots);
    expect(cats.map((c) => c.short)).toEqual(['OTT', 'PUTT']);
    expect(cats[0]!.quality).toBeCloseTo(120, 9);
    expect(cats[1]!.quality).toBeCloseTo(90, 9);
  });

  it('overall is the pooled mean of every shot', () => {
    expect(roundQuality(shots).overall!.quality).toBeCloseTo(100 + (100 * 0.1) / 5, 9);
  });

  it('gives the same answer for the same shots spread over two rounds', () => {
    const split = shots.map((s, i) => ({ ...s, roundId: (i % 2) + 1 }));
    expect(roundQuality(split)).toEqual(roundQuality(shots));
  });

  it('is empty for no shots', () => {
    expect(roundQuality([])).toEqual({ overall: null, byCategory: [] });
  });
});

describe('formatting', () => {
  it('rounds to a whole number and colours by the rounded value', () => {
    expect(formatQuality(105.5)).toBe('106');
    expect(formatQuality(99.6)).toBe('100');
    expect(qualityTone(99.6)).toBe('neutral');
    expect(qualityTone(100.5)).toBe('pos');
    expect(qualityTone(99.4)).toBe('neg');
  });
});

/** One round per date with `n` shots totalling `sg` in `category`. */
function round(roundId: number, playedOn: string, n: number, sg: number, category: EnrichedShot['category'] = 'PUTTING') {
  return many(n, sg, { roundId, playedOn, category });
}

describe('qualityTrend', () => {
  it('pools by shots, not by averaging rounds', () => {
    const shots = [...round(1, '2026-01-01', 10, -1), ...round(2, '2026-01-08', 30, 1)];
    const t = qualityTrend(shots, { category: 'PUTTING' });
    expect(t.points[1]!.rolling.quality).toBeCloseTo(100, 9); // Σ0 over 40 shots, not the 96.7 a round average gives
    expect(t.points[0]!.round.quality).toBeCloseTo(90, 9);
  });

  it('caps the window at 5 rounds, and uses a partial window early on', () => {
    const shots = [1, 2, 3, 4, 5, 6].flatMap((r) => round(r, `2026-01-0${r}`, 10, r === 1 ? -10 : 0));
    const t = qualityTrend(shots, { category: 'PUTTING' });
    expect(t.points[2]!.rolling.shots).toBe(30); // rounds 1-3
    expect(t.points[5]!.rolling.shots).toBe(50); // rounds 2-6
    expect(t.points[5]!.rolling.quality).toBeCloseTo(100, 9); // round 1's −10 has left the window
    expect(t.latest).toEqual(t.points[5]!.rolling);
  });

  it('ALL adds up every category in each round', () => {
    const shots = [
      ...round(1, '2026-01-01', 10, -1, 'PUTTING'),
      ...round(1, '2026-01-01', 5, 0.5, 'APPROACH'),
      ...round(2, '2026-01-08', 10, 0, 'PUTTING'),
    ];
    const t = qualityTrend(shots, { category: 'ALL' });
    const summaries = roundSummaries(shots);
    expect(t.points[0]!.round.shots).toBe(15);
    expect(t.points[0]!.round.sg).toBeCloseTo(summaries.find((s) => s.roundId === 1)!.sgTotal, 9);
  });

  it('marks a rolling window under 10 shots as thin', () => {
    const two = [1, 2, 3, 4].flatMap((r) => round(r, `2026-01-0${r}`, 2, 0, 'BUNKER'));
    expect(qualityTrend(two, { category: 'BUNKER' }).points.every((p) => p.rolling.thin)).toBe(true);
    const three = [1, 2, 3, 4].flatMap((r) => round(r, `2026-01-0${r}`, 3, 0, 'BUNKER'));
    expect(qualityTrend(three, { category: 'BUNKER' }).latest!.thin).toBe(false);
  });

  it('keeps earlier rounds in the window of the first point after `since`', () => {
    const shots = [
      ...round(1, '2025-01-01', 10, 0),
      ...round(2, '2026-02-01', 10, 0),
      ...round(3, '2026-03-01', 10, 0),
    ];
    const t = qualityTrend(shots, { category: 'PUTTING', since: '2026-01-01' });
    expect(t.since).toBe('2026-01-01');
    expect(t.points.map((p) => p.roundId)).toEqual([2, 3]);
    expect(t.points[0]!.rolling.shots).toBe(20); // includes the 2025 round
  });

  it('falls back to every round when fewer than 2 fall after `since`', () => {
    const shots = [...round(1, '2025-01-01', 10, 0), ...round(2, '2026-02-01', 10, 0)];
    const t = qualityTrend(shots, { category: 'PUTTING', since: '2026-01-01' });
    expect(t.since).toBeNull();
    expect(t.points).toHaveLength(2);
  });

  it('orders by date, then round id', () => {
    const shots = [...round(5, '2026-01-02', 10, 0), ...round(3, '2026-01-02', 10, 0), ...round(9, '2026-01-01', 10, 0)];
    expect(qualityTrend(shots, { category: 'PUTTING' }).points.map((p) => p.roundId)).toEqual([9, 3, 5]);
  });
});

describe('qualityTrends', () => {
  it('puts ALL first, then categories that have shots, in table order', () => {
    const shots = [...round(1, '2026-01-01', 5, 0, 'PUTTING'), ...round(1, '2026-01-01', 5, 0, 'OFF_THE_TEE')];
    expect(qualityTrends(shots).map((t) => t.category)).toEqual(['ALL', 'OFF_THE_TEE', 'PUTTING']);
    expect(qualityTrends([])).toEqual([]);
  });
});

describe('helpers', () => {
  it('qualityAxis steps by 5, always includes 100, and pads', () => {
    expect(qualityAxis([98, 103])).toEqual({ domain: [95, 105], ticks: [95, 100, 105] });
    const wide = qualityAxis([70, 101]);
    expect(wide.ticks).toContain(100);
    expect(wide.ticks[1]! - wide.ticks[0]!).toBe(10);
    expect(qualityAxis([101, 104]).domain[0]).toBeLessThanOrEqual(100);
  });

  it('isoDaysBefore works in UTC, across a leap day', () => {
    expect(isoDaysBefore('2026-09-25', 365)).toBe('2025-09-25');
    expect(isoDaysBefore('2024-03-01', 1)).toBe('2024-02-29');
    expect(isoDaysBefore('2025-03-01', 1)).toBe('2025-02-28');
  });
});
