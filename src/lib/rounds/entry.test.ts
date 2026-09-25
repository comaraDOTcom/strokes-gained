import { describe, it, expect } from 'vitest';
import {
  MISS_OPTIONS,
  defaultResultLie,
  describeEntry,
  normaliseShotTags,
  parseShotTags,
  puttSideLabel,
  sideOfMiss,
  swipeToHoleDelta,
  tagGroupsFor,
  type StoredShotTags,
  type TagContext,
} from './entry';

describe('defaultResultLie', () => {
  it('pre-selects GREEN once the last shot finished on the green', () => {
    expect(
      defaultResultLie([
        { holed: false, endLie: 'FAIRWAY' },
        { holed: false, endLie: 'GREEN' },
      ]),
    ).toBe('GREEN');
  });

  it('keeps pre-selecting GREEN through a run of putts', () => {
    expect(
      defaultResultLie([
        { holed: false, endLie: 'GREEN' },
        { holed: false, endLie: 'GREEN' },
      ]),
    ).toBe('GREEN');
  });

  it('pre-selects nothing when the last shot ended off the green', () => {
    expect(defaultResultLie([{ holed: false, endLie: 'ROUGH' }])).toBeNull();
    expect(defaultResultLie([{ holed: false, endLie: 'SAND' }])).toBeNull();
    expect(defaultResultLie([{ holed: false, endLie: 'TEE' }])).toBeNull();
  });

  it('pre-selects nothing for a new hole or a finished hole', () => {
    expect(defaultResultLie([])).toBeNull();
    expect(
      defaultResultLie([
        { holed: false, endLie: 'GREEN' },
        { holed: true, endLie: null },
      ]),
    ).toBeNull();
  });

  it('pre-selects nothing when the last shot has no end lie', () => {
    expect(defaultResultLie([{ holed: false, endLie: null }])).toBeNull();
  });
});


describe('describeEntry', () => {
  const tee = { lie: 'TEE' as const, yards: 390 };

  it("makes Michael's mix-up obvious: typing the drive length implies a short shot", () => {
    expect(describeEntry(tee, 'FAIRWAY', 290)).toEqual({ kind: 'travelled', text: 'This shot travelled about 100y' });
    expect(describeEntry(tee, 'FAIRWAY', 100)).toEqual({ kind: 'travelled', text: 'This shot travelled about 290y' });
  });

  it('converts a GREEN result from feet', () => {
    expect(describeEntry({ lie: 'FAIRWAY', yards: 150 }, 'GREEN', 30)).toEqual({
      kind: 'travelled',
      text: 'This shot travelled about 140y',
    });
  });

  it('describes putts in feet', () => {
    expect(describeEntry({ lie: 'GREEN', yards: 20 / 3 }, 'GREEN', 3)).toEqual({
      kind: 'travelled',
      text: 'This putt travelled about 17ft',
    });
  });

  it('warns when the ball would finish further away than it started', () => {
    const r = describeEntry({ lie: 'FAIRWAY', yards: 100 }, 'ROUGH', 290);
    expect(r?.kind).toBe('warning');
    expect(r?.text).toContain('100y');
  });

  it('a putt knocked past to a longer distance warns in feet', () => {
    expect(describeEntry({ lie: 'GREEN', yards: 2 }, 'GREEN', 12)?.text).toContain('6ft');
  });

  it('returns nothing for empty or negative input', () => {
    expect(describeEntry(tee, 'FAIRWAY', NaN)).toBeNull();
    expect(describeEntry(tee, 'FAIRWAY', -5)).toBeNull();
  });
});

describe('swipeToHoleDelta', () => {
  const base = { startX: 200, startY: 400, endY: 400, viewportWidth: 375 };
  it('left swipe = next hole, right swipe = previous', () => {
    expect(swipeToHoleDelta({ ...base, endX: 100 })).toBe(1);
    expect(swipeToHoleDelta({ ...base, endX: 300 })).toBe(-1);
  });
  it('ignores short movements and taps', () => {
    expect(swipeToHoleDelta({ ...base, endX: 150 })).toBe(0);
    expect(swipeToHoleDelta({ ...base, endX: 200 })).toBe(0);
  });
  it('ignores vertical scrolling and diagonal drags', () => {
    expect(swipeToHoleDelta({ ...base, endX: 120, endY: 700 })).toBe(0);
    expect(swipeToHoleDelta({ ...base, endX: 120, endY: 445 })).toBe(0); // 80 across, 45 down: not clearly horizontal
    expect(swipeToHoleDelta({ ...base, endX: 100, endY: 430 })).toBe(1); // 100 across, 30 down: fine
  });
  it("leaves the screen edges to the browser's own back/forward gesture", () => {
    expect(swipeToHoleDelta({ ...base, startX: 10, endX: 200 })).toBe(0);
    expect(swipeToHoleDelta({ ...base, startX: 365, endX: 150 })).toBe(0);
  });
});

