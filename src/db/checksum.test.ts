import { describe, expect, it } from 'vitest';
import { validateCourseChecksums } from './checksum';
import { SEED_COURSES } from './seed-courses';
import type { SeedCourse } from './seed-courses';

describe('validateCourseChecksums', () => {
  it('passes for both real seed courses (Elm Park and Portmarnock)', () => {
    for (const course of SEED_COURSES) {
      expect(validateCourseChecksums(course)).toEqual([]);
    }
  });

  it('allows Portmarnock-style partial stroke index (front nine null, back nine present and valid)', () => {
    const portmarnock = SEED_COURSES.find((c) => c.name.startsWith('Portmarnock'))!;
    const nullCount = portmarnock.holes.filter((h) => h.strokeIndex === null).length;
    const presentCount = portmarnock.holes.filter((h) => h.strokeIndex !== null).length;
    expect(nullCount).toBeGreaterThan(0);
    expect(presentCount).toBeGreaterThan(0);
    expect(validateCourseChecksums(portmarnock)).toEqual([]);
  });

  it('rejects a wrong total yardage (fails loudly, with a specific message)', () => {
    const broken: SeedCourse = {
      ...SEED_COURSES[0]!,
      tees: SEED_COURSES[0]!.tees.map((t, i) => (i === 0 ? { ...t, expectedTotalYards: t.expectedTotalYards + 1 } : t)),
    };
    const errors = validateCourseChecksums(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.kind === 'total_yards')).toBe(true);
  });

  it('rejects a wrong total par', () => {
    const broken: SeedCourse = {
      ...SEED_COURSES[0]!,
      tees: SEED_COURSES[0]!.tees.map((t, i) => (i === 0 ? { ...t, expectedPar: t.expectedPar + 1 } : t)),
    };
    const errors = validateCourseChecksums(broken);
    expect(errors.some((e) => e.kind === 'total_par')).toBe(true);
  });

  it('rejects duplicate stroke index values', () => {
    const broken: SeedCourse = {
      ...SEED_COURSES[0]!,
      holes: SEED_COURSES[0]!.holes.map((h) => (h.holeNo === 2 ? { ...h, strokeIndex: 14 } : h)), // 14 already used by hole 1
    };
    const errors = validateCourseChecksums(broken);
    expect(errors.some((e) => e.kind === 'stroke_index')).toBe(true);
  });

  it('rejects a non-contiguous hole sequence', () => {
    const broken: SeedCourse = {
      ...SEED_COURSES[0]!,
      holes: SEED_COURSES[0]!.holes.filter((h) => h.holeNo !== 5),
    };
    const errors = validateCourseChecksums(broken);
    expect(errors.some((e) => e.kind === 'hole_count')).toBe(true);
  });
});
