import { describe, it, expect } from 'vitest';
import { buildEclectic, buildRoundCard, scoreTone, stablefordPoints, strokesReceived, type CardHoleMeta } from './scorecard';
import type { EnrichedShot } from './aggregate';

const META: CardHoleMeta[] = Array.from({ length: 18 }, (_, i) => ({ holeNo: i + 1, par: i % 3 === 2 ? 3 : 4, strokeIndex: ((i * 7) % 18) + 1 }));
const shot = (holeNo: number, shotNo: number, holed: boolean, sg = 0, penaltyStrokes = 0): EnrichedShot => ({
  roundId: 1, playedOn: '2026-09-20', courseId: 1, courseName: 'C', teeId: 1, teeName: 'T', holeNo, par: 4, shotNo,
  startLie: 'FAIRWAY', startDistance: 100, endLie: holed ? null : 'GREEN', endDistance: holed ? 0 : 10, holed,
  penaltyStrokes, penaltyType: penaltyStrokes ? 'LATERAL' : null, sg, category: 'APPROACH', bunkerSubtype: null,
});
/** `n` strokes on a hole, the last one holed. */
const play = (holeNo: number, n: number, sgEach = 0) => Array.from({ length: n }, (_, i) => shot(holeNo, i + 1, i === n - 1, sgEach));

describe('strokesReceived', () => {
  it('allocates by stroke index, wrapping past 18', () => {
    expect(strokesReceived(9, 9)).toBe(1);
    expect(strokesReceived(9, 10)).toBe(0);
    expect(strokesReceived(0, 1)).toBe(0);
    expect(strokesReceived(18, 18)).toBe(1);
    expect(strokesReceived(20, 2)).toBe(2);
    expect(strokesReceived(20, 3)).toBe(1);
    expect(strokesReceived(36, 18)).toBe(2);
  });
  it('a plus handicap gives strokes back on the easiest holes', () => {
    expect(strokesReceived(-2, 18)).toBe(-1);
    expect(strokesReceived(-2, 17)).toBe(-1);
    expect(strokesReceived(-2, 16)).toBe(-0);
    expect(strokesReceived(-2, 1)).toBe(-0);
  });
});

describe('stablefordPoints', () => {
  it('net par = 2, floors at 0', () => {
    expect(stablefordPoints(4, 4, 0)).toBe(2);
    expect(stablefordPoints(4, 5, 1)).toBe(2);
    expect(stablefordPoints(4, 3, 1)).toBe(4);
    expect(stablefordPoints(4, 7, 0)).toBe(0);
    expect(stablefordPoints(3, 1, 0)).toBe(4);
  });
});

describe('scoreTone', () => {
  it('maps to-par to a tone', () => {
    expect([-3, -2, -1, 0, 1, 2, 3, 6].map(scoreTone)).toEqual(['eagle', 'eagle', 'birdie', 'par', 'bogey', 'double', 'worse', 'worse']);
    expect(scoreTone(null)).toBe('none');
  });
});

describe('buildRoundCard', () => {
  it('scores only finished holes (penalties included) and totals front/back/overall', () => {
    const shots = [...play(1, 4, 0.1), ...play(2, 5), shot(3, 1, false), ...play(10, 3), shot(11, 1, false, -1, 1), shot(11, 2, true)];
    const card = buildRoundCard(META, shots);
    expect(card.holes).toHaveLength(18);
    expect(card.holes[0]).toMatchObject({ score: 4, toPar: 0 });
    expect(card.holes[0]!.sg).toBeCloseTo(0.4);
    expect(card.holes[2]).toMatchObject({ score: null, toPar: null }); // started, not finished
    expect(card.holes[10]).toMatchObject({ score: 3 }); // 2 shots + 1 penalty
    expect(card.front).toMatchObject({ score: 9, holesPlayed: 2 });
    expect(card.back).toMatchObject({ score: 6, holesPlayed: 2 });
    expect(card.overall).toMatchObject({ score: 15, holesPlayed: 4, points: null, net: null });
    expect(card.hasHandicapScoring).toBe(false);
  });

  it('adds net and Stableford when there is a handicap and a full set of stroke indexes', () => {
    const shots = META.flatMap((m) => play(m.holeNo, m.par + 1)); // bogey everywhere
    const card = buildRoundCard(META, shots, 18);
    expect(card.hasHandicapScoring).toBe(true);
    expect(card.holes.every((h) => h.strokesReceived === 1 && h.points === 2)).toBe(true);
    expect(card.overall.points).toBe(36);
    expect(card.overall.net).toBe(card.overall.par);
  });

  it('refuses handicap scoring when any stroke index is missing, rather than guessing', () => {
    const meta = META.map((m, i) => (i === 4 ? { ...m, strokeIndex: null } : m));
    const card = buildRoundCard(meta, play(1, 4), 10);
    expect(card.hasHandicapScoring).toBe(false);
    expect(card.holes[0]!.points).toBeNull();
  });
});

describe('buildEclectic', () => {
  const holes = META.map(({ holeNo, par }) => ({ holeNo, par }));
  const round = (roundId: number, scores: Record<number, number>) => ({
    roundId, title: `R${roundId}`, playedOn: `2026-09-0${roundId}`,
    card: buildRoundCard(META, Object.entries(scores).flatMap(([h, n]) => play(Number(h), n))),
  });

  it('takes the best and worst score per hole across rounds', () => {
    const e = buildEclectic(holes, [round(1, { 1: 5, 2: 4, 3: 2 }), round(2, { 1: 3, 2: 6 })]);
    expect(e.low.slice(0, 4)).toEqual([3, 4, 2, null]);
    expect(e.high.slice(0, 4)).toEqual([5, 6, 2, null]);
    expect(e.holesCovered).toBe(3);
    expect(e.eclecticTotal).toBeNull(); // not every hole covered yet
    expect(e.rows[0]).toMatchObject({ holesPlayed: 3, total: null });
  });

  it('totals the eclectic once every hole has been finished at least once', () => {
    const all = Object.fromEntries(META.map((m) => [m.holeNo, m.par + 1]));
    const e = buildEclectic(holes, [round(1, all), round(2, { 1: 3, 18: 2 })]);
    const par = META.reduce((a, m) => a + m.par, 0);
    expect(e.rows[0]!.total).toBe(par + 18);
    expect(e.eclecticTotal).toBe(par + 18 - 2 - 2); // hole 1: 5 -> 3, hole 18: par-3 bogey 4 -> 2
    expect(e.eclecticToPar).toBe(14);
  });

  it('handles no rounds', () => {
    expect(buildEclectic(holes, [])).toMatchObject({ rows: [], holesCovered: 0, eclecticTotal: null });
  });
});
