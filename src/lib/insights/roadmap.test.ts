import { describe, expect, it } from 'vitest';
import {
  ROADMAP_BUCKETS,
  bucketOf,
  bucketStats,
  broadieGroup,
  bucketTrend,
  buildRoadmap,
  importanceByBucket,
  opportunity,
  roadmapSentence,
  type RoadmapItem,
} from './roadmap';
import { practicePriority } from './trends';
import { BROADIE_IMPORTANCE, type ImportanceTable } from './importance-broadie';
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
    ...overrides,
  };
}

const putt = (feet: number, o: Partial<EnrichedShot> = {}) =>
  shot({ category: 'PUTTING', startLie: 'GREEN', startDistance: feet, ...o });
const approach = (yards: number, o: Partial<EnrichedShot> = {}) =>
  shot({ category: 'APPROACH', startLie: 'FAIRWAY', startDistance: yards, ...o });

/** `n` rounds of 18 holes; `perRound(r)` returns that round's shots (holeNo is spread 1..18). */
function rounds(n: number, perRound: (r: number) => Partial<EnrichedShot>[]): EnrichedShot[] {
  const out: EnrichedShot[] = [];
  for (let r = 0; r < n; r++) {
    const roundId = r + 1;
    const playedOn = `2026-${String(r + 1).padStart(2, '0')}-01`;
    // Make every round 18 holes long so per-18 maths is exact.
    for (let h = 1; h <= 18; h++) out.push(shot({ roundId, playedOn, holeNo: h, category: 'OFF_THE_TEE', sg: 0 }));
    perRound(r).forEach((o, i) => out.push(shot({ ...o, roundId, playedOn, holeNo: (i % 18) + 1 })));
  }
  return out;
}

describe('buckets', () => {
  it('lists every area once, in order, with keys the stats use', () => {
    const keys = ROADMAP_BUCKETS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe('OFF_THE_TEE');
    expect(ROADMAP_BUCKETS.map((b) => b.order)).toEqual(keys.map((_, i) => i));
  });

  it('puts boundary shots in the right bucket', () => {
    expect(bucketOf(putt(8))).toBe('PUTTING:6-10ft');
    expect(bucketOf(approach(120))).toBe('APPROACH:100-150y');
    expect(bucketOf(shot({ category: 'BUNKER', startLie: 'SAND', startDistance: 10, bunkerSubtype: 'greenside' }))).toBe(
      'BUNKER:greenside',
    );
    expect(bucketOf(shot({ category: 'BUNKER', startLie: 'SAND', startDistance: 40, bunkerSubtype: 'fairway' }))).toBe(
      'BUNKER:fairway',
    );
    // Par-3 tee shot: the engine calls it APPROACH, not OTT.
    expect(bucketOf(shot({ category: 'APPROACH', par: 3, startLie: 'TEE', startDistance: 160 }))).toBe('APPROACH:150-200y');
    expect(bucketOf(shot({ category: 'SHORT_GAME', startLie: 'ROUGH', startDistance: 15 }))).toBe('SHORT_GAME:10-20y');
  });

  it('zero-fills every bucket and sums SG and penalties', () => {
    const stats = bucketStats([
      putt(8, { sg: -0.2 }),
      putt(9, { sg: -0.1 }),
      shot({ category: 'OFF_THE_TEE', sg: -2, penaltyStrokes: 1 }),
    ]);
    expect(stats).toHaveLength(ROADMAP_BUCKETS.length);
    const p = stats.find((s) => s.key === 'PUTTING:6-10ft')!;
    expect(p.attempts).toBe(2);
    expect(p.sgTotal).toBeCloseTo(-0.3, 9);
    expect(p.sgPerShot).toBeCloseTo(-0.15, 9);
    expect(stats.find((s) => s.key === 'OFF_THE_TEE')!.penaltyStrokes).toBe(1);
    expect(stats.find((s) => s.key === 'RECOVERY')!.attempts).toBe(0);
  });
});

