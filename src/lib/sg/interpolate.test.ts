import { describe, expect, it } from 'vitest';
import { expectedStrokes } from './interpolate';

describe('expectedStrokes — basic contract', () => {
  it('returns 0 when distance is 0 (ball already in the hole)', () => {
    expect(expectedStrokes('FAIRWAY', 0)).toBe(0);
    expect(expectedStrokes('GREEN', 0)).toBe(0);
    expect(expectedStrokes('TEE', 0)).toBe(0);
  });

  it('returns exact anchor values at anchor points', () => {
    // FAIRWAY anchor [150, 3.11]
    expect(expectedStrokes('FAIRWAY', 150)).toBeCloseTo(3.11, 10);
    // GREEN anchor [20, 1.93]
    expect(expectedStrokes('GREEN', 20)).toBeCloseTo(1.93, 10);
    // TEE anchor [300, 3.67]
    expect(expectedStrokes('TEE', 300)).toBeCloseTo(3.67, 10);
  });

  it('linearly interpolates between two anchors', () => {
    // TEE(413) between [400, 4.09] and [420, 4.17]: 4.09 + 13/20*0.08 = 4.142
    expect(expectedStrokes('TEE', 413)).toBeCloseTo(4.142, 10);
  });

  it('clamps below the first anchor to the first anchor value (non-GREEN)', () => {
    // FAIRWAY first anchor is [5, 2.15]
    expect(expectedStrokes('FAIRWAY', 1)).toBeCloseTo(2.15, 10);
    expect(expectedStrokes('FAIRWAY', 3)).toBeCloseTo(2.15, 10);
    expect(expectedStrokes('FAIRWAY', 5)).toBeCloseTo(2.15, 10);
  });

  it('GREEN at <= 1ft returns exactly 1.0, overriding the raw anchor', () => {
    // The GREEN anchor table lists [1, 1.001], but the spec explicitly
    // overrides d<=1 to 1.0 (holing out is certain from a gimme).
    expect(expectedStrokes('GREEN', 1)).toBe(1.0);
    expect(expectedStrokes('GREEN', 0.5)).toBe(1.0);
  });

  it('extrapolates above the last anchor using the final segment slope', () => {
    // TEE last two anchors: [580, 4.86], [600, 4.95] -> slope 0.0045/yard
    const slope = (4.95 - 4.86) / (600 - 580);
    expect(expectedStrokes('TEE', 650)).toBeCloseTo(4.95 + slope * 50, 10);
  });
});
