import { db } from '@/db/client';
import { desc, eq } from 'drizzle-orm';
import { courses, tees, rounds } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { NewRoundForm } from './new-round-form';

export const dynamic = 'force-dynamic';

export default async function NewRoundPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course: courseParam } = await searchParams;
  const rawCourse = Array.isArray(courseParam) ? courseParam[0] : courseParam;
  const user = await requirePageUser();
  const [allCourses, allTees, [lastRound]] = await Promise.all([
    db.select().from(courses),
    db.select().from(tees),
    db
      .select({ trackMentality: rounds.trackMentality })
      .from(rounds)
      .where(eq(rounds.userId, user.id))
      .orderBy(desc(rounds.id))
      .limit(1),
  ]);
  allCourses.sort((a, b) => a.id - b.id);

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">New round</h1>
      {allCourses.length === 0 ? (
        <p className="text-ink-2">
          No courses yet — <a className="underline" href="/import">add one</a> first.
        </p>
      ) : (
        <NewRoundForm
          courses={allCourses.map((c) => ({ id: c.id, name: c.name }))}
          tees={allTees.map((t) => ({ id: t.id, courseId: t.courseId, name: t.name }))}
          // First round ever: off — a new player sees the simplest screen.
          defaultTrackMentality={lastRound?.trackMentality ?? false}
          initialCourseId={
            rawCourse && /^\d+$/.test(rawCourse) && allCourses.some((c) => c.id === Number(rawCourse))
              ? Number(rawCourse)
              : null
          }
        />
      )}
    </main>
  );
}