describe('broadieGroup', () => {
  it('uses Broadie’s 100-yard line, not the app’s 30-yard one', () => {
    expect(broadieGroup(shot({ category: 'APPROACH', par: 3, startLie: 'TEE', startDistance: 160 }))).toBe('APPROACH');
    expect(broadieGroup(approach(80))).toBe('SHORT_GAME');
    expect(broadieGroup(shot({ category: 'BUNKER', startDistance: 10 }))).toBe('SHORT_GAME');
    expect(broadieGroup(shot({ category: 'RECOVERY', startLie: 'RECOVERY', startDistance: 140 }))).toBe('APPROACH');
    expect(broadieGroup(shot({ category: 'OFF_THE_TEE', par: 5, startDistance: 520 }))).toBe('OFF_THE_TEE');
    expect(broadieGroup(putt(40))).toBe('PUTTING'); // 40ft is not "more than 100 yards"
  });
});

describe('importanceByBucket', () => {
  it('splits a group’s share by how often you hit each band (worked example)', () => {
    const shots = [...Array(6)].map(() => approach(120)).concat([...Array(4)].map(() => approach(170)));
    const imp = importanceByBucket(shots);
    expect(imp.get('APPROACH:100-150y')!.bucketShare).toBeCloseTo(0.24, 9); // 0.40 × 6/10
    expect(imp.get('APPROACH:150-200y')!.bucketShare).toBeCloseTo(0.16, 9); // 0.40 × 4/10
    expect(imp.get('APPROACH:100-150y')!.weight).toBeCloseTo(1.6, 9);
    expect(imp.get('APPROACH:100-150y')!.tier).toBe('high');
    expect(imp.get('APPROACH:100-150y')!.basis).toBe('exposure');
  });

  it('bucket shares add up to the shares of the groups you have shots in', () => {
    const shots = [approach(120), approach(170), approach(60), putt(5), putt(25), shot({ category: 'OFF_THE_TEE' })];
    const imp = importanceByBucket(shots);
    const total = [...imp.values()].reduce((a, i) => a + i.bucketShare, 0);
    expect(total).toBeCloseTo(1, 9); // all four groups present
  });

  it('gives the <100y approach band the short-game weight, and tiers the groups', () => {
    const imp = importanceByBucket([approach(60), putt(5), shot({ category: 'OFF_THE_TEE' })]);
    expect(imp.get('APPROACH:<100y')!.group).toBe('SHORT_GAME');
    expect(imp.get('APPROACH:<100y')!.weight).toBeCloseTo(0.68, 9);
    expect(imp.get('APPROACH:<100y')!.tier).toBe('lower');
    expect(imp.get('PUTTING:3-6ft')!.tier).toBe('lower'); // 0.6
    expect(imp.get('OFF_THE_TEE')!.tier).toBe('mid'); // 1.12
  });

  it('averages the weight of a bucket whose shots straddle two groups', () => {
    const imp = importanceByBucket([
      shot({ category: 'BUNKER', startLie: 'SAND', startDistance: 60, bunkerSubtype: 'fairway' }),
      shot({ category: 'BUNKER', startLie: 'SAND', startDistance: 140, bunkerSubtype: 'fairway' }),
    ]);
    expect(imp.get('BUNKER:fairway')!.weight).toBeCloseTo(((0.17 + 0.4) / 2) * 4, 9);
  });

  it('uses a fixed bucket share from the table when there is one', () => {
    const table: ImportanceTable = { ...BROADIE_IMPORTANCE, bucketShare: { 'APPROACH:100-150y': 0.1 } };
    const imp = importanceByBucket([approach(120)], table);
    expect(imp.get('APPROACH:100-150y')!.bucketShare).toBe(0.1);
    expect(imp.get('APPROACH:100-150y')!.basis).toBe('table');
  });

  it('gives an empty bucket its nominal group’s weight and no share', () => {
    const imp = importanceByBucket([]);
    expect(imp.get('PUTTING:0-3ft')!.weight).toBeCloseTo(0.6, 9);
    expect(imp.get('PUTTING:0-3ft')!.bucketShare).toBe(0);
  });
});

