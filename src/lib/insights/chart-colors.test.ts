import { describe, it, expect } from 'vitest';
import { fmtSg, niceAxis } from './chart-colors';

describe('niceAxis', () => {
  it('uses round steps, includes zero and leaves room past the longest bar', () => {
    expect(niceAxis([-0.9, -2.0])).toEqual({ domain: [-2.5, 0], ticks: [-2.5, -2, -1.5, -1, -0.5, 0], decimals: 1 });
    expect(niceAxis([29, 32])).toEqual({ domain: [0, 40], ticks: [0, 10, 20, 30, 40], decimals: 0 });
    const mixed = niceAxis([1.3, -5.4]);
    expect(mixed.domain[0]).toBeLessThan(-5.4);
    expect(mixed.domain[1]).toBeGreaterThan(1.3);
    expect(mixed.ticks).toContain(0);
  });
  it('asks for enough decimals that small ranges never repeat a tick label', () => {
    const a = niceAxis([-0.1]);
    expect(a.decimals).toBe(2);
    expect(new Set(a.ticks.map((t) => t.toFixed(a.decimals))).size).toBe(a.ticks.length);
  });

  it('copes with no data', () => {
    expect(niceAxis([]).ticks).toContain(0);
  });
});

describe('fmtSg', () => {
  it('never shows a signed zero', () => {
    expect(fmtSg(-0.04, 1)).toBe('0.0');
    expect(fmtSg(0.26, 1)).toBe('+0.3');
    expect(fmtSg(-1.234)).toBe('-1.23');
  });
});
