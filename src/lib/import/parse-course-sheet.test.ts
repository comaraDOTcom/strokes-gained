import { describe, expect, it } from 'vitest';
import { detectLayout, parseCourseSheet, type RawSheet } from './parse-course-sheet';
import { validateParsedStructure, toSeedCourse } from './validate-parsed-sheet';
import { validateCourseChecksums } from '../../db/checksum';
import { ELM_PARK } from '../../db/seed-courses';

describe('detectLayout', () => {
  it('detects Conor\'s wide format (hole | white tees | greens tees | par)', () => {
    expect(detectLayout(['Hole', 'White Tees', 'Greens Tees', 'Par'])).toBe('wide');
  });

  it('detects a long format (hole | tee | yards | par | stroke index)', () => {
    expect(detectLayout(['Hole', 'Tee', 'Yards', 'Par', 'Stroke Index'])).toBe('long');
  });
});

describe('parseCourseSheet — wide layout, round-tripped against real Elm Park data', () => {
  const sheet: RawSheet = {
    headers: ['Hole', 'Blue Tees', 'White Tees', 'Par', 'Stroke Index'],
    rows: ELM_PARK.holes.map((h) => [h.holeNo, h.yards.Blue, h.yards.White, h.par, h.strokeIndex]),
  };

  const result = parseCourseSheet(sheet);

  it('detects wide layout with no row errors', () => {
    expect(result.layout).toBe('wide');
    expect(result.errors).toEqual([]);
  });

  it('detects both tee columns, named after stripping the "Tees" suffix', () => {
    expect(result.teeNames.sort()).toEqual(['Blue', 'White']);
  });

  it('reconstructs all 18 holes with matching par/strokeIndex/yards', () => {
    expect(result.holes).toHaveLength(18);
    for (const hole of ELM_PARK.holes) {
      const parsed = result.holes.find((h) => h.holeNo === hole.holeNo);
      expect(parsed).toBeDefined();
      expect(parsed!.par).toBe(hole.par);
      expect(parsed!.strokeIndex).toBe(hole.strokeIndex);
      expect(parsed!.yards.Blue).toBe(hole.yards.Blue);
      expect(parsed!.yards.White).toBe(hole.yards.White);
    }
  });

  it('passes structural validation and the real checksum totals', () => {
    expect(validateParsedStructure(result.holes)).toEqual([]);
    const seedCourse = toSeedCourse('Elm Park Golf & Sports Club', 'Donnybrook, Dublin', result.holes, ELM_PARK.tees);
    expect(validateCourseChecksums(seedCourse)).toEqual([]);
  });
});

describe('parseCourseSheet — long layout, round-tripped against real Elm Park data', () => {
  const headers = ['Hole', 'Tee', 'Yards', 'Par', 'Stroke Index'];
  const rows: unknown[][] = [];
  for (const h of ELM_PARK.holes) {
    rows.push([h.holeNo, 'Blue', h.yards.Blue, h.par, h.strokeIndex]);
    rows.push([h.holeNo, 'White', h.yards.White, h.par, h.strokeIndex]);
  }
  const sheet: RawSheet = { headers, rows };
  const result = parseCourseSheet(sheet);

  it('detects long layout with no row errors', () => {
    expect(result.layout).toBe('long');
    expect(result.errors).toEqual([]);
  });

  it('reconstructs the same 18 holes as the wide layout does', () => {
    expect(result.holes).toHaveLength(18);
    for (const hole of ELM_PARK.holes) {
      const parsed = result.holes.find((h) => h.holeNo === hole.holeNo);
      expect(parsed!.yards.Blue).toBe(hole.yards.Blue);
      expect(parsed!.yards.White).toBe(hole.yards.White);
    }
  });
});

describe('parseCourseSheet — row-by-row error reporting', () => {
  it('flags a missing yardage cell on a specific row, without discarding the rest', () => {
    const sheet: RawSheet = {
      headers: ['Hole', 'White Tees', 'Par'],
      rows: [
        [1, 112, 3],
        [2, '', 4], // missing yardage
        [3, 386, 4],
      ],
    };
    const result = parseCourseSheet(sheet);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(3); // header is row 1, so hole 2's row is sheet row 3
    expect(result.errors[0]!.message).toMatch(/hole 2/i);
    // Holes 1 and 3 still parsed fine.
    expect(result.holes.map((h) => h.holeNo)).toEqual([1, 3]);
  });

  it('flags conflicting par across tees for the same hole in long layout', () => {
    const sheet: RawSheet = {
      headers: ['Hole', 'Tee', 'Yards', 'Par'],
      rows: [
        [1, 'White', 112, 3],
        [1, 'Blue', 127, 4], // par disagrees with the White row for hole 1
      ],
    };
    const result = parseCourseSheet(sheet);
    expect(result.errors.some((e) => /conflicts with par/i.test(e.message))).toBe(true);
  });

  it('reports a missing "Par" column', () => {
    const sheet: RawSheet = { headers: ['Hole', 'White Tees'], rows: [[1, 112]] };
    const result = parseCourseSheet(sheet);
    expect(result.errors.some((e) => /par/i.test(e.message))).toBe(true);
  });
});

describe('validateParsedStructure', () => {
  it('rejects a non-18-hole sheet', () => {
    const sheet: RawSheet = {
      headers: ['Hole', 'White Tees', 'Par'],
      rows: Array.from({ length: 17 }, (_, i) => [i + 1, 300, 4]),
    };
    const result = parseCourseSheet(sheet);
    const errors = validateParsedStructure(result.holes);
    expect(errors.some((e) => /18 holes/.test(e.message))).toBe(true);
  });

  it('rejects duplicate stroke index values', () => {
    const sheet: RawSheet = {
      headers: ['Hole', 'White Tees', 'Par', 'Stroke Index'],
      rows: Array.from({ length: 18 }, (_, i) => [i + 1, 300, 4, 1]), // every hole SI=1
    };
    const result = parseCourseSheet(sheet);
    const errors = validateParsedStructure(result.holes);
    expect(errors.some((e) => /duplicate stroke index/i.test(e.message))).toBe(true);
  });

  it('allows a sheet with no stroke index column at all', () => {
    const sheet: RawSheet = {
      headers: ['Hole', 'White Tees', 'Par'],
      rows: Array.from({ length: 18 }, (_, i) => [i + 1, 300, 4]),
    };
    const result = parseCourseSheet(sheet);
    expect(validateParsedStructure(result.holes)).toEqual([]);
  });
});