describe('opportunity', () => {
  it('scales strokes lost to 18 holes', () => {
    const o = opportunity({ sgTotal: -1.5, attempts: 20 }, 27);
    expect(o.strokesPer18).toBeCloseTo(1, 9);
    expect(o.level).toBe('high');
    expect(o.attemptsPer18).toBeCloseTo(20 * (18 / 27), 9);
  });

  it('draws the level boundaries at 0.25 and 0.75 strokes a round', () => {
    expect(opportunity({ sgTotal: -0.24, attempts: 10 }, 18).level).toBe('low');
    expect(opportunity({ sgTotal: -0.25, attempts: 10 }, 18).level).toBe('medium');
    expect(opportunity({ sgTotal: -0.75, attempts: 10 }, 18).level).toBe('high');
  });

  it('is none, with nothing lost, when you gain on scratch', () => {
    const o = opportunity({ sgTotal: 0.4, attempts: 10 }, 18);
    expect(o.level).toBe('none');
    expect(o.strokesPer18).toBe(0);
  });

  it('flags a small sample under 10 shots', () => {
    expect(opportunity({ sgTotal: -1, attempts: 9 }, 18).smallSample).toBe(true);
    expect(opportunity({ sgTotal: -1, attempts: 10 }, 18).smallSample).toBe(false);
  });
});

describe('bucketTrend', () => {
  it('reads a steady, well-sampled improvement as improving with signal', () => {
    const shots = rounds(8, (r) => [...Array(5)].map(() => ({ ...putt(8), sg: r < 4 ? -0.1 : 0.05 })));
    const t = bucketTrend(shots, 'PUTTING:6-10ft')!;
    expect(t.direction).toBe('improving');
    expect(t.signal).toBe('signal'); // 20 vs 20 shots, zero variance
    expect(t.deltaPerShot).toBeCloseTo(0.15, 9);
    expect(t.recentRounds).toBe(4);
    expect(t.earlierRounds).toBe(4);
    expect(t.series).toHaveLength(8);
  });

  it('still reports the direction of a tiny sample, labelled noise', () => {
    const shots = rounds(4, (r) => [
      { category: 'BUNKER', startLie: 'SAND', startDistance: 10, bunkerSubtype: 'greenside', sg: r < 2 ? -0.5 : 0.5 },
    ]);
    const t = bucketTrend(shots, 'BUNKER:greenside')!;
    expect(t.direction).toBe('improving');
    expect(t.signal).toBe('noise');
  });

  it('is null with fewer than two rounds of shots in the area', () => {
    const shots = rounds(3, (r) => (r === 2 ? [putt(8, { sg: -0.3 })] : []));
    expect(bucketTrend(shots, 'PUTTING:6-10ft')).toBeNull();
  });

  it('keeps a round with no shots in the area in the series', () => {
    const shots = rounds(3, (r) => (r === 1 ? [] : [putt(8, { sg: -0.1 })]));
    const t = bucketTrend(shots, 'PUTTING:6-10ft')!;
    expect(t.series.map((p) => p.attempts)).toEqual([1, 0, 1]);
  });

  it('calls a change of under 0.1 strokes a round flat', () => {
    // 1 putt a round, per-shot change 0.05 → 0.05 strokes per 18.
    const shots = rounds(4, (r) => [putt(8, { sg: r < 2 ? -0.1 : -0.05 })]);
    expect(bucketTrend(shots, 'PUTTING:6-10ft')!.direction).toBe('flat');
  });
});

