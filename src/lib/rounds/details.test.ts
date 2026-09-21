import { describe, it, expect } from 'vitest';
import { parseRoundDetailsPatch, roundTitle, MAX_NAME_LENGTH, MAX_NOTES_LENGTH } from './details';

describe('parseRoundDetailsPatch', () => {
  it('only includes keys that were sent, so a partial update cannot clear other fields', () => {
    expect(parseRoundDetailsPatch({ notes: 'windy' })).toEqual({ ok: true, patch: { notes: 'windy' } });
    expect(parseRoundDetailsPatch({})).toEqual({ ok: true, patch: {} });
  });

  it('trims the name and turns blank into null', () => {
    expect(parseRoundDetailsPatch({ name: '  Medal Final 2026  ' })).toEqual({
      ok: true,
      patch: { name: 'Medal Final 2026' },
    });
    expect(parseRoundDetailsPatch({ name: '   ' })).toEqual({ ok: true, patch: { name: null } });
    expect(parseRoundDetailsPatch({ name: null })).toEqual({ ok: true, patch: { name: null } });
  });

  it('keeps commentary paragraphs and inner whitespace intact, but blanks whitespace-only', () => {
    const notes = '  Front nine: rushed.\n\nBack nine: settled.  ';
    expect(parseRoundDetailsPatch({ notes })).toEqual({ ok: true, patch: { notes } });
    expect(parseRoundDetailsPatch({ notes: ' \n ' })).toEqual({ ok: true, patch: { notes: null } });
  });

  it('enforces length limits at the boundary', () => {
    expect(parseRoundDetailsPatch({ name: 'x'.repeat(MAX_NAME_LENGTH) }).ok).toBe(true);
    expect(parseRoundDetailsPatch({ name: 'x'.repeat(MAX_NAME_LENGTH + 1) }).ok).toBe(false);
    expect(parseRoundDetailsPatch({ notes: 'x'.repeat(MAX_NOTES_LENGTH) }).ok).toBe(true);
    expect(parseRoundDetailsPatch({ notes: 'x'.repeat(MAX_NOTES_LENGTH + 1) }).ok).toBe(false);
  });

  it('accepts ratings 1-5 and null', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(parseRoundDetailsPatch({ mentalTempo: n })).toEqual({ ok: true, patch: { mentalTempo: n } });
    }
    expect(parseRoundDetailsPatch({ mentalBalance: null })).toEqual({
      ok: true,
      patch: { mentalBalance: null },
    });
  });

  it('rejects out-of-range, fractional and non-numeric ratings', () => {
    for (const bad of [0, 6, -1, 2.5, '3', NaN, true]) {
      expect(parseRoundDetailsPatch({ mentalTension: bad }).ok).toBe(false);
    }
  });

  it('rejects wrong types and non-object bodies', () => {
    expect(parseRoundDetailsPatch({ name: 42 }).ok).toBe(false);
    expect(parseRoundDetailsPatch({ notes: ['a'] }).ok).toBe(false);
    expect(parseRoundDetailsPatch(null).ok).toBe(false);
    expect(parseRoundDetailsPatch([]).ok).toBe(false);
    expect(parseRoundDetailsPatch('hi').ok).toBe(false);
  });
});

describe('playedOn', () => {
  it('accepts a real ISO date, including a leap day', () => {
    expect(parseRoundDetailsPatch({ playedOn: '2026-09-20' })).toEqual({ ok: true, patch: { playedOn: '2026-09-20' } });
    expect(parseRoundDetailsPatch({ playedOn: '2028-02-29' }).ok).toBe(true);
  });

  it('rejects impossible, malformed, null and non-string dates', () => {
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '20-09-2026', '2026-9-2', '', null, 20260920]) {
      expect(parseRoundDetailsPatch({ playedOn: bad }).ok).toBe(false);
    }
  });
});

describe('playingHandicap', () => {
  it('accepts whole numbers in range (incl. plus handicaps) and null', () => {
    for (const ok of [0, 9, 54, -3, -10]) {
      expect(parseRoundDetailsPatch({ playingHandicap: ok })).toEqual({ ok: true, patch: { playingHandicap: ok } });
    }
    expect(parseRoundDetailsPatch({ playingHandicap: null })).toEqual({ ok: true, patch: { playingHandicap: null } });
  });
  it('rejects fractions, out-of-range and non-numbers', () => {
    for (const bad of [6.1, 55, -11, '9', NaN, true]) {
      expect(parseRoundDetailsPatch({ playingHandicap: bad }).ok).toBe(false);
    }
  });
});

describe('trackMentality', () => {
  it('accepts booleans only', () => {
    expect(parseRoundDetailsPatch({ trackMentality: false })).toEqual({ ok: true, patch: { trackMentality: false } });
    expect(parseRoundDetailsPatch({ trackMentality: true })).toEqual({ ok: true, patch: { trackMentality: true } });
    for (const bad of ['true', 1, 0, null, 'no']) {
      expect(parseRoundDetailsPatch({ trackMentality: bad }).ok).toBe(false);
    }
  });
  it('is left out of the patch when not sent', () => {
    expect(parseRoundDetailsPatch({ name: 'x' })).toEqual({ ok: true, patch: { name: 'x' } });
  });
});

describe('roundTitle', () => {
  it('prefers the name, falls back otherwise', () => {
    expect(roundTitle({ name: 'St Georges Cup Rd 1' }, 'Elm Park — Blue')).toBe('St Georges Cup Rd 1');
    expect(roundTitle({ name: null }, 'Elm Park — Blue')).toBe('Elm Park — Blue');
  });
});
