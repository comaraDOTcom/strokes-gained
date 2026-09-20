import { describe, it, expect } from 'vitest';
import { defaultResultLie } from './entry';

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
