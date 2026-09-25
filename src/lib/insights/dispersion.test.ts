import { describe, expect, it } from 'vitest';
import {
  MIN_TAGGED,
  approachDispersion,
  dispersionHeadline,
  puttingProfile,
  shortGameDispersion,
  speedTendency,
  teeDispersion,
} from './dispersion';
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
    shotNo: 2,
    startLie: 'FAIRWAY',
    startDistance: 140,
    endLie: 'GREEN',
    endDistance: 20,
    holed: false,
    penaltyStrokes: 0,
    penaltyType: null,
    sg: 0,
    category: 'APPROACH',
    bunkerSubtype: null,
    missDirection: null,
    puttSlope: null,
    puttBreak: null,
    ...overrides,
  };
}

const times = (n: number, o: Partial<EnrichedShot>) => [...Array(n)].map(() => shot(o));
const approachMiss = (dir: EnrichedShot['missDirection'], o: Partial<EnrichedShot> = {}) =>
  shot({ endLie: 'ROUGH', endDistance: 15, missDirection: dir, ...o });

describe('approachDispersion', () => {
  it('splits every shot into on-green, four sectors and untagged, adding to 100%', () => {
    const shots = [
      ...times(5, {}), // on the green
      ...times(3, { endLie: 'ROUGH', missDirection: 'LEFT' }),
      ...times(1, { endLie: 'SAND', missDirection: 'SHORT' }),
      ...times(1, { endLie: 'ROUGH' }), // untagged miss
    ];
    const { overall } = approachDispersion(shots);
    expect(overall).toMatchObject({ shots: 10, onGreen: 5, missed: 5, tagged: 4, untagged: 1, dominant: 'LEFT' });
    const total = overall.onGreenPct + Object.values(overall.shares).reduce((a, b) => a + b, 0) + overall.untagged / overall.shots;
    expect(total).toBeCloseTo(1, 9);
    expect(overall.shares.LEFT).toBeCloseTo(0.3, 9);
  });

  it('counts a holed approach as on the green', () => {
    expect(approachDispersion([shot({ holed: true, endLie: null })]).overall.onGreen).toBe(1);
  });

  it('puts shots in approach bands, in order', () => {
    const { bands } = approachDispersion([shot({ startDistance: 170 }), shot({ startDistance: 90 }), shot({ startDistance: 120 })]);
    expect(bands.map((b) => b.band)).toEqual(['<100y', '100-150y', '150-200y']);
  });

  it('has no dominant miss on a tie', () => {
    expect(approachDispersion([approachMiss('LEFT'), approachMiss('RIGHT')]).overall.dominant).toBeNull();
  });

  it('is enough at exactly MIN_TAGGED tagged misses', () => {
    expect(approachDispersion(times(MIN_TAGGED - 1, { endLie: 'ROUGH', missDirection: 'LEFT' })).overall.enough).toBe(false);
    expect(approachDispersion(times(MIN_TAGGED, { endLie: 'ROUGH', missDirection: 'LEFT' })).overall.enough).toBe(true);
  });

  it('ignores stroke-and-distance replays and other categories', () => {
    const { overall } = approachDispersion([
      shot({ penaltyType: 'STROKE_AND_DISTANCE', endLie: 'FAIRWAY' }),
      shot({ category: 'SHORT_GAME', endLie: 'ROUGH', missDirection: 'LEFT' }),
    ]);
    expect(overall.shots).toBe(0);
  });
});

describe('shortGameDispersion', () => {
  it('includes greenside bunker shots but not fairway bunker shots', () => {
    const { overall } = shortGameDispersion([
      shot({ category: 'SHORT_GAME', startDistance: 15 }),
      shot({ category: 'BUNKER', bunkerSubtype: 'greenside', startLie: 'SAND', startDistance: 12 }),
      shot({ category: 'BUNKER', bunkerSubtype: 'fairway', startLie: 'SAND', startDistance: 80 }),
    ]);
    expect(overall.shots).toBe(2);
  });
});

describe('teeDispersion', () => {
  const tee = (o: Partial<EnrichedShot>) => shot({ category: 'OFF_THE_TEE', startLie: 'TEE', startDistance: 400, shotNo: 1, ...o });

  it('uses the fairways-hit definition and counts each side', () => {
    const t = teeDispersion([
      tee({ endLie: 'FAIRWAY' }),
      tee({ endLie: 'FAIRWAY' }),
      tee({ endLie: 'ROUGH', missDirection: 'LEFT' }),
      tee({ endLie: 'RECOVERY', missDirection: 'RIGHT' }),
      tee({ endLie: 'SAND' }),
      tee({ endLie: 'GREEN' }),
    ]);
    expect(t).toMatchObject({ teeShots: 6, fairways: 2, onGreen: 1, left: 1, right: 1, untagged: 1 });
    expect(t.fairwayPct).toBeCloseTo(2 / 6, 9);
  });

  it('never counts a LONG tag on a tee shot, and skips replays', () => {
    const t = teeDispersion([tee({ endLie: 'ROUGH', missDirection: 'LONG' }), tee({ penaltyType: 'STROKE_AND_DISTANCE', endLie: 'TEE' })]);
    expect(t).toMatchObject({ teeShots: 1, left: 0, right: 0, untagged: 1 });
  });
});

