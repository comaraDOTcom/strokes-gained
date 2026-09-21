import { describe, it, expect } from 'vitest';
import { defaultResultLie, describeEntry } from './entry';

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
