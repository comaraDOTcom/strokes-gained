import { describe, it, expect } from 'vitest';
import { buildSgTable, barPercent } from './sg-table';
import type { RoundSummary } from './aggregate';

const round = (id: number, over: Partial<RoundSummary> & { sg?: Partial<RoundSummary['sgByCategory']> } = {}): RoundSummary => {
  const sgByCategory = { OFF_THE_TEE: 0, APPROACH: 0, SHORT_GAME: 0, BUNKER: 0, PUTTING: 0, RECOVERY: 0, ...over.sg };
  return {
    roundId: id, playedOn: `2026-09-${10 + id}`, courseId: 1, courseName: 'Elm Park', teeId: 1, teeName: 'Blue',
    holesPlayed: 18, grossScore: 79, par: 69,
    sgTotal: Object.values(sgByCategory).reduce((a, b) => a + b, 0),
    sgByCategory, traditional: {} as RoundSummary['traditional'],
    ...over,
  };
};

describe('buildSgTable', () => {
  it('uses the round name when there is one, and shows a category with no shots as null, not 0', () => {
    const t = buildSgTable([round(1, { sg: { APPROACH: -5.4, PUTTING: 2.13 } })], new Map([[1, 'Medal Final']]));
    expect(t.rows[0]).toMatchObject({ title: 'Medal Final', subtitle: '2026-09-11', score: { gross: 79, toPar: 10 } });
    expect(t.rows[0]!.cells.APPROACH).toBe(-5.4);
    expect(t.rows[0]!.cells.BUNKER).toBeNull();
    expect(buildSgTable([round(2)]).rows[0]!.title).toBe('Elm Park — Blue');
  });

  it('shares one scale across all category cells, with total on its own scale', () => {
    const t = buildSgTable([round(1, { sg: { APPROACH: -5.4, PUTTING: 2 } }), round(2, { sg: { OFF_THE_TEE: -1, PUTTING: 0.5 } })]);
    expect(t.categoryScale).toBe(5.4);
    expect(t.totalScale).toBeCloseTo(3.4);
  });

  it('never lets the scale drop below 1, so tiny rounds do not draw full-width bars', () => {
    expect(buildSgTable([round(1, { sg: { PUTTING: 0.1 } })]).categoryScale).toBe(1);
  });

  it('averages FULL rounds only, and only once there are two of them', () => {
    const nine = round(3, { holesPlayed: 9, sg: { PUTTING: -4 } });
    expect(buildSgTable([round(1, { sg: { PUTTING: 1 } }), nine]).average).toBeNull();

    const t = buildSgTable([round(1, { sg: { PUTTING: 1, APPROACH: -2 } }), round(2, { sg: { PUTTING: 3 } }), nine]);
    expect(t.average).toMatchObject({ roundId: null, subtitle: '2 full rounds', total: 1 });
    expect(t.average!.cells.PUTTING).toBe(2);
    expect(t.average!.cells.APPROACH).toBe(-1); // the round with no approach SG counts as 0
  });
});

describe('barPercent', () => {
  it('scales, clamps, and keeps a visible sliver for small non-zero values', () => {
    expect(barPercent(2.7, 5.4)).toBe(50);
    expect(barPercent(-5.4, 5.4)).toBe(100);
    expect(barPercent(9, 5.4)).toBe(100);
    expect(barPercent(0.01, 5.4)).toBe(3);
    expect(barPercent(0, 5.4)).toBe(0);
  });
});
