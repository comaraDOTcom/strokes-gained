import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db/client';
import { user as userTable } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { getAllEnrichedShots } from '@/lib/insights/queries';
import { roundSummaries } from '@/lib/insights/aggregate';
import { fmtSg } from '@/lib/insights/chart-colors';

export const dynamic = 'force-dynamic';

/**
 * Another player's rounds — scores, traditional stats and SG only. This page
 * never loads `getRoundDetailsById` (names aside from the course, commentary and
 * mentality ratings are the owner's alone).
 */
export default async function PlayerPage({ params }: { params: Promise<{ userId: string }> }) {
  const me = await requirePageUser();
  const { userId } = await params;
  if (userId === me.id) redirect('/');

  const [player] = await db.select({ id: userTable.id, name: userTable.name }).from(userTable).where(eq(userTable.id, userId));
  if (!player) notFound();

  const rounds = roundSummaries(await getAllEnrichedShots(player.id));

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <p className="text-sm text-muted">
          <Link className="underline" href="/players">
            Players
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{player.name}</h1>
      </div>

      {rounds.length === 0 ? (
        <p className="text-ink-2">No rounds logged yet.</p>
      ) : (
        <ul className="space-y-3">
          {rounds.map((r) => (
            <li key={r.roundId} className="border rounded-xl bg-card p-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <Link href={`/rounds/${r.roundId}`} className="font-semibold hover:underline">
                  {r.courseName} — {r.teeName}
                </Link>
                <p className="text-xs text-muted font-mono">{r.playedOn}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {r.grossScore}{' '}
                  <span className="text-muted font-normal text-sm">
                    ({r.grossScore - r.par >= 0 ? '+' : ''}
                    {r.grossScore - r.par} · par {r.par})
                  </span>
                </p>
                <p className={`text-sm font-medium ${r.sgTotal >= 0 ? 'text-pos' : 'text-neg'}`}>SG {fmtSg(r.sgTotal)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
