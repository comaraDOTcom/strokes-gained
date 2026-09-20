import { describe, expect, it } from 'vitest';
import { puttingBand, shortGameBand, approachBand } from './bands';

describe('puttingBand', () => {
  it('buckets the documented boundaries (0-3, 3-6, 6-10, 10-20, 20-30, 30ft+)', () => {
    expect(puttingBand(2).label).toBe('0-3ft');
    expect(puttingBand(3).label).toBe('0-3ft');
    expect(puttingBand(4).label).toBe('3-6ft');
    expect(puttingBand(6).label).toBe('3-6ft');
    expect(puttingBand(7).label).toBe('6-10ft');
    expect(puttingBand(10).label).toBe('6-10ft');
    expect(puttingBand(15).label).toBe('10-20ft');
    expect(puttingBand(25).label).toBe('20-30ft');
    expect(puttingBand(31).label).toBe('30ft+');
    expect(puttingBand(120).label).toBe('30ft+');
  });

  it('order increases monotonically with distance', () => {
    expect(puttingBand(2).order).toBeLessThan(puttingBand(15).order);
    expect(puttingBand(15).order).toBeLessThan(puttingBand(35).order);
  });
});

describe('shortGameBand', () => {
  it('buckets 0-10, 10-20, 20-30y', () => {
    expect(shortGameBand(5).label).toBe('0-10y');
    expect(shortGameBand(15).label).toBe('10-20y');
    expect(shortGameBand(28).label).toBe('20-30y');
  });
});

describe('approachBand', () => {
  it('buckets <100, 100-150, 150-200, 200y+', () => {
    expect(approachBand(80).label).toBe('<100y');
    expect(approachBand(130).label).toBe('100-150y');
    expect(approachBand(180).label).toBe('150-200y');
    expect(approachBand(250).label).toBe('200y+');
  });
});
