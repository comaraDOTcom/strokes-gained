/**
 * `pnpm db:seed` — loads `seed-courses.ts` into the DB.
 *
 * Fails loudly: every course's checksums (yardage/par sums, hole-count,
 * stroke-index permutation) are validated for ALL courses before a single
 * row is written. Any failure prints a full report and exits 1 without
 * touching the DB. Idempotent: a course already present (by name) is
 * skipped, so re-running after adding a new course in seed-courses.ts
 * doesn't duplicate or clobber existing data (including any rounds already
 * logged against it).
 */
import { eq } from 'drizzle-orm';
import { db } from './client';
import { courses } from './schema';
import { SEED_COURSES } from './seed-courses';
import { validateCourseChecksums } from './checksum';
import { insertCourse } from './insert-course';

function main() {
  const allErrors = SEED_COURSES.flatMap((course) => validateCourseChecksums(course));
  if (allErrors.length > 0) {
    console.error(`[db:seed] FAILED — ${allErrors.length} checksum error(s). No rows were written.\n`);
    for (const err of allErrors) {
      console.error(`  [${err.courseName} / ${err.teeName}] ${err.kind}: ${err.message}`);
    }
    process.exitCode = 1;
    return;
  }

  let inserted = 0;
  let skipped = 0;
  for (const course of SEED_COURSES) {
    const existing = db.select().from(courses).where(eq(courses.name, course.name)).get();
    if (existing) {
      console.log(`[db:seed] Skipping "${course.name}" — already seeded (course id ${existing.id}).`);
      skipped++;
      continue;
    }
    insertCourse(course);
    console.log(`[db:seed] Seeded "${course.name}" (${course.tees.length} tee(s), ${course.holes.length} holes).`);
    inserted++;
  }

  console.log(`[db:seed] Done. ${inserted} course(s) inserted, ${skipped} skipped (already present).`);
}

main();

export {};
