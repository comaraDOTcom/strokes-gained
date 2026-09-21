import { describe, it, expect } from 'vitest';
import { parseCourseRequest, MAX_REQUEST_NAME, MAX_REQUEST_DETAILS } from './requests';

describe('parseCourseRequest', () => {
  it('trims and accepts a name with optional details', () => {
    expect(parseCourseRequest({ courseName: '  The Island  ', details: ' Donabate, blue tees ' })).toEqual({
      ok: true, courseName: 'The Island', details: 'Donabate, blue tees',
    });
    expect(parseCourseRequest({ courseName: 'The Island' })).toEqual({ ok: true, courseName: 'The Island', details: null });
    expect(parseCourseRequest({ courseName: 'The Island', details: '   ' })).toMatchObject({ ok: true, details: null });
  });
  it('rejects a missing, short or over-long name', () => {
    for (const bad of [undefined, null, 7, '', '  ', 'ab', 'x'.repeat(MAX_REQUEST_NAME + 1)]) {
      expect(parseCourseRequest({ courseName: bad }).ok).toBe(false);
    }
    expect(parseCourseRequest({ courseName: 'x'.repeat(MAX_REQUEST_NAME) }).ok).toBe(true);
  });
  it('rejects over-long or non-text details, and non-object bodies', () => {
    expect(parseCourseRequest({ courseName: 'Abc', details: 'x'.repeat(MAX_REQUEST_DETAILS + 1) }).ok).toBe(false);
    expect(parseCourseRequest({ courseName: 'Abc', details: 5 }).ok).toBe(false);
    expect(parseCourseRequest(null).ok).toBe(false);
    expect(parseCourseRequest([]).ok).toBe(false);
  });
});
