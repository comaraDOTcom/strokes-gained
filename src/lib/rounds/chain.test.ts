import { describe, it, expect } from 'vitest';
import { propagateChain, type ChainShot } from './chain';
import { parseShotTags } from './entry';

const shot = (o: Partial<ChainShot> & { shotNo: number }): ChainShot => ({
  startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 150, holed: false, penaltyType: null, ...o,
});

describe('propagateChain', () => {
  it('re-derives later starts from the edited shot but keeps their results', () => {
    const hole = [
      shot({ shotNo: 1, endLie: 'ROUGH', endYards: 180 }), // just edited: was FAIRWAY 150
      shot({ shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endLie: 'GREEN', endYards: 8 }),
      shot({ shotNo: 3, startLie: 'GREEN', startYards: 8, endLie: null, endYards: 0, holed: true }),
    ];
    const tail = propagateChain(hole, 0);
    expect(tail).toHaveLength(2);
    expect(tail[0]).toMatchObject({ shotNo: 2, startLie: 'ROUGH', startYards: 180, endLie: 'GREEN', endYards: 8 });
    // shot 3 follows shot 2, whose end didn't change
    expect(tail[1]).toMatchObject({ shotNo: 3, startLie: 'GREEN', startYards: 8, holed: true });
  });

  it('carries a change through a stroke-and-distance shot, whose end equals its start', () => {
    const hole = [
      shot({ shotNo: 1, endLie: 'ROUGH', endYards: 200 }),
      shot({ shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endLie: 'FAIRWAY', endYards: 150, penaltyType: 'STROKE_AND_DISTANCE' }),
      shot({ shotNo: 3, startLie: 'FAIRWAY', startYards: 150, endLie: 'GREEN', endYards: 5 }),
    ];
    const tail = propagateChain(hole, 0);
    expect(tail[0]).toMatchObject({ startLie: 'ROUGH', startYards: 200, endLie: 'ROUGH', endYards: 200 });
    expect(tail[1]).toMatchObject({ startLie: 'ROUGH', startYards: 200, endLie: 'GREEN', endYards: 5 });
  });

  it('does not overwrite a lateral-drop end that the user entered', () => {
    const hole = [
      shot({ shotNo: 1, endLie: 'ROUGH', endYards: 200 }),
      shot({ shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endLie: 'FAIRWAY', endYards: 140, penaltyType: 'LATERAL' }),
    ];
    expect(propagateChain(hole, 0)[0]).toMatchObject({ startLie: 'ROUGH', startYards: 200, endLie: 'FAIRWAY', endYards: 140 });
  });

  it('drops the tail when the edited shot finishes the hole', () => {
    const hole = [shot({ shotNo: 1, endLie: null, endYards: 0, holed: true }), shot({ shotNo: 2 })];
    expect(propagateChain(hole, 0)).toEqual([]);
  });

  it('returns nothing when the last shot is edited', () => {
    expect(propagateChain([shot({ shotNo: 1 }), shot({ shotNo: 2 })], 1)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const hole = [shot({ shotNo: 1, endLie: 'ROUGH', endYards: 180 }), shot({ shotNo: 2, startLie: 'FAIRWAY', startYards: 150 })];
    const snapshot = JSON.stringify(hole);
    propagateChain(hole, 0);
    expect(JSON.stringify(hole)).toBe(snapshot);
  });
});

describe('parseShotTags', () => {
  it('accepts the valid values, null (clear) and undefined (leave alone)', () => {
    expect(parseShotTags({ focus: 'EXTERNAL', commitment: 'HESITANT' })).toEqual({ ok: true, focus: 'EXTERNAL', commitment: 'HESITANT' });
    expect(parseShotTags({ focus: null })).toEqual({ ok: true, focus: null, commitment: undefined });
    expect(parseShotTags({})).toEqual({ ok: true, focus: undefined, commitment: undefined });
  });
  it('rejects anything else', () => {
    expect(parseShotTags({ focus: 'external' }).ok).toBe(false);
    expect(parseShotTags({ commitment: 'YES' }).ok).toBe(false);
    expect(parseShotTags({ focus: 1 }).ok).toBe(false);
  });
});
