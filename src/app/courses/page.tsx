import Link from 'next/link';
import { db } from '@/db/client';
import { courses, tees } from '@/db/schema';

// This reads live DB state (courses/tees change via /import and the
// editor) — it must never be statically prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const allCourses = db.select().from(courses).all();
  const allTees = db.select().from(tees).all();

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <p>
        <Link className="underline" href="/import">
          Import a new course
        </Link>
      </p>

      {allCourses.length === 0 && <p className="text-gray-600">No courses yet. Run `pnpm db:seed` or import one.</p>}

      {allCourses.map((course) => (
        <section key={course.id} className="space-y-1">
          <h2 className="text-lg font-semibold">{course.name}</h2>
          <p className="text-sm text-gray-600">{course.location}</p>
          <ul className="list-disc pl-5">
            {allTees
              .filter((t) => t.courseId === course.id)
              .map((tee) => (
                <li key={tee.id}>
                  <Link className="underline" href={`/courses/${tee.id}`}>
                    {tee.name}
                  </Link>
                  {tee.courseRating !== null ? ` — CR ${tee.courseRating} / SR ${tee.slopeRating}` : ' — no course rating on file'}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
