/**
 * Shared "write a fully-validated course into the DB" transaction, used by
 * both `db:seed` and the `/import` commit endpoint. Callers MUST have
 * already run `validateCourseChecksums` and confirmed zero errors — this
 * function does not re-validate, it just writes.
 */
import { db } from './client';
import { courses, tees, teeHoles } from './schema';
import type { SeedCourse } from './seed-courses';

export function insertCourse(course: SeedCourse): number {
  return db.transaction((tx) => {
    const insertedCourse = tx
      .insert(courses)
      .values({ name: course.name, location: course.location })
      .returning()
      .get();
    if (!insertedCourse) throw new Error(`Failed to insert course ${course.name}`);

    for (const tee of course.tees) {
      const totalYards = course.holes.reduce((sum, hole) => sum + (hole.yards[tee.name] ?? 0), 0);
      const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);

      const insertedTee = tx
        .insert(tees)
        .values({
          courseId: insertedCourse.id,
          name: tee.name,
          gender: tee.gender,
          distanceUnit: tee.distanceUnit,
          courseRating: tee.courseRating,
          slopeRating: tee.slopeRating,
          expectedTotalYards: tee.expectedTotalYards ?? totalYards,
          expectedPar: tee.expectedPar ?? totalPar,
        })
        .returning()
        .get();
      if (!insertedTee) throw new Error(`Failed to insert tee ${tee.name} for ${course.name}`);

      for (const hole of course.holes) {
        const yards = hole.yards[tee.name];
        if (typeof yards !== 'number') {
          throw new Error(`${course.name} hole ${hole.holeNo} has no yardage for tee ${tee.name}`);
        }
        tx.insert(teeHoles)
          .values({
            teeId: insertedTee.id,
            holeNo: hole.holeNo,
            par: hole.par,
            strokeIndex: hole.strokeIndex,
            yards,
          })
          .run();
      }
    }

    return insertedCourse.id;
  });
}
