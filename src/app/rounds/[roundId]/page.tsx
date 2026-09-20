import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { rounds, courses, tees, teeHoles, shots } from '@/db/schema';
import { RoundEntry } from './round-entry';
import { RoundDetailsForm } from './round-details';

export const dynamic = 'force-dynamic';

function computeResumeHole(shotsByHole: Record<number, { holed: boolean }[]>): number {
  for (let h = 1; h <= 18; h++) {
    const holeShots = shotsByHole[h] ?? [];
    const isDone = holeShots.some((s) => s.holed);
    if (!isDone) return h;
  }
  return 18;
}

export default async function RoundPage({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId: roundIdParam } = await params;
  const roundId = Number(roundIdParam);
  if (!Number.isInteger(roundId)) notFound();

  const round = db.select().from(rounds).where(eq(rounds.id, roundId)).get();
  if (!round) notFound();

  const course = db.select().from(courses).where(eq(courses.id, round.courseId)).get();
  const tee = db.select().from(tees).where(eq(tees.id, round.teeId)).get();
  const holes = db
    .select()
    .from(teeHoles)
    .where(eq(teeHoles.teeId, round.teeId))
    .all()
    .sort((a, b) => a.holeNo - b.holeNo);
  const allShots = db.select().from(shots).where(eq(shots.roundId, roundId)).all();

  const shotsByHole: Record<number, typeof allShots> = {};
  for (const shot of allShots) {
    (shotsByHole[shot.holeNo] ??= []).push(shot);
  }
  for (const holeNo of Object.keys(shotsByHole)) {
    shotsByHole[Number(holeNo)]!.sort((a, b) => a.shotNo - b.shotNo);
  }

  const resumeHole = computeResumeHole(shotsByHole);

  return (
    <main className="max-w-lg mx-auto p-3 sm:p-6">
      <RoundEntry
        roundId={roundId}
        roundName={round.name}
        courseName={course?.name ?? 'Unknown course'}
        teeName={tee?.name ?? ''}
        playedOn={round.playedOn}
        holes={holes.map((h) => ({ holeNo: h.holeNo, par: h.par, strokeIndex: h.strokeIndex, yards: h.yards }))}
        initialShotsByHole={shotsByHole}
        initialHoleNo={resumeHole}
      />
      <div className="mt-6">
        <RoundDetailsForm
          roundId={roundId}
          initial={{
            name: round.name,
            notes: round.notes,
            mentalConfidence: round.mentalConfidence,
            mentalFocus: round.mentalFocus,
            mentalComposure: round.mentalComposure,
          }}
        />
      </div>
    </main>
  );
}
