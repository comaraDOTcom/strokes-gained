import Link from 'next/link';
import { asc, count, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { courses, tees, teeHoles, shots, rounds as roundsTable, user as userTable } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { getRoundForViewer, HttpError } from '@/lib/auth/guards';
import { fmtSg } from '@/lib/insights/chart-colors';
import { ReelIcon } from '../../recap-icon';
import { RoundEntry } from './round-entry';
import { RoundDetailsForm } from './round-details';
import { DeleteRoundButton } from './delete-round';

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
  const viewer = await requirePageUser();
  const { roundId: roundIdParam } = await params;
  const roundId = Number(roundIdParam);
  if (!Number.isInteger(roundId)) notFound();

  let round, isOwner;
  try {
    ({ round, isOwner } = await getRoundForViewer(roundId, viewer));
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }

  const [[course], [tee], holes, allShots, [mine]] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, round.courseId)),
    db.select().from(tees).where(eq(tees.id, round.teeId)),
    db.select().from(teeHoles).where(eq(teeHoles.teeId, round.teeId)),
    db.select().from(shots).where(eq(shots.roundId, roundId)).orderBy(asc(shots.holeNo), asc(shots.shotNo)),
    // Is this the viewer's first round? (Drives the first-shot tip; the admin's read-only view never sees it.)
    db.select({ n: count() }).from(roundsTable).where(eq(roundsTable.userId, viewer.id)),
  ]);
  const firstRound = isOwner && (mine?.n ?? 0) <= 1;
  holes.sort((a, b) => a.holeNo - b.holeNo);

  const shotsByHole: Record<number, typeof allShots> = {};
  for (const shot of allShots) (shotsByHole[shot.holeNo] ??= []).push(shot);

  const holesDone = Object.values(shotsByHole).filter((hs) => hs.some((s) => s.holed)).length;

  if (!isOwner) {
    // Read-only view for other players: scores, shots and SG — never the owner's notes or ratings.
    const [owner] = round.userId
      ? await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, round.userId))
      : [];
    return (
      <ReadOnlyRound
        title={round.name ?? `${course?.name ?? 'Unknown course'} — ${tee?.name ?? ''}`}
        subtitle={`${owner?.name ?? 'Unknown player'} · ${course?.name ?? ''} — ${tee?.name ?? ''} · ${round.playedOn}`}
        ownerId={round.userId}
        roundId={roundId}
        holes={holes}
        shotsByHole={shotsByHole}
      />
    );
  }

  return (
    <main className="max-w-lg mx-auto p-3 sm:p-6">
      {holesDone > 0 && (
        <Link
          href={`/rounds/${roundId}/recap`}
          className={`mb-3 flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            holesDone === 18 ? 'bg-ink text-paper border-ink' : 'bg-card'
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <ReelIcon />
            {holesDone === 18 ? 'Round complete — watch your recap' : 'Round recap so far'}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}
      {holesDone > 0 && (
        <p className="mb-3 text-sm">
          <Link className="underline underline-offset-2" href={`/rounds/${roundId}/scorecard`}>
            View scorecard
          </Link>
        </p>
      )}
      <RoundEntry
        roundId={roundId}
        roundName={round.name}
        detailedEntry={round.detailedEntry}
        courseName={course?.name ?? 'Unknown course'}
        teeName={tee?.name ?? ''}
        playedOn={round.playedOn}
        holes={holes.map((h) => ({ holeNo: h.holeNo, par: h.par, strokeIndex: h.strokeIndex, yards: h.yards }))}
        initialShotsByHole={shotsByHole}
        initialHoleNo={computeResumeHole(shotsByHole)}
        firstRound={firstRound}
      />
      <div className="mt-6">
        <RoundDetailsForm
          roundId={roundId}
          playedOn={round.playedOn}
          playingHandicap={round.playingHandicap}
          detailedEntry={round.detailedEntry}
          initial={{
            name: round.name,
            notes: round.notes,
            mentalBalance: round.mentalBalance,
            mentalTempo: round.mentalTempo,
            mentalTension: round.mentalTension,
          }}
        />
      </div>
      <div className="mt-8 mb-4">
        <DeleteRoundButton roundId={roundId} shotCount={allShots.length} />
      </div>
    </main>
  );
}

function ReadOnlyRound({
  title,
  subtitle,
  ownerId,
  roundId,
  holes,
  shotsByHole,
}: {
  title: string;
  subtitle: string;
  ownerId: string | null;
  roundId: number;
  holes: { holeNo: number; par: number }[];
  shotsByHole: Record<number, { holed: boolean; penaltyStrokes: number; sg: number | null }[]>;
}) {
  const rows = holes.map((h) => {
    const hs = shotsByHole[h.holeNo] ?? [];
    const score = hs.length + hs.reduce((n, s) => n + s.penaltyStrokes, 0);
    return { ...h, played: hs.length > 0, score, sg: hs.reduce((n, s) => n + (s.sg ?? 0), 0) };
  });
  const played = rows.filter((r) => r.played);
  const totalScore = played.reduce((n, r) => n + r.score, 0);
  const totalSg = played.reduce((n, r) => n + r.sg, 0);

  return (
    <main className="max-w-lg mx-auto p-3 sm:p-6 space-y-4">
      <header>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-xs text-muted font-mono">{subtitle}</p>
        <p className="text-xs text-muted mt-1">
          Read-only.{' '}
          <Link className="underline" href={`/rounds/${roundId}/recap`}>
            Round recap
          </Link>
          {' · '}
          {ownerId && (
            <Link className="underline" href={`/players/${ownerId}`}>
              More from this player
            </Link>
          )}
        </p>
      </header>

      <div className="border rounded-xl bg-card p-4 space-y-3">
        <p className="font-semibold">
          {totalScore} <span className="text-muted font-normal text-sm">over {played.length} holes</span>{' '}
          <span className={`text-sm font-medium ${totalSg >= 0 ? 'text-pos' : 'text-neg'}`}>SG {fmtSg(totalSg)}</span>
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b">
              <th className="py-1">Hole</th>
              <th className="py-1">Par</th>
              <th className="py-1">Score</th>
              <th className="py-1 text-right">SG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.holeNo} className="border-b last:border-0">
                <td className="py-1">{r.holeNo}</td>
                <td className="py-1">{r.par}</td>
                <td className="py-1">{r.played ? r.score : '—'}</td>
                <td className={`py-1 text-right font-mono ${r.sg >= 0 ? 'text-pos' : 'text-neg'}`}>
                  {r.played ? fmtSg(r.sg) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
