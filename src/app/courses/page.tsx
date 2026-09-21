import Link from 'next/link';
import { db } from '@/db/client';
import { courses, tees } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';

// This reads live DB state (courses/tees change via /import and the
// editor) — it must never be statically prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  await requirePageUser();
  const [allCourses, allTees] = await Promise.all([db.select().from(courses), db.select().from(tees)]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Courses</h1>
      <p className="text-sm text-ink-2">
        A shared library — everyone can play any course here. Only the person who added a course (or the admin) can edit it.
      </p>
      <p>
        <Link className="underline" href="/import">
          Add a course
        </Link>
      </p>

      {allCourses.length === 0 && <p className="text-ink-2">No courses yet. Add one to get started.</p>}

      {allCourses
        .sort((a, b) => a.id - b.id)
        .map((course) => (
          <section key={course.id} className="space-y-1">
            <h2 className="text-lg font-semibold">{course.name}</h2>
            <p className="text-sm text-ink-2">{course.location}</p>
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