describe('parseShotTags — shot-shape tags', () => {
  it('accepts every allowed value, null and undefined', () => {
    for (const missDirection of ['LEFT', 'RIGHT', 'LONG', 'SHORT', null, undefined]) {
      expect(parseShotTags({ missDirection }).ok).toBe(true);
    }
    for (const puttSlope of ['UPHILL', 'DOWNHILL', 'FLAT', null]) expect(parseShotTags({ puttSlope }).ok).toBe(true);
    for (const puttBreak of ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT', 'STRAIGHT', null]) expect(parseShotTags({ puttBreak }).ok).toBe(true);
    const r = parseShotTags({ missDirection: 'LEFT', puttSlope: 'UPHILL', puttBreak: 'STRAIGHT' });
    expect(r).toMatchObject({ ok: true, missDirection: 'LEFT', puttSlope: 'UPHILL', puttBreak: 'STRAIGHT', focus: undefined });
  });

  it('rejects lower-case, unknown values, numbers and the old high/low-side idea', () => {
    for (const missDirection of ['left', 'UP', 3, 'HIGH_SIDE']) {
      const r = parseShotTags({ missDirection });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/missDirection/);
    }
    expect(parseShotTags({ puttBreak: 'LEFT' }).ok).toBe(false);
    expect(parseShotTags({ puttSlope: 'up' }).ok).toBe(false);
  });
});

const ctx = (o: Partial<TagContext>): TagContext => ({ startLie: 'FAIRWAY', par: 4, endLie: 'ROUGH', holed: false, penaltyType: null, ...o });

describe('tagGroupsFor', () => {
  it.each([
    ['tee shot to the rough on a par 4', ctx({ startLie: 'TEE', endLie: 'ROUGH' }), { putt: false, miss: 'tee' }],
    ['tee shot to the fairway', ctx({ startLie: 'TEE', endLie: 'FAIRWAY' }), { putt: false, miss: null }],
    ['tee shot to the green (drivable par 4)', ctx({ startLie: 'TEE', endLie: 'GREEN' }), { putt: false, miss: null }],
    ['par-3 tee shot to the rough: a green miss', ctx({ startLie: 'TEE', par: 3, endLie: 'ROUGH' }), { putt: false, miss: 'green' }],
    ['approach that finds the green', ctx({ endLie: 'GREEN' }), { putt: false, miss: null }],
    ['chip that stays in the rough', ctx({ startLie: 'ROUGH', endLie: 'ROUGH' }), { putt: false, miss: 'green' }],
    ['missed putt', ctx({ startLie: 'GREEN', endLie: 'GREEN' }), { putt: true, miss: 'putt' }],
    ['holed putt keeps slope/break, no miss', ctx({ startLie: 'GREEN', endLie: null, holed: true }), { putt: true, miss: null }],
    ['stroke and distance: nothing', ctx({ startLie: 'TEE', penaltyType: 'STROKE_AND_DISTANCE' }), { putt: false, miss: null }],
    ['no result chosen yet: no miss', ctx({ endLie: null }), { putt: false, miss: null }],
  ])('%s', (_name, c, expected) => {
    expect(tagGroupsFor(c)).toEqual(expected);
  });

  it('offers left/right only off the tee', () => {
    expect(MISS_OPTIONS.tee).toEqual(['LEFT', 'RIGHT']);
  });
});

describe('normaliseShotTags', () => {
  const tags = (o: Partial<StoredShotTags>): StoredShotTags => ({
    focus: null, commitment: null, missDirection: null, puttSlope: null, puttBreak: null, ...o,
  });

  it('rejects long or short of a fairway', () => {
    const r = normaliseShotTags(tags({ missDirection: 'LONG' }), ctx({ startLie: 'TEE', endLie: 'ROUGH' }));
    expect(r.ok).toBe(false);
  });

  it('keeps a left miss off the tee', () => {
    const r = normaliseShotTags(tags({ missDirection: 'LEFT' }), ctx({ startLie: 'TEE', endLie: 'ROUGH' }));
    expect(r).toEqual({ ok: true, tags: tags({ missDirection: 'LEFT' }) });
  });

  it('quietly drops putt tags on a shot that is no longer a putt, and keeps mentality tags', () => {
    const r = normaliseShotTags(tags({ focus: 'EXTERNAL', puttSlope: 'UPHILL', puttBreak: 'STRAIGHT' }), ctx({ startLie: 'ROUGH' }));
    expect(r).toEqual({ ok: true, tags: tags({ focus: 'EXTERNAL' }) });
  });

  it('drops the miss on a holed shot', () => {
    const r = normaliseShotTags(tags({ missDirection: 'SHORT' }), ctx({ startLie: 'GREEN', endLie: null, holed: true }));
    expect(r).toEqual({ ok: true, tags: tags({}) });
  });
});

describe('sideOfMiss / puttSideLabel', () => {
  it('reads the high side from the break', () => {
    expect(sideOfMiss('LEFT_TO_RIGHT', 'LEFT')).toBe('HIGH');
    expect(sideOfMiss('LEFT_TO_RIGHT', 'RIGHT')).toBe('LOW');
    expect(sideOfMiss('RIGHT_TO_LEFT', 'RIGHT')).toBe('HIGH');
    expect(sideOfMiss('RIGHT_TO_LEFT', 'LEFT')).toBe('LOW');
    expect(puttSideLabel('LEFT_TO_RIGHT', 'LEFT')).toBe('high side');
  });

  it('has no side for a straight or unknown putt, or a putt missed short or long', () => {
    expect(sideOfMiss('STRAIGHT', 'LEFT')).toBeNull();
    expect(sideOfMiss(null, 'RIGHT')).toBeNull();
    expect(sideOfMiss('LEFT_TO_RIGHT', 'SHORT')).toBeNull();
    expect(sideOfMiss('RIGHT_TO_LEFT', 'LONG')).toBeNull();
    expect(puttSideLabel('STRAIGHT', 'LEFT')).toBeNull();
  });
});
