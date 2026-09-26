import { describe, expect, it } from 'vitest';
import raw from './data/drills.json';
import { DRILLS, drillById, drillsFor, parseDrills, passes } from './drills';

describe('the drill library', () => {
  it('seeds the five drills from issue #55', () => {
    expect(DRILLS.map((d) => d.id)).toEqual([
      'approach-ladder',
      'wedge-matrix',
      'circle-putting',
      'lag-putting',
      'bunker-to-10ft',
    ]);
  });

  it('every drill is scored: a pass mark out of a fixed number of balls', () => {
    for (const d of DRILLS) {
      expect(d.outOf, d.id).toBeGreaterThan(0);
      expect(d.passMark, d.id).toBeGreaterThan(0);
      expect(d.passMark, d.id).toBeLessThanOrEqual(d.outOf);
    }
    expect(drillById('circle-putting')).toMatchObject({ outOf: 20, passMark: 16 });
  });

  it('every drill is random practice: its steps change the shot on every ball', () => {
    // No blocked practice: the steps must say the target, distance, hole or lie changes each time.
    const random = /(random order|after every|every putt|every ball|each time|never the same)/i;
    for (const d of DRILLS) expect(d.steps.join(' '), d.id).toMatch(random);
  });

  it('rejects a malformed library instead of rendering it', () => {
    const good = (raw as { drills: unknown[] }).drills[0] as Record<string, unknown>;
    expect(() => parseDrills({ drills: [{ ...good, passMark: 99 }] })).toThrow(/passMark/);
    expect(() => parseDrills({ drills: [good, good] })).toThrow(/duplicate/);
    expect(() => parseDrills({ drills: [{ ...good, area: 'CHIPPING' }] })).toThrow(/area/);
    expect(() => parseDrills({ drills: [{ ...good, steps: [] }] })).toThrow(/steps/);
    expect(() => parseDrills({ drills: [{ ...good, range: { min: 10, max: 5 } }] })).toThrow(/range/);
    expect(() => parseDrills({})).toThrow();
  });
});

describe('drillsFor', () => {
  it('matches by area and distance, best cover first', () => {
    expect(drillsFor('APPROACH', { min: 140, max: 170 }).map((d) => d.id)).toEqual(['approach-ladder']);
    expect(drillsFor('APPROACH', { min: 60, max: 90 }).map((d) => d.id)).toEqual(['wedge-matrix']);
    // 90–120 straddles both: the ladder covers 20 of 30 yards, the matrix 10.
    expect(drillsFor('APPROACH', { min: 90, max: 120 }).map((d) => d.id)).toEqual(['approach-ladder', 'wedge-matrix']);
    expect(drillsFor('PUTTING', { min: 4, max: 8 }).map((d) => d.id)).toEqual(['circle-putting']);
    expect(drillsFor('PUTTING', { min: 30, max: 50 }).map((d) => d.id)).toEqual(['lag-putting']);
    expect(drillsFor('PUTTING', { min: 50, max: Infinity }).map((d) => d.id)).toEqual(['lag-putting']);
  });

  it('matches bunkers by type, and lists the area when there is no focus', () => {
    expect(drillsFor('BUNKER', null, 'greenside').map((d) => d.id)).toEqual(['bunker-to-10ft']);
    expect(drillsFor('BUNKER', null, 'fairway')).toEqual([]);
    expect(drillsFor('PUTTING', null).map((d) => d.id)).toEqual(['circle-putting', 'lag-putting']);
  });

  it('offers nothing rather than an unrelated drill', () => {
    expect(drillsFor('OFF_THE_TEE', null)).toEqual([]);
    expect(drillsFor('SHORT_GAME', { min: 10, max: 20 })).toEqual([]);
    expect(drillsFor('PUTTING', { min: 15, max: 20 })).toEqual([]);
  });
});

describe('passes', () => {
  it('passes at the mark, fails one under it', () => {
    expect(passes(16, 16)).toBe(true);
    expect(passes(15, 16)).toBe(false);
  });
});
