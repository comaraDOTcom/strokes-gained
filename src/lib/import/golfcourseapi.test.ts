import { describe, it, expect } from 'vitest';
import { mapApiCourse, courseDisplayName, type ApiCourse, type ApiTeeBox } from './golfcourseapi';
import { validateCourseChecksums } from '../../db/checksum';

const PARS = [4, 3, 4, 4, 5, 3, 5, 4, 4, 3, 4, 3, 4, 4, 4, 5, 3, 5]; // 71
const tee = (name: string, yardBase: number, over: Partial<ApiTeeBox> = {}): ApiTeeBox => {
  const holes = PARS.map((par, i) => ({ par, yardage: yardBase + par * 40 + i, handicap: null }));
  return {
    tee_name: name,
    course_rating: 70.7,
    slope_rating: 127,
    total_yards: holes.reduce((n, h) => n + h.yardage, 0),
    par_total: 71,
    number_of_holes: 18,
    holes,
    ...over,
  };
};
const api = (over: Partial<ApiCourse> = {}): ApiCourse => ({
  club_name: 'Stackstown Golf Club',
  course_name: 'Cottage',
  location: { city: 'Rathfarnham', country: 'Ireland' },
  tees: { male: [tee('White', 180), tee('Green', 170)], female: [tee('Red', 140)] },
  ...over,
});

describe('courseDisplayName', () => {
  it('suffixes the course when it differs from the club, not when it repeats it', () => {
    expect(courseDisplayName(api())).toBe('Stackstown Golf Club (Cottage)');
    expect(courseDisplayName({ club_name: 'Corballis Links', course_name: 'corballis links' })).toBe('Corballis Links');
  });
});

describe('mapApiCourse', () => {
  it('maps tees, ratings, location and holes, and passes our checksum validation', () => {
    const r = mapApiCourse(api());
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.course.name).toBe('Stackstown Golf Club (Cottage)');
    expect(r.course.location).toBe('Rathfarnham, Ireland');
    expect(r.course.tees.map((t) => [t.name, t.gender, t.courseRating, t.slopeRating])).toEqual([
      ['White', 'M', 70.7, 127],
      ['Green', 'M', 70.7, 127],
      ['Red', 'F', 70.7, 127],
    ]);
    expect(r.course.holes).toHaveLength(18);
    expect(Object.keys(r.course.holes[0]!.yards)).toEqual(['White', 'Green', 'Red']);
    expect(r.course.holes.every((h) => h.strokeIndex === null)).toBe(true); // API had none
    expect(validateCourseChecksums(r.course)).toEqual([]);
  });

  it('can import just the men\'s tees', () => {
    const r = mapApiCourse(api(), { genders: ['M'] });
    expect(r.ok && r.course.tees.map((t) => t.name)).toEqual(['White', 'Green']);
  });

  it('keeps stroke indexes when the API has them', () => {
    const withSi = tee('White', 180);
    withSi.holes = withSi.holes!.map((h, i) => ({ ...h, handicap: i + 1 }));
    const r = mapApiCourse(api({ tees: { male: [withSi] } }));
    expect(r.ok && r.course.holes.map((h) => h.strokeIndex)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it('a wrong API total is caught by the checksum, not silently imported', () => {
    const r = mapApiCourse(api({ tees: { male: [tee('White', 180, { total_yards: 9999 })] } }));
    if (!r.ok) throw new Error('mapping should succeed; the checksum catches it');
    expect(validateCourseChecksums(r.course).map((e) => e.kind)).toContain('total_yards');
  });

  it('de-duplicates a tee name shared by both genders', () => {
    const r = mapApiCourse(api({ tees: { male: [tee('Red', 170)], female: [tee('Red', 140)] } }));
    expect(r.ok && r.course.tees.map((t) => t.name)).toEqual(['Red', 'Red (Ladies)']);
  });

  it('refuses when tees disagree on a par instead of guessing', () => {
    const ladies = tee('Red', 140);
    ladies.holes = ladies.holes!.map((h, i) => (i === 8 ? { ...h, par: 5 } : h));
    const r = mapApiCourse(api({ tees: { male: [tee('White', 180)], female: [ladies] } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toContain('Hole 9');
  });

  it('refuses 9-hole tees, missing yardages and empty tee lists', () => {
    const nine = tee('White', 180); nine.holes = nine.holes!.slice(0, 9);
    expect(mapApiCourse(api({ tees: { male: [nine] } })).ok).toBe(false);
    const gap = tee('White', 180); gap.holes![3] = { par: 4, yardage: 0, handicap: null };
    expect(mapApiCourse(api({ tees: { male: [gap] } })).ok).toBe(false);
    expect(mapApiCourse(api({ tees: {} })).ok).toBe(false);
    expect(mapApiCourse(api(), { genders: [] }).ok).toBe(false);
  });
});
