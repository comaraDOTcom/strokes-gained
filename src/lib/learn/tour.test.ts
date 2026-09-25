import { describe, expect, it } from 'vitest';
import { buildTour } from './tour';
import { expectedStrokes } from '../sg/interpolate';

describe('buildTour', () => {
  const tour = buildTour();

  it('is a five-stroke bogey on a 400-yard par 4', () => {
    expect(tour.strokes).toBe(5);
    expect(tour.par).toBe(4);
    expect(tour.shots.at(-1)!.to.lie).toBeNull();
  });

  it('adds up exactly: expected from the tee minus strokes taken', () => {
    expect(tour.totalSg).toBeCloseTo(expectedStrokes('TEE', 400) - 5, 9);
    expect(tour.shots.at(-1)!.runningSg).toBeCloseTo(tour.totalSg, 9);
  });

  it('chains: each shot starts where the last one finished', () => {
    for (let i = 1; i < tour.shots.length; i++) {
      expect(tour.shots[i]!.from.lie).toBe(tour.shots[i - 1]!.to.lie);
      expect(tour.shots[i]!.from.distance).toBe(tour.shots[i - 1]!.to.distance);
      expect(tour.shots[i]!.from.at).toEqual(tour.shots[i - 1]!.to.at);
    }
  });

  it('tells the intended story: good drive and bunker shot, costly approach and putt', () => {
    const sgs = tour.shots.map((s) => s.sg);
    expect(sgs[0]).toBeGreaterThan(0);
    expect(sgs[1]).toBeLessThan(-0.3);
    expect(sgs[2]).toBeGreaterThan(0);
    expect(sgs[3]).toBeLessThan(-0.3);
  });

  it('shows the sum each shot is scored by', () => {
    expect(tour.shots[0]!.sum).toMatch(/^4\.09 − \d\.\d\d − 1 = \+0\.\d\d$/);
    expect(tour.shots.at(-1)!.to.expected).toBe(0);
  });
});
