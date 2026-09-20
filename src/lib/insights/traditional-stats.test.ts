import { describe, expect, it } from 'vitest';
import {
  computeHoleTraditionalStats,
  aggregateTraditionalStats,
  type TraditionalStatShot,
} from './traditional-stats';

describe('computeHoleTraditionalStats — GIR', () => {
  it('par 4: reaching the green in 2 is GIR', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 4).gir).toBe(true);
  });

  it('par 4: reaching the green in 3 is NOT GIR', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'ROUGH', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'FAIRWAY', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 4).gir).toBe(false);
  });

  it('par 3: only the tee shot itself counts', () => {
    const hit: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, hit, 3).gir).toBe(true);

    const miss: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'ROUGH', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, miss, 3).gir).toBe(false);
  });

  it('par 5: reaching the green in 3 is GIR', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'FAIRWAY', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 5).gir).toBe(true);
  });

  it('a hole-in-one / directly-holed approach within regulation counts as GIR', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 3).gir).toBe(true);
  });
});

describe('computeHoleTraditionalStats — putts', () => {
  it('counts every shot starting on the green', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'GREEN', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 3).putts).toBe(2);
  });
});

describe('computeHoleTraditionalStats — fairway hit', () => {
  it('is null on a par 3', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 3).fairwayHit).toBeNull();
  });

  it('is true/false on par 4/5 based on the tee shot only', () => {
    const hit: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, hit, 4).fairwayHit).toBe(true);

    const miss: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, miss, 4).fairwayHit).toBe(false);
  });

  it('an OB tee shot (stroke-and-distance forces endLie back to TEE) is a fairway miss', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'TEE', holed: false, penaltyStrokes: 1 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 4).fairwayHit).toBe(false);
  });
});

describe('computeHoleTraditionalStats — up-and-down and sand save', () => {
  it('is not attempted when GIR is true', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 3);
    expect(stats.upAndDown.attempted).toBe(false);
    expect(stats.sandSave.attempted).toBe(false);
  });

  it('converts: chip + 1 putt from off the green, par or better', () => {
    // Par 4, miss green in 2 (rough), chip + 1 putt = 4 total = par.
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'ROUGH', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.gir).toBe(false);
    expect(stats.upAndDown).toEqual({ attempted: true, converted: true });
    expect(stats.sandSave.attempted).toBe(false);
  });

  it('converts on a straight-in chip (1 shot, not 2) — still counted as a successful save', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'ROUGH', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.upAndDown).toEqual({ attempted: true, converted: true });
  });

  it('does not convert: takes 3+ shots from the miss, even if still par-or-better is impossible', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'ROUGH', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 5, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.upAndDown).toEqual({ attempted: true, converted: false });
  });

  it('sand save is the up-and-down subset where the shot after the miss started in SAND', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'SAND', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'SAND', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.upAndDown).toEqual({ attempted: true, converted: true });
    expect(stats.sandSave).toEqual({ attempted: true, converted: true });
  });

  it('a failed sand save is still an attempt (does not misleadingly disappear)', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'SAND', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'SAND', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 5, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.sandSave).toEqual({ attempted: true, converted: false });
  });

  it('does not flag a missed-green attempt while the hole is still mid-entry (regulation window not yet closed)', () => {
    // Par 5, only 1 shot logged so far (regulation window is 3 shots) — too early to call GIR false.
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'ROUGH', holed: false, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 5);
    expect(stats.upAndDown.attempted).toBe(false);
  });

  it('a recovery-lie miss is an up-and-down attempt but never a sand save', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 2, startLie: 'FAIRWAY', endLie: 'RECOVERY', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'RECOVERY', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
      { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    const stats = computeHoleTraditionalStats(1, shots, 4);
    expect(stats.upAndDown).toEqual({ attempted: true, converted: true });
    expect(stats.sandSave.attempted).toBe(false);
  });
});

describe('computeHoleTraditionalStats — gross score derivation', () => {
  it('includes penalty strokes', () => {
    const shots: TraditionalStatShot[] = [
      { shotNo: 1, startLie: 'TEE', endLie: 'TEE', holed: false, penaltyStrokes: 1 },
      { shotNo: 2, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
      { shotNo: 3, startLie: 'FAIRWAY', endLie: null, holed: true, penaltyStrokes: 0 },
    ];
    expect(computeHoleTraditionalStats(1, shots, 4).grossScore).toBe(4);
  });
});

describe('aggregateTraditionalStats', () => {
  it('sums across holes correctly', () => {
    const holes = [
      computeHoleTraditionalStats(1, [
        { shotNo: 1, startLie: 'TEE', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
        { shotNo: 2, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
      ], 3),
      computeHoleTraditionalStats(2, [
        { shotNo: 1, startLie: 'TEE', endLie: 'FAIRWAY', holed: false, penaltyStrokes: 0 },
        { shotNo: 2, startLie: 'FAIRWAY', endLie: 'SAND', holed: false, penaltyStrokes: 0 },
        { shotNo: 3, startLie: 'SAND', endLie: 'GREEN', holed: false, penaltyStrokes: 0 },
        { shotNo: 4, startLie: 'GREEN', endLie: null, holed: true, penaltyStrokes: 0 },
      ], 4),
    ];
    const agg = aggregateTraditionalStats(holes);
    expect(agg.girTotal).toBe(2);
    expect(agg.girCount).toBe(1);
    expect(agg.putts).toBe(2);
    expect(agg.fairwaysTotal).toBe(1);
    expect(agg.fairwaysHit).toBe(1);
    expect(agg.upAndDown).toEqual({ attempted: 1, converted: 1 });
    expect(agg.sandSave).toEqual({ attempted: 1, converted: 1 });
    expect(agg.grossScore).toBe(6);
  });
});
