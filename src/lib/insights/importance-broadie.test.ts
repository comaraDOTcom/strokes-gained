import { describe, expect, it } from 'vitest';
import { BROADIE_GROUPS, BROADIE_IMPORTANCE, validateImportance, type ImportanceTable } from './importance-broadie';

describe('BROADIE_IMPORTANCE (committed table)', () => {
  it('validates', () => {
    expect(validateImportance(BROADIE_IMPORTANCE)).toEqual([]);
  });

  it('has a share for every group, each between 0 and 1, adding up to 1', () => {
    const total = BROADIE_GROUPS.reduce((a, g) => a + BROADIE_IMPORTANCE.share[g], 0);
    expect(total).toBeCloseTo(1, 2);
    for (const g of BROADIE_GROUPS) {
      expect(BROADIE_IMPORTANCE.share[g]).toBeGreaterThan(0);
      expect(BROADIE_IMPORTANCE.share[g]).toBeLessThan(1);
    }
  });

  it('long game (driving + approach) is about two-thirds, per Broadie', () => {
    const longGame = BROADIE_IMPORTANCE.share.OFF_THE_TEE + BROADIE_IMPORTANCE.share.APPROACH;
    expect(longGame).toBeGreaterThan(0.6);
    expect(longGame).toBeLessThan(0.75);
  });
});

describe('validateImportance', () => {
  const base = (): ImportanceTable => structuredClone(BROADIE_IMPORTANCE);

  it('names a share outside (0, 1)', () => {
    const t = base();
    t.share.APPROACH = 1.2;
    expect(validateImportance(t).join(' ')).toMatch(/share\.APPROACH/);
  });

  it('names shares that do not add up to 1', () => {
    const t = base();
    t.share.PUTTING = 0.05; // total 0.9
    expect(validateImportance(t).join(' ')).toMatch(/add up to 0\.900/);
  });

  it('names a bad bucketShare', () => {
    const t = base();
    t.bucketShare = { 'APPROACH:100-150y': -0.1 };
    expect(validateImportance(t).join(' ')).toMatch(/APPROACH:100-150y/);
  });

  it('names an unknown status', () => {
    const t = base();
    (t.source as { status: string }).status = 'draft';
    expect(validateImportance(t).join(' ')).toMatch(/status/);
  });
});
