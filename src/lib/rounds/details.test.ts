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
      expect(parseRoundDetailsPatch({ mentalFocus: n })).toEqual({ ok: true, patch: { mentalFocus: n } });
    }
    expect(parseRoundDetailsPatch({ mentalConfidence: null })).toEqual({
      ok: true,
      patch: { mentalConfidence: null },
    });
  });

  it('rejects out-of-range, fractional and non-numeric ratings', () => {
    for (const bad of [0, 6, -1, 2.5, '3', NaN, true]) {
      expect(parseRoundDetailsPatch({ mentalComposure: bad }).ok).toBe(false);
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

describe('roundTitle', () => {
  it('prefers the name, falls back otherwise', () => {
    expect(roundTitle({ name: 'St Georges Cup Rd 1' }, 'Elm Park — Blue')).toBe('St Georges Cup Rd 1');
    expect(roundTitle({ name: null }, 'Elm Park — Blue')).toBe('Elm Park — Blue');
  });
});
