import { describe, expect, it } from 'vitest';
import { expectedStrokes } from './interpolate';
import { SCRATCH_BASELINE, type Lie } from './baseline-scratch';
import { ELM_PARK } from '../../db/seed-courses';

const ALL_LIES: Lie[] = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY', 'GREEN'];

describe('baseline structural properties', () => {
  it('every anchor table is strictly increasing in both distance and expected strokes', () => {
    for (const lie of ALL_LIES) {
      const anchors = SCRATCH_BASELINE[lie];
      for (let i = 1; i < anchors.length; i++) {
        const [prevDist, prevVal] = anchors[i - 1]!;
        const [dist, val] = anchors[i]!;
        expect(dist).toBeGreaterThan(prevDist);
        expect(val).toBeGreaterThan(prevVal);
      }
    }
  });

  it('expectedStrokes is strictly increasing across the anchor domain and beyond (extrapolated)', () => {
    for (const lie of ALL_LIES) {
      const anchors = SCRATCH_BASELINE[lie];
      const firstDist = anchors[0]![0];
      const lastDist = anchors[anchors.length - 1]![0];
      const step = Math.max(1, Math.round((lastDist - firstDist) / 50)) || 1;

      let prev = expectedStrokes(lie, firstDist);
      for (let d = firstDist + step; d <= lastDist + 100; d += step) {
        const cur = expectedStrokes(lie, d);
        expect(cur).toBeGreaterThan(prev);
        prev = cur;
      }
    }
  });

  it('E(GREEN, 1) === 1.0 exactly', () => {
    expect(expectedStrokes('GREEN', 1)).toBe(1.0);
  });

  it('two-putt crossover E(GREEN, d) = 2.0 lands between 24 and 26 feet', () => {
    expect(expectedStrokes('GREEN', 24)).toBeLessThan(2.0);
    expect(expectedStrokes('GREEN', 26)).toBeGreaterThan(2.0);
  });

  it('at equal distance: FAIRWAY < ROUGH < SAND < RECOVERY', () => {
    // Previously (before RECOVERY's tail was widened in baseline-scratch.ts)
    // SAND's steeper long-range slope overtook RECOVERY above ~253y —
    // [220,4.10],[240,4.20],[260,4.30] let SAND(260)=4.31 exceed it. The
    // RECOVERY tail is now [220,4.10],[240,4.24],[260,4.40], which keeps
    // RECOVERY strictly above SAND across the full anchor range, so this
    // covers 10-260y with no gaps or exceptions.
    const distances = [
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
      170, 180, 190, 200, 210, 220, 230, 240, 250, 260,
    ];
    for (const d of distances) {
      const fairway = expectedStrokes('FAIRWAY', d);
      const rough = expectedStrokes('ROUGH', d);
      const sand = expectedStrokes('SAND', d);
      const recovery = expectedStrokes('RECOVERY', d);
      expect(fairway).toBeLessThan(rough);
      expect(rough).toBeLessThan(sand);
      expect(sand).toBeLessThan(recovery);
    }
  });

  it('is calibrated against Elm Park course rating within 1.5 strokes, for both tees', () => {
    for (const tee of ELM_PARK.tees) {
      if (tee.courseRating === null) continue;
      const predicted = ELM_PARK.holes.reduce(
        (sum, hole) => sum + expectedStrokes('TEE', hole.yards[tee.name]!),
        0,
      );
      expect(Math.abs(predicted - tee.courseRating)).toBeLessThanOrEqual(1.5);
    }
  });
});
