import { describe, it, expect } from 'vitest';
import { resolveSelectedCourseId, type CourseOption } from './course-filter';

const portmarnock: CourseOption = {
  courseId: 1,
  name: 'Portmarnock',
  roundCount: 2,
  lastRound: { playedOn: '2026-08-01', roundId: 4 },
};
const elmPark: CourseOption = {
  courseId: 2,
  name: 'Elm Park',
  roundCount: 3,
  lastRound: { playedOn: '2026-09-10', roundId: 7 },
};
const empty: CourseOption = { courseId: 3, name: 'Empty GC', roundCount: 0, lastRound: null };

describe('resolveSelectedCourseId', () => {
  it('defaults to the course of the most recent round', () => {
    expect(resolveSelectedCourseId([portmarnock, elmPark], undefined)).toBe(2);
    expect(resolveSelectedCourseId([elmPark, portmarnock], undefined)).toBe(2);
  });

  it('breaks a same-day tie by the later round id', () => {
    const a = { ...portmarnock, lastRound: { playedOn: '2026-09-10', roundId: 9 } };
    expect(resolveSelectedCourseId([a, elmPark], undefined)).toBe(1);
  });

  it('honours an explicit course, including one with zero rounds', () => {
    expect(resolveSelectedCourseId([portmarnock, elmPark, empty], '1')).toBe(1);
    expect(resolveSelectedCourseId([portmarnock, elmPark, empty], '3')).toBe(3);
  });

  it('falls back to the default for an unknown or malformed param', () => {
    expect(resolveSelectedCourseId([portmarnock, elmPark], '99')).toBe(2);
    expect(resolveSelectedCourseId([portmarnock, elmPark], 'abc')).toBe(2);
    expect(resolveSelectedCourseId([portmarnock, elmPark], '1.5')).toBe(2);
    expect(resolveSelectedCourseId([portmarnock, elmPark], '')).toBe(2);
  });

  it('with no rounds anywhere, picks the first course; with no courses, null', () => {
    expect(resolveSelectedCourseId([empty, { ...empty, courseId: 4 }], undefined)).toBe(3);
    expect(resolveSelectedCourseId([], undefined)).toBeNull();
    expect(resolveSelectedCourseId([], '1')).toBeNull();
  });
});
