import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { courses, tees, teeHoles } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { canEditTee } from '@/lib/auth/guards';
import { CourseHoleEditor } from './editor';

// Live DB state, edited in place by this very page's Save button.
export const dynamic = 'force-dynamic';

export default async function TeeEditorPage({ params }: { params: Promise<{ teeId: string }> }) {
  const user = await requirePageUser();
  const { teeId: teeIdParam } = await params;
  const teeId = Number(teeIdParam);
  if (!Number.isInteger(teeId)) notFound();

  const [tee] = await db.select().from(tees).where(eq(tees.id, teeId));
  if (!tee) notFound();
  const [[course], holes, editable] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, tee.courseId)),
    db.select().from(teeHoles).where(eq(teeHoles.teeId, teeId)),
    canEditTee(teeId, user),
  ]);
  holes.sort((a, b) => a.holeNo - b.holeNo);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        {course?.name ?? 'Unknown course'} — {tee.name}
      </h1>
      <CourseHoleEditor
        teeId={tee.id}
        expectedTotalYards={tee.expectedTotalYards}
        expectedPar={tee.expectedPar}
        readOnlyReason={
          editable
            ? null
            : 'View only. Courses can be edited by the person who added them (until other players have rounds on the tee) or by the admin.'
        }
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
