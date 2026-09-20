import { db } from '@/db/client';
import { courses, tees } from '@/db/schema';
import { NewRoundForm } from './new-round-form';

export const dynamic = 'force-dynamic';

export default async function NewRoundPage() {
  const allCourses = db.select().from(courses).all();
  const allTees = db.select().from(tees).all();

  return (
    <main className="max-w-sm mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">New round</h1>
      {allCourses.length === 0 ? (
        <p className="text-gray-600">
          No courses yet — <a className="underline" href="/import">import one</a> or run{' '}
          <code>pnpm db:seed</code> first.
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