describe('buildRoadmap', () => {
  it('ranks by importance × opportunity: an approach leak beats a bigger putting leak', () => {
    // Putting 6-10ft loses 1.0 a round (weight 0.6 → 0.6); approach 100-150y loses 0.5 (weight 1.6 → 0.8).
    const shots = rounds(4, () => [
      ...[...Array(10)].map(() => putt(8, { sg: -0.1 })),
      ...[...Array(5)].map(() => approach(120, { sg: -0.1 })),
    ]);
    const map = buildRoadmap(shots);
    expect(map.items[0]!.key).toBe('APPROACH:100-150y');
    expect(map.items[0]!.opportunity.strokesPer18).toBeCloseTo(0.5, 9);
    expect(map.items[0]!.priority).toBeCloseTo(0.8, 9);
    expect(map.items[1]!.key).toBe('PUTTING:6-10ft');
    expect(map.items[1]!.priority).toBeCloseTo(0.6, 9);
  });

  it('puts areas where you gain in strengths, not items', () => {
    const shots = rounds(2, () => [putt(2, { sg: 0.05 }), approach(170, { sg: -0.3 })]);
    const map = buildRoadmap(shots);
    expect(map.items.map((i) => i.key)).toEqual(['APPROACH:150-200y']);
    expect(map.strengths.map((i) => i.key)).toContain('PUTTING:0-3ft');
  });

  it('uses only the window for opportunity but every round for importance', () => {
    const old = rounds(1, () => [approach(60, { sg: -5 })]).map((s) => ({ ...s, roundId: 99, playedOn: '2020-01-01' }));
    const recent = rounds(8, () => [approach(120, { sg: -0.1 })]);
    const map = buildRoadmap([...old, ...recent], { roundWindow: 8 });
    expect(map.roundsTotal).toBe(9);
    expect(map.windowRounds).toBe(8);
    expect(map.items.some((i) => i.key === 'APPROACH:<100y')).toBe(false); // old round's leak is out of the window
    const lt100 = map.all.find((i) => i.key === 'APPROACH:<100y')!;
    expect(lt100.importance.bucketShare).toBeGreaterThan(0); // …but it still counts toward how often you hit it
  });

  it('counts holes across part rounds for per-18 numbers', () => {
    const nine = [...Array(9)].map((_, h) => shot({ roundId: 1, holeNo: h + 1, sg: 0 }));
    const map = buildRoadmap([...nine, putt(8, { roundId: 1, holeNo: 1, sg: -0.5 })]);
    expect(map.holesInWindow).toBe(9);
    expect(map.items[0]!.opportunity.strokesPer18).toBeCloseTo(1, 9);
  });

  it('carries the table’s group shares and status', () => {
    const map = buildRoadmap(rounds(1, () => []));
    expect(map.groups.map((g) => g.share)).toEqual([0.28, 0.4, 0.17, 0.15]);
    expect(map.importanceStatus).toBe('placeholder');
  });
});

describe('roadmapSentence', () => {
  const base = (o: Partial<Omit<RoadmapItem, 'sentence'>>): Omit<RoadmapItem, 'sentence'> => {
    const shots = rounds(8, (r) => [...Array(5)].map(() => approach(120, { sg: r < 4 ? -0.2 : -0.1 })));
    const { sentence: _s, ...item } = buildRoadmap(shots).items[0]!;
    return { ...item, ...o };
  };

  it('high importance, not enough shots for a trend', () => {
    const i = base({ trend: null });
    expect(roadmapSentence(i)).toBe(
      `You lose ${i.opportunity.strokesPer18.toFixed(1)} strokes a round here; it's a high-importance area and there aren't enough shots yet to see a trend.`,
    );
  });

  it('improving with signal', () => {
    const i = base({});
    expect(i.trend!.signal).toBe('signal');
    expect(roadmapSentence(i)).toMatch(/it's a high-importance area and it's improving\.$/);
  });

  it('worsening with limited data', () => {
    const i = base({});
    const s = roadmapSentence({ ...i, trend: { ...i.trend!, direction: 'worsening', signal: 'limited' } });
    expect(s).toMatch(/it may be getting worse\.$/);
  });

  it('adds a small-sample note and a penalty clause', () => {
    const i = base({});
    const s = roadmapSentence({
      ...i,
      penaltyStrokes: 2,
      attempts: 7,
      opportunity: { ...i.opportunity, attempts: 7, smallSample: true },
    });
    expect(s).toContain('strokes a round here (including 2 penalty strokes);');
    expect(s).toMatch(/Only 7 shots so far, so treat it as a hint\.$/);
  });
});

describe('practicePriority on the shared buckets', () => {
  it('uses the roadmap’s labels', () => {
    const shots = [
      putt(8, { sg: -0.3 }),
      approach(120, { sg: -0.4 }),
      shot({ category: 'SHORT_GAME', startLie: 'ROUGH', startDistance: 15, sg: -0.2 }),
      shot({ category: 'BUNKER', startLie: 'SAND', startDistance: 10, bunkerSubtype: 'greenside', sg: -0.2 }),
      shot({ category: 'RECOVERY', startLie: 'RECOVERY', startDistance: 150, sg: -0.2 }),
    ];
    const labels = new Set(ROADMAP_BUCKETS.map((b) => b.label));
    for (const p of practicePriority(shots, 4)) expect(labels.has(p.label)).toBe(true);
  });
});
