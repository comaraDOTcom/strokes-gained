/**
 * Shared "write a fully-validated course into the DB" transaction, used by
 * both `db:seed` and the `/import` commit endpoint. Callers MUST have
 * already run `validateCourseChecksums` and confirmed zero errors — this
 * function does not re-validate, it just writes.
 */
import { db, type DbOrTx } from './client';
import { courses, tees, teeHoles } from './schema';
import type { SeedCourse } from './seed-courses';

/**
 * Returns the new course id. `createdByUserId` records who may edit it (null =
 * seeded / admin-owned). Pass `conn` to join an existing transaction.
 */
export async function insertCourse(
  course: SeedCourse,
  createdByUserId: string | null = null,
  conn?: DbOrTx,
): Promise<number> {
  const run = async (tx: DbOrTx): Promise<number> => {
    const [insertedCourse] = await tx
      .insert(courses)
      .values({ name: course.name, location: course.location, createdByUserId })
      .returning();
    if (!insertedCourse) throw new Error(`Failed to insert course ${course.name}`);

    for (const tee of course.tees) {
      const totalYards = course.holes.reduce((sum, hole) => sum + (hole.yards[tee.name] ?? 0), 0);
      const totalPar = course.holes.reduce((sum, hole) => sum + hole.par, 0);

      const [insertedTee] = await tx
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
        .returning();
      if (!insertedTee) throw new Error(`Failed to insert tee ${tee.name} for ${course.name}`);

      const holeRows = course.holes.map((hole) => {
        const yards = hole.yards[tee.name];
        if (typeof yards !== 'number') {
          throw new Error(`${course.name} hole ${hole.holeNo} has no yardage for tee ${tee.name}`);
        }
        return { teeId: insertedTee.id, holeNo: hole.holeNo, par: hole.par, strokeIndex: hole.strokeIndex, yards };
      });
      await tx.insert(teeHoles).values(holeRows);
    }

    return insertedCourse.id;
  };
  return conn ? run(conn) : db.transaction((tx) => run(tx));
}
