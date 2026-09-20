import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { courses, tees, teeHoles } from '@/db/schema';
import { CourseHoleEditor } from './editor';

// Live DB state, edited in place by this very page's Save button.
export const dynamic = 'force-dynamic';

export default async function TeeEditorPage({ params }: { params: Promise<{ teeId: string }> }) {
  const { teeId: teeIdParam } = await params;
  const teeId = Number(teeIdParam);
  if (!Number.isInteger(teeId)) notFound();

  const tee = db.select().from(tees).where(eq(tees.id, teeId)).get();
  if (!tee) notFound();
  const course = db.select().from(courses).where(eq(courses.id, tee.courseId)).get();
  const holes = db
    .select()
    .from(teeHoles)
    .where(eq(teeHoles.teeId, teeId))
    .all()
    .sort((a, b) => a.holeNo - b.holeNo);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        {course?.name ?? 'Unknown course'} — {tee.name}
      </h1>
      <CourseHoleEditor
        teeId={tee.id}
        expectedTotalYards={tee.expectedTotalYards}
        expectedPar={tee.expectedPar}
        initialHoles={holes.map((h) => ({
          holeNo: h.holeNo,
          par: h.par,
          strokeIndex: h.strokeIndex,
          yards: h.yards,
        }))}
      />
    </main>
  );
}
