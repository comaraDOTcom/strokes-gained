import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { courses, tees, user as userTable } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { getRoundForViewer, HttpError } from '@/lib/auth/guards';
import { getAllEnrichedShots, getTeeHoleMeta } from '@/lib/insights/queries';
import { buildRoundCard, type CardHole, type Totals } from '@/lib/insights/scorecard';
import { fmtSg } from '@/lib/insights/chart-colors';
import { ScoreLegend, scoreToneClass } from '@/app/score-cell';
import { ReelIcon } from '@/app/recap-icon';

export const dynamic = 'force-dynamic';

function Nine({ title, holes, totals, showPoints }: { title: string; holes: CardHole[]; totals: Totals; showPoints: boolean }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b font-mono text-[11px] uppercase tracking-wide text-muted">
          <th className="py-1.5 text-left font-normal">Hole</th>
          <th className="py-1.5 text-center font-normal">Par</th>
          <th className="py-1.5 text-center font-normal">Index</th>
          <th className="py-1.5 text-center font-normal">Score</th>
          {showPoints && <th className="py-1.5 text-center font-normal">Pts</th>}
          <th className="py-1.5 text-right font-normal">SG</th>
        </tr>
      </thead>
      <tbody>
        {holes.map((h) => (
          <tr key={h.holeNo} className="border-b last:border-0">
            <td className="py-1 font-medium">{h.holeNo}</td>
            <td className="py-1 text-center text-ink-2">{h.par}</td>
            <td className="py-1 text-center text-muted">{h.strokeIndex ?? '—'}</td>
            <td className="py-1">
              <div className={`mx-auto flex h-7 w-9 items-center justify-center rounded-md font-mono text-sm ${scoreToneClass(h.toPar)}`}>
                {h.score ?? '–'}
              </div>
            </td>
            {showPoints && <td className="py-1 text-center font-mono text-xs">{h.points ?? ''}</td>}
            <td className={`py-1 text-right font-mono text-xs ${h.sg === null ? 'text-faint' : h.sg >= 0 ? 'text-pos' : 'text-neg'}`}>
              {h.sg === null ? '—' : fmtSg(h.sg)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 font-semibold">
          <td className="py-1.5">{title}</td>
          <td className="py-1.5 text-center">{totals.par}</td>
          <td />
          <td className="py-1.5 text-center font-mono">{totals.score ?? '–'}</td>
          {showPoints && <td className="py-1.5 text-center font-mono">{totals.points ?? ''}</td>}
          <td className={`py-1.5 text-right font-mono text-xs ${totals.sg >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtSg(totals.sg)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default async function ScorecardPage({ params }: { params: Promise<{ roundId: string }> }) {
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

  const [[course], [tee], [player], shots, meta] = await Promise.all([
    db.select().from(courses).where(eq(courses.id, round.courseId)),
    db.select().from(tees).where(eq(tees.id, round.teeId)),
    db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, round.userId)),
    getAllEnrichedShots(round.userId, round.courseId),
    getTeeHoleMeta([round.teeId]),
  ]);
  const card = buildRoundCard(meta.get(round.teeId) ?? [], shots.filter((s) => s.roundId === roundId), round.playingHandicap);
  const o = card.overall;
  const complete = o.holesPlayed === card.holes.length;
  const where = `${course?.name ?? 'Unknown course'} — ${tee?.name ?? ''}`;

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{round.name ?? where}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm text-ink-2">
          <dt className="text-muted">Date</dt>
          <dd>{round.playedOn}</dd>
          <dt className="text-muted">Course</dt>
          <dd>
            {where}
            {tee?.courseRating != null && (
              <span className="font-mono text-xs text-muted"> · CR {tee.courseRating} / SR {tee.slopeRating ?? '—'}</span>
            )}
          </dd>
          <dt className="text-muted">Player</dt>
          <dd>
            {player?.name ?? '—'}
            {round.playingHandicap !== null && (
              <span className="font-mono text-xs text-muted">
                {' '}
                · playing handicap {round.playingHandicap < 0 ? `+${-round.playingHandicap}` : round.playingHandicap}
              </span>
            )}
          </dd>
        </dl>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Gross', o.score === null ? '–' : `${o.score}${complete ? ` (${o.score - o.par >= 0 ? '+' : ''}${o.score - o.par})` : ''}`],
          ['Net', o.net === null ? '—' : String(o.net)],
          ['Stableford', o.points === null ? '—' : `${o.points} pts`],
          ['Strokes gained', fmtSg(o.sg)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{k}</p>
            <p className="font-mono text-lg font-medium">{v}</p>
          </div>
        ))}
      </section>
      {!complete && <p className="text-sm text-muted">{o.holesPlayed} of {card.holes.length} holes finished — totals are for those holes.</p>}
      {round.playingHandicap === null ? (
        <p className="text-sm text-muted">
          Add a playing handicap in the round&apos;s notes to see net score and Stableford points.
        </p>
      ) : (
        !card.hasHandicapScoring && (
          <p className="text-sm text-muted">
            Net and Stableford need a stroke index on every hole — this tee doesn&apos;t have a full set yet (add them in the course editor).
          </p>
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-3">
          <Nine title="Front nine" holes={card.holes.filter((h) => h.holeNo <= 9)} totals={card.front} showPoints={card.hasHandicapScoring} />
        </section>
        <section className="rounded-xl border bg-card p-3">
          <Nine title="Back nine" holes={card.holes.filter((h) => h.holeNo > 9)} totals={card.back} showPoints={card.hasHandicapScoring} />
        </section>
      </div>
      <ScoreLegend />

      <div className="flex flex-wrap gap-2">
        <Link href={`/rounds/${roundId}/recap`} className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
          <ReelIcon size={18} /> Watch the recap
        </Link>
        <Link href={`/rounds/${roundId}`} className="rounded-lg border border-line-strong px-4 py-2 text-sm">
          Shot by shot
        </Link>
      </div>
    </main>
  );
}