describe('puttingProfile', () => {
  const putt = (o: Partial<EnrichedShot>) =>
    shot({ category: 'PUTTING', startLie: 'GREEN', startDistance: 8, endLie: 'GREEN', endDistance: 2, ...o });

  it('counts makes, misses and each direction', () => {
    const { overall } = puttingProfile([
      putt({ holed: true, endLie: null }),
      putt({ missDirection: 'SHORT' }),
      putt({ missDirection: 'LONG' }),
      putt({ missDirection: 'LEFT', puttBreak: 'LEFT_TO_RIGHT' }),
      putt({}),
    ]);
    expect(overall).toMatchObject({ putts: 5, made: 1, missed: 4, tagged: 3, short: 1, long: 1, left: 1, high: 1, low: 0 });
    expect(overall.makePct).toBeCloseTo(0.2, 9);
  });

  it('reads speed from short vs long, at the 0.6 / 0.4 lines', () => {
    expect(speedTendency(6, 4)).toBe('conservative');
    expect(speedTendency(4, 6)).toBe('aggressive');
    expect(speedTendency(5, 5)).toBe('balanced');
    expect(speedTendency(4, 3)).toBeNull(); // fewer than MIN_TAGGED
  });

  it('derives the high and low side per break, and keeps an unknown-break row', () => {
    const { overall } = puttingProfile([
      putt({ puttBreak: 'LEFT_TO_RIGHT', missDirection: 'LEFT' }), // high
      putt({ puttBreak: 'LEFT_TO_RIGHT', missDirection: 'RIGHT' }), // low
      putt({ puttBreak: 'RIGHT_TO_LEFT', missDirection: 'RIGHT' }), // high
      putt({ puttBreak: 'STRAIGHT', missDirection: 'LEFT' }), // no side
      putt({ missDirection: 'RIGHT' }), // unknown break
    ]);
    expect(overall.high).toBe(2);
    expect(overall.low).toBe(1);
    expect(overall.byBreak.map((b) => b.break)).toEqual(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT', 'STRAIGHT', 'UNKNOWN']);
    expect(overall.byBreak[0]).toMatchObject({ putts: 2, missLeft: 1, missRight: 1, high: 1, low: 1, enough: false });
  });

  it('splits by putting band and by slope', () => {
    const { bands, overall } = puttingProfile([
      putt({ startDistance: 2, holed: true, endLie: null, puttSlope: 'UPHILL' }),
      putt({ startDistance: 25, puttSlope: 'DOWNHILL' }),
    ]);
    expect(bands.map((b) => b.band)).toEqual(['0-3ft', '20-30ft']);
    expect(overall.bySlope).toEqual([
      { slope: 'UPHILL', putts: 1, made: 1 },
      { slope: 'DOWNHILL', putts: 1, made: 0 },
    ]);
  });
});

describe('empty input', () => {
  it('gives zeros, no NaN, and nothing enough', () => {
    const a = approachDispersion([]);
    const t = teeDispersion([]);
    const p = puttingProfile([]);
    expect(a.overall.onGreenPct).toBe(0);
    expect(Object.values(a.overall.shares).every((v) => v === 0)).toBe(true);
    expect(t.fairwayPct).toBe(0);
    expect(p.overall.makePct).toBe(0);
    expect([a.overall.enough, t.enough, p.overall.enough]).toEqual([false, false, false]);
    expect(dispersionHeadline(a, p)).toBeNull();
  });
});

describe('dispersionHeadline', () => {
  it('names the dominant approach miss and the putting speed', () => {
    const approach = approachDispersion([...times(6, { endLie: 'ROUGH', missDirection: 'LEFT' }), ...times(2, { endLie: 'ROUGH', missDirection: 'RIGHT' })]);
    const putting = puttingProfile(
      [...times(7, { category: 'PUTTING', startLie: 'GREEN', startDistance: 8, missDirection: 'SHORT' }), ...times(2, { category: 'PUTTING', startLie: 'GREEN', startDistance: 8, missDirection: 'LONG' })],
    );
    expect(dispersionHeadline(approach, putting)).toBe(
      'Approach shots that miss the green mostly finish left (75% of 8 tagged misses); putts you miss tend to finish short.',
    );
  });
});
