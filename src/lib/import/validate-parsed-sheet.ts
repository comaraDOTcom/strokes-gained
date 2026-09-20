/**
 * Structural validation for a parsed course sheet, independent of any
 * external "expected total" cross-check (that happens separately, once the
 * user confirms tee metadata, by reusing `validateCourseChecksums` from
 * `src/db/checksum.ts` against a `SeedCourse`-shaped object built with
 * `toSeedCourse`). This file only checks internal consistency of what was
 * parsed: exactly 18 holes, contiguous 1..18, and any stroke-index values
 * present are duplicate-free and in range (mirrors the same relaxed
 * "partial stroke index is OK" rule as the seed checksum — see
 * `src/db/checksum.ts` for why: Portmarnock's front nine legitimately has
 * none).
 */
import type { ParsedHole } from './parse-course-sheet';
import type { RowError } from './parse-course-sheet';
import type { SeedCourse } from '../../db/seed-courses';

export function validateParsedStructure(holes: ParsedHole[]): RowError[] {
  const errors: RowError[] = [];

  if (holes.length !== 18) {
    errors.push({ row: 1, message: `Expected 18 holes, found ${holes.length}` });
  }

  const holeNos = holes.map((h) => h.holeNo).sort((a, b) => a - b);
  const expected = Array.from({ length: holes.length }, (_, i) => i + 1);
  if (JSON.stringify(holeNos) !== JSON.stringify(expected)) {
    errors.push({
      row: 1,
      message: `Hole numbers are not a contiguous 1..${holes.length} sequence: [${holeNos.join(', ')}]`,
    });
  }

  const present = holes.map((h) => h.strokeIndex).filter((si): si is number => si !== null);
  const outOfRange = present.filter((si) => si < 1 || si > holes.length);
  if (outOfRange.length > 0) {
    errors.push({ row: 1, message: `Stroke index value(s) out of range 1..${holes.length}: [${outOfRange.join(', ')}]` });
  }
  const duplicates = present.filter((si, i) => present.indexOf(si) !== i);
  if (duplicates.length > 0) {
    errors.push({ row: 1, message: `Duplicate stroke index value(s): [${[...new Set(duplicates)].join(', ')}]` });
  }

  for (const hole of holes) {
    if (![3, 4, 5].includes(hole.par)) {
      errors.push({ row: 1, message: `Hole ${hole.holeNo}: unusual par ${hole.par} (expected 3, 4, or 5)` });
    }
  }

  return errors;
}

export type TeeMeta = {
  name: string;
  gender: 'M' | 'F';
  distanceUnit: 'yards' | 'metres';
  courseRating: number | null;
  slopeRating: number | null;
  /** User-confirmed totals off the physical card, used as the checksum target. */
  expectedTotalYards: number;
  expectedPar: number;
};

/** Builds a `SeedCourse`-shaped object so `validateCourseChecksums` can be reused unchanged. */
export function toSeedCourse(
  name: string,
  location: string,
  holes: ParsedHole[],
  teeMeta: TeeMeta[],
): SeedCourse {
  return {
    name,
    location,
    tees: teeMeta,
    holes: holes.map((h) => ({
      holeNo: h.holeNo,
      par: h.par,
      strokeIndex: h.strokeIndex,
      yards: h.yards,
    })),
  };
}
