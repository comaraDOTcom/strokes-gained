/**
 * Verified course seed data.
 *
 * Elm Park      — transcribed from the club's own 18-hole competition card
 *                 (July 2025). Distances in YARDS. Verified: out/in/total
 *                 yardage checksums and stroke index = complete 1..18 permutation.
 * Portmarnock   — White/Green from Conor's spreadsheet, cross-checked against the
 *                 club's 2024 card PDF. Distances in YARDS.
 *                 CORRECTION APPLIED: hole 16 Green is 512, not the 517 in the
 *                 spreadsheet. Only 512 reconciles with the card's Green-nine
 *                 total of 3308. Flagged to Conor 2026-09-20.
 *                 Front-nine (Red nine) stroke indexes were not on the source
 *                 data, so they are null — SG does not use stroke index, it is
 *                 only needed for Stableford/handicapping.
 */

export type SeedHole = {
  holeNo: number;
  par: number;
  strokeIndex: number | null;
  yards: Record<string, number>; // tee name -> yards
};

export type SeedCourse = {
  name: string;
  location: string;
  tees: Array<{
    name: string;
    gender: 'M' | 'F';
    distanceUnit: 'yards' | 'metres';
    courseRating: number | null;
    slopeRating: number | null;
    /** Expected total yardage, used as an import checksum. */
    expectedTotalYards: number;
    expectedPar: number;
  }>;
  holes: SeedHole[];
};

export const ELM_PARK: SeedCourse = {
  name: 'Elm Park Golf & Sports Club',
  location: 'Donnybrook, Dublin',
  tees: [
    { name: 'Blue',  gender: 'M', distanceUnit: 'yards', courseRating: 68.5, slopeRating: 118, expectedTotalYards: 6006, expectedPar: 69 },
    { name: 'White', gender: 'M', distanceUnit: 'yards', courseRating: 67.7, slopeRating: 116, expectedTotalYards: 5745, expectedPar: 69 },
  ],
  holes: [
    { holeNo: 1,  par: 3, strokeIndex: 14, yards: { Blue: 127, White: 112 } },
    { holeNo: 2,  par: 4, strokeIndex: 2,  yards: { Blue: 413, White: 405 } },
    { holeNo: 3,  par: 4, strokeIndex: 6,  yards: { Blue: 406, White: 386 } },
    { holeNo: 4,  par: 4, strokeIndex: 4,  yards: { Blue: 425, White: 423 } },
    { holeNo: 5,  par: 4, strokeIndex: 8,  yards: { Blue: 358, White: 344 } },
    { holeNo: 6,  par: 3, strokeIndex: 16, yards: { Blue: 142, White: 132 } },
    { holeNo: 7,  par: 5, strokeIndex: 18, yards: { Blue: 466, White: 463 } },
    { holeNo: 8,  par: 3, strokeIndex: 12, yards: { Blue: 187, White: 173 } },
    { holeNo: 9,  par: 5, strokeIndex: 10, yards: { Blue: 524, White: 503 } },
    { holeNo: 10, par: 4, strokeIndex: 1,  yards: { Blue: 450, White: 438 } },
    { holeNo: 11, par: 4, strokeIndex: 15, yards: { Blue: 361, White: 353 } },
    { holeNo: 12, par: 3, strokeIndex: 11, yards: { Blue: 183, White: 152 } },
    { holeNo: 13, par: 4, strokeIndex: 13, yards: { Blue: 341, White: 332 } },
    { holeNo: 14, par: 4, strokeIndex: 9,  yards: { Blue: 365, White: 350 } },
    { holeNo: 15, par: 4, strokeIndex: 17, yards: { Blue: 309, White: 299 } },
    { holeNo: 16, par: 4, strokeIndex: 5,  yards: { Blue: 347, White: 333 } },
    { holeNo: 17, par: 3, strokeIndex: 7,  yards: { Blue: 212, White: 190 } },
    { holeNo: 18, par: 4, strokeIndex: 3,  yards: { Blue: 390, White: 357 } },
  ],
};

export const PORTMARNOCK: SeedCourse = {
  name: 'Portmarnock Golf Club (Championship)',
  location: 'Portmarnock, Co. Dublin',
  tees: [
    { name: 'White', gender: 'M', distanceUnit: 'yards', courseRating: null, slopeRating: null, expectedTotalYards: 6926, expectedPar: 72 },
    { name: 'Green', gender: 'M', distanceUnit: 'yards', courseRating: null, slopeRating: null, expectedTotalYards: 6701, expectedPar: 72 },
  ],
  holes: [
    // Red nine
    { holeNo: 1,  par: 4, strokeIndex: null, yards: { White: 397, Green: 381 } },
    { holeNo: 2,  par: 4, strokeIndex: null, yards: { White: 360, Green: 343 } },
    { holeNo: 3,  par: 4, strokeIndex: null, yards: { White: 377, Green: 372 } },
    { holeNo: 4,  par: 4, strokeIndex: null, yards: { White: 441, Green: 435 } },
    { holeNo: 5,  par: 4, strokeIndex: null, yards: { White: 385, Green: 371 } },
    { holeNo: 6,  par: 5, strokeIndex: null, yards: { White: 583, Green: 564 } },
    { holeNo: 7,  par: 3, strokeIndex: null, yards: { White: 171, Green: 157 } },
    { holeNo: 8,  par: 4, strokeIndex: null, yards: { White: 378, Green: 362 } },
    { holeNo: 9,  par: 4, strokeIndex: null, yards: { White: 417, Green: 408 } },
    // Blue nine
    { holeNo: 10, par: 4, strokeIndex: 12, yards: { White: 364, Green: 355 } },
    { holeNo: 11, par: 4, strokeIndex: 6,  yards: { White: 414, Green: 404 } },
    { holeNo: 12, par: 3, strokeIndex: 16, yards: { White: 148, Green: 129 } },
    { holeNo: 13, par: 5, strokeIndex: 14, yards: { White: 549, Green: 538 } },
    { holeNo: 14, par: 4, strokeIndex: 2,  yards: { White: 387, Green: 375 } },
    { holeNo: 15, par: 3, strokeIndex: 8,  yards: { White: 190, Green: 176 } },
    { holeNo: 16, par: 5, strokeIndex: 18, yards: { White: 527, Green: 512 } }, // 512 not 517 — see header
    { holeNo: 17, par: 4, strokeIndex: 4,  yards: { White: 445, Green: 432 } },
    { holeNo: 18, par: 4, strokeIndex: 10, yards: { White: 393, Green: 387 } },
  ],
};

export const SEED_COURSES: SeedCourse[] = [ELM_PARK, PORTMARNOCK];
