import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { courses, tees } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { getRoundForViewer, HttpError } from '@/lib/auth/guards';
import { getAllEnrichedShots } from '@/lib/insights/queries';
import { buildRoundRecap } from '@/lib/insights/recap';
import { RecapDeck } from './recap-deck';

export const dynamic = 'force-dynamic';

export default async function RoundRecapPage({ params }: { params: Promise<{ roundId: string }> }) {
  const viewer = await requirePageUser();
  const roundId = Number((await params).roundId);
  if (!Number.isInteger(roundId)) notFound();

  let round;
  try {
    ({ round } = await getRoundForViewer(roundId, viewer)); // owner, or the admin (read-only)
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  if (!round.userId) notFound();

  const [[course], [tee], allShots] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, round.courseId)),
    db.select().from(tees).where(eq(tees.id, round.teeId)),
    getAllEnrichedShots(round.userId, round.courseId),
  ]);
  const recap = buildRoundRecap(allShots.filter((s) => s.roundId === roundId));
  const where = `${course?.name ?? 'Unknown course'} — ${tee?.name ?? ''}`;

  if (recap.holesPlayed === 0) {
    return (
      <main className="max-w-md mx-auto p-6 space-y-3">
        <h1 className="text-xl font-semibold">Round recap</h1>
        <p className="text-ink-2">Finish at least one hole and your recap will be here.</p>
        <Link className="underline" href={`/rounds/${roundId}`}>
          Back to the round
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-3 sm:p-6">
      <RecapDeck roundId={roundId} title={round.name ?? where} subtitle={`${round.name ? `${where} · ` : ''}${round.playedOn}`} recap={recap} />
    </main>
  );
}
