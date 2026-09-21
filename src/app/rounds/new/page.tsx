import { db } from '@/db/client';
import { courses, tees } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { NewRoundForm } from './new-round-form';

export const dynamic = 'force-dynamic';

export default async function NewRoundPage() {
  await requirePageUser();
  const [allCourses, allTees] = await Promise.all([db.select().from(courses), db.select().from(tees)]);
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
        />
      )}
    </main>
  );
}
