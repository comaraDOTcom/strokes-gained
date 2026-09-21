import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { courses, tees, teeHoles, rounds, courseRequests, user as userTable } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { canEditTee } from '@/lib/auth/guards';
import { AdminBadge } from '../admin-badge';
import { CoursePicker } from './course-picker';
import { CourseRequestForm, RequestDoneButton } from './course-request-form';

// Live DB state (courses change via import, the editor and the API importer).
export const dynamic = 'force-dynamic';

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const me = await requirePageUser();
  const { course: courseParam } = await searchParams;

  const [allCourses, allTees] = await Promise.all([db.select().from(courses), db.select().from(tees)]);
  allCourses.sort((a, b) => a.name.localeCompare(b.name));

  const raw = Array.isArray(courseParam) ? courseParam[0] : courseParam;
  const wanted = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
  const selected = allCourses.find((c) => c.id === wanted) ?? null;

  // Details for the chosen course only.
  const courseTees = selected ? allTees.filter((t) => t.courseId === selected.id).sort((a, b) => a.id - b.id) : [];
  const [holeRows, myRounds, editable] = selected
    ? await Promise.all([
        courseTees.length ? db.select().from(teeHoles).where(inArray(teeHoles.teeId, courseTees.map((t) => t.id))) : [],
        db.select({ id: rounds.id }).from(rounds).where(and(eq(rounds.userId, me.id), eq(rounds.courseId, selected.id))),
        Promise.all(courseTees.map((t) => canEditTee(t.id, me))),
      ])
    : [[], [], []];

  const [myOpenRequests, adminRequests] = await Promise.all([
    db
      .select()
      .from(courseRequests)
      .where(and(eq(courseRequests.userId, me.id), eq(courseRequests.status, 'open')))
      .orderBy(desc(courseRequests.id)),
    me.isAdmin
      ? db
          .select({
            id: courseRequests.id,
            courseName: courseRequests.courseName,
            details: courseRequests.details,
            createdAt: courseRequests.createdAt,
            who: userTable.name,
            email: userTable.email,
          })
          .from(courseRequests)
          .innerJoin(userTable, eq(userTable.id, courseRequests.userId))
          .where(eq(courseRequests.status, 'open'))
          .orderBy(desc(courseRequests.id))
      : [],
  ]);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Courses</h1>
        <p className="text-sm text-ink-2">Pick a course to see its tees and what you can do there.</p>
      </div>

      {me.isAdmin && adminRequests.length > 0 && (
        <section className="border rounded-xl bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            Course requests <span className="font-mono text-xs text-muted">{adminRequests.length} open</span> <AdminBadge />
          </h2>
          <ul className="space-y-2">
            {adminRequests.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.courseName}</p>
                  {r.details && <p className="text-sm text-ink-2 whitespace-pre-line break-words">{r.details}</p>}
                  <p className="font-mono text-xs text-muted">
                    {r.who} · {r.email} · {r.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <RequestDoneButton id={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <CoursePicker
          selectedId={selected?.id ?? null}
          courses={allCourses.map((c) => ({
            id: c.id,
            name: c.name,
            location: c.location,
            teeCount: allTees.filter((t) => t.courseId === c.id).length,
          }))}
        />

        <section className="border rounded-xl bg-card p-4 space-y-4 self-start">
          {!selected ? (
            <p className="text-sm text-muted">
              {allCourses.length === 0 ? 'No courses yet — request one below.' : 'Choose a course from the list.'}
            </p>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                {selected.location && <p className="font-mono text-xs text-muted">{selected.location}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/rounds/new?course=${selected.id}`}
                  className="bg-ink text-paper rounded-lg px-4 py-2 text-sm font-medium"
                >
                  Log a round here
                </Link>
                {myRounds.length > 0 && (
                  <Link
                    href={`/insights?course=${selected.id}`}
                    className="rounded-lg border border-line-strong px-4 py-2 text-sm"
                  >
                    Your {myRounds.length} round{myRounds.length === 1 ? '' : 's'} here
                  </Link>
                )}
              </div>

              <ul className="space-y-2">
                {courseTees.map((t, i) => {
                  const hs = holeRows.filter((h) => h.teeId === t.id);
                  const yards = Math.round(hs.reduce((n, h) => n + h.yards, 0));
                  const par = hs.reduce((n, h) => n + h.par, 0);
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
                      <div>
                        <p className="text-sm font-medium">
                          {t.name} <span className="text-muted font-normal">· {t.gender === 'F' ? 'Ladies' : 'Men'}</span>
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {yards}
                          {t.distanceUnit === 'metres' ? 'm' : 'y'} · par {par} ·{' '}
                          {t.courseRating !== null ? `CR ${t.courseRating} / SR ${t.slopeRating ?? '—'}` : 'no rating on file'}
                        </p>
                      </div>
                      <Link href={`/courses/${t.id}`} className="shrink-0 text-sm underline underline-offset-2">
                        {editable[i] ? 'Edit holes' : 'View holes'}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="border rounded-xl bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Can&apos;t find your course?</h2>
          <p className="text-sm text-ink-2">
            Request it and it&apos;ll be added for you. (Got the scorecard as a spreadsheet?{' '}
            <Link className="underline" href="/import">
              Import it yourself
            </Link>
            .)
          </p>
        </div>
        {myOpenRequests.length > 0 && (
          <p className="text-sm text-muted">
            Waiting to be added: {myOpenRequests.map((r) => r.courseName).join(', ')}.
          </p>
        )}
        <CourseRequestForm />
      </section>
    </main>
  );
}
