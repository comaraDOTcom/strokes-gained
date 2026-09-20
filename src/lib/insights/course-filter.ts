/**
 * Course filter selection (BUILD.md Phase 4 → "Course filter"). "Vs prior 3"
 * and the rolling average only make sense within one course, so `/` and
 * `/insights` both scope to a single course. Pure logic only — the DB read
 * lives in `queries.ts`, the buttons in `src/app/course-filter.tsx`.
 */

export type CourseOption = {
  courseId: number;
  name: string;
  roundCount: number;
  /** Most recent round on this course, for picking the default. Null if none. */
  lastRound: { playedOn: string; roundId: number } | null;
};

/**
 * The course to show. An explicit `?course=` wins if it names a real course;
 * anything else (missing, junk, a deleted id) falls back to the course of the
 * most recent round, then to the first course so a brand-new install with
 * courses seeded but no rounds still lands on a filter, not a blank page.
 */
export function resolveSelectedCourseId(
  options: CourseOption[],
  param: string | undefined,
): number | null {
  if (options.length === 0) return null;

  const requested = param !== undefined && /^\d+$/.test(param) ? Number(param) : null;
  if (requested !== null && options.some((o) => o.courseId === requested)) return requested;

  let best: CourseOption | null = null;
  for (const o of options) {
    if (!o.lastRound) continue;
    if (
      !best ||
      o.lastRound.playedOn > best.lastRound!.playedOn ||
      (o.lastRound.playedOn === best.lastRound!.playedOn && o.lastRound.roundId > best.lastRound!.roundId)
    ) {
      best = o;
    }
  }
  return (best ?? options[0]!).courseId;
}
