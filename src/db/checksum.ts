/**
 * Checksum validation shared by `db:seed` and the course importer. A tee's
 * summed hole yardage/par must match the value transcribed off the actual
 * card (`expectedTotalYards`/`expectedPar`) — this is what caught the
 * Portmarnock hole-16 error documented in `seed-courses.ts`. It "fails
 * loudly": callers get every mismatch, not just the first, so a bad sheet
 * produces a full row-by-row report instead of one cryptic error.
 */
import type { SeedCourse } from './seed-courses';

export type ChecksumError = {
  courseName: string;
  teeName: string;
  kind: 'total_yards' | 'total_par' | 'hole_count' | 'stroke_index';
  message: string;
};

export function validateCourseChecksums(course: SeedCourse): ChecksumError[] {
  const errors: ChecksumError[] = [];

  if (course.holes.length !== 18) {
    errors.push({
      courseName: course.name,
      teeName: '(all)',
      kind: 'hole_count',
      message: `Expected 18 holes, found ${course.holes.length}`,
    });
  }

  const holeNos = course.holes.map((h) => h.holeNo).sort((a, b) => a - b);
  const expectedHoleNos = Array.from({ length: course.holes.length }, (_, i) => i + 1);
  if (JSON.stringify(holeNos) !== JSON.stringify(expectedHoleNos)) {
    errors.push({
      courseName: course.name,
      teeName: '(all)',
      kind: 'hole_count',
      message: `Hole numbers are not a contiguous 1..${course.holes.length} sequence: [${holeNos.join(', ')}]`,
    });
  }

  // Stroke index may be: fully absent (not every card publishes one),
  // fully present (must then be a complete 1..N permutation — this is what
  // ELM_PARK's header comment claims and this checks), or PARTIALLY present
  // (e.g. Portmarnock: front-nine SI wasn't on the source data so those
  // holes are null, but the back nine's real values are still a valid,
  // duplicate-free subset). Partial presence is legitimate and documented
  // in seed-courses.ts, so it is not itself an error — only duplicates or
  // out-of-range values among the values that ARE present are.
  const strokeIndexes = course.holes.map((h) => h.strokeIndex);
  const present = strokeIndexes.filter((si): si is number => si !== null);
  const outOfRange = present.filter((si) => si < 1 || si > course.holes.length);
  if (outOfRange.length > 0) {
    errors.push({
      courseName: course.name,
      teeName: '(all)',
      kind: 'stroke_index',
      message: `Stroke index value(s) out of range 1..${course.holes.length}: [${outOfRange.join(', ')}]`,
    });
  }
  const duplicates = present.filter((si, i) => present.indexOf(si) !== i);
  if (duplicates.length > 0) {
    errors.push({
      courseName: course.name,
      teeName: '(all)',
      kind: 'stroke_index',
      message: `Duplicate stroke index value(s): [${[...new Set(duplicates)].join(', ')}]`,
    });
  }

  for (const tee of course.tees) {
    const totalYards = course.holes.reduce((sum, hole) => {
      const y = hole.yards[tee.name];
      return sum + (typeof y === 'number' ? y : 0);
    }, 0);
    const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);

    if (Math.abs(totalYards - tee.expectedTotalYards) > 1e-6) {
      errors.push({
        courseName: course.name,
        teeName: tee.name,
        kind: 'total_yards',
        message: `Summed yardage ${totalYards} != expectedTotalYards ${tee.expectedTotalYards}`,
      });
    }
    if (totalPar !== tee.expectedPar) {
      errors.push({
        courseName: course.name,
        teeName: tee.name,
        kind: 'total_par',
        message: `Summed par ${totalPar} != expectedPar ${tee.expectedPar}`,
      });
    }
  }

  return errors;
}
