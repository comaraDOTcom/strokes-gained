import Link from 'next/link';
import { getAllEnrichedShots, getRoundCount } from '@/lib/insights/queries';
import { roundSummaries } from '@/lib/insights/aggregate';
import { fmtSg } from '@/lib/insights/chart-colors';

// Reads live round/shot state — never statically prerendered.
export const dynamic = 'force-dynamic';

export default function Home() {
  const roundCount = getRoundCount();
  const shots = getAllEnrichedShots();
  const rounds = roundSummaries(shots);

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rounds</h1>
        <Link href="/rounds/new" className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded">
          New round
        </Link>
      </header>

      {roundCount === 0 ? (
        <p className="text-gray-600">
          No rounds logged yet. <Link className="underline" href="/rounds/new">Start one</Link>.
        </p>
      ) : (
        <ul className="space-y-3">
          {rounds.map((r) => {
            const t = r.traditional;
            return (
              <li key={r.roundId} className="border rounded p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link href={`/rounds/${r.roundId}`} className="font-semibold hover:underline">
                      {r.courseName} — {r.teeName}
                    </Link>
                    <p className="text-xs text-gray-500">{r.playedOn}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {r.grossScore}{' '}
                      <span className="text-gray-500 font-normal text-sm">
                        ({r.grossScore - r.par >= 0 ? '+' : ''}
                        {r.grossScore - r.par} · par {r.par})
                      </span>
                    </p>
                    <p className={`text-sm font-medium ${r.sgTotal >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                      SG {fmtSg(r.sgTotal)}
                    </p>
                  </div>
                </div>

                {/* Traditional scorecard stats — derived from the shots above, never a separate input. */}
                <dl className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs text-gray-700 border-t pt-2">
                  <div>
                    <dt className="text-gray-400">GIR</dt>
                    <dd className="font-medium text-gray-900">
                      {t.girCount}/{t.girTotal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Putts</dt>
                    <dd className="font-medium text-gray-900">{t.putts}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Fairways</dt>
                    <dd className="font-medium text-gray-900">
                      {t.fairwaysTotal > 0 ? `${t.fairwaysHit}/${t.fairwaysTotal}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Sand saves</dt>
                    <dd className="font-medium text-gray-900">
                      {t.sandSave.attempted > 0 ? `${t.sandSave.converted}/${t.sandSave.attempted}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Up &amp; down</dt>
                    <dd className="font-medium text-gray-900">
                      {t.upAndDown.attempted > 0 ? `${t.upAndDown.converted}/${t.upAndDown.attempted}` : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 border-t pt-2">
                  {Object.entries(r.sgByCategory)
                    .filter(([, sg]) => Math.abs(sg) > 1e-9)
                    .map(([category, sg]) => (
                      <span key={category}>
                        {category.replace(/_/g, ' ')} <span className={sg >= 0 ? 'text-blue-700' : 'text-red-600'}>{fmtSg(sg)}</span>
                      </span>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {roundCount > 0 && (
        <p className="text-sm text-gray-500">
          {roundCount} round{roundCount === 1 ? '' : 's'} logged.{' '}
          <Link className="underline" href="/insights">
            See the full breakdown
          </Link>
          {' · '}
          <Link className="underline" href="/trends">
            Trends &amp; practice focus
          </Link>
          .
        </p>
      )}

    </main>
  );
}
