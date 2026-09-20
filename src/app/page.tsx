import Link from 'next/link';
import { getAllEnrichedShots, getCourseOptions, getRoundDetailsById } from '@/lib/insights/queries';
import { resolveSelectedCourseId } from '@/lib/insights/course-filter';
import { CourseFilter } from './course-filter';
import { ExpandableText } from './expandable-text';
import { roundSummaries } from '@/lib/insights/aggregate';
import { fmtSg } from '@/lib/insights/chart-colors';

// Reads live round/shot state — never statically prerendered.
export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course } = await searchParams;
  const options = getCourseOptions();
  const selectedCourseId = resolveSelectedCourseId(options, Array.isArray(course) ? course[0] : course);
  const selected = options.find((o) => o.courseId === selectedCourseId);
  const roundCount = selected?.roundCount ?? 0;
  const shots = selectedCourseId === null ? [] : getAllEnrichedShots(selectedCourseId);
  const rounds = roundSummaries(shots);
  const detailsById = getRoundDetailsById();

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rounds</h1>
        <Link href="/rounds/new" className="bg-ink text-white text-sm font-medium px-4 py-2 rounded">
          New round
        </Link>
      </header>

      <CourseFilter options={options} selectedCourseId={selectedCourseId} basePath="/" />

      {roundCount === 0 ? (
        <p className="text-ink-2">
          No rounds logged yet{selected ? ` at ${selected.name}` : ''}.{' '}
          <Link className="underline" href="/rounds/new">Log a round</Link>.
        </p>
      ) : (
        <ul className="space-y-3">
          {rounds.map((r) => {
            const t = r.traditional;
            const d = detailsById.get(r.roundId);
            const ratings = [
              ['Conf', d?.mentalConfidence],
              ['Focus', d?.mentalFocus],
              ['Comp', d?.mentalComposure],
            ].filter((x): x is [string, number] => typeof x[1] === 'number');
            return (
              <li key={r.roundId} className="border rounded-xl bg-card p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <Link href={`/rounds/${r.roundId}`} className="font-semibold hover:underline">
                      {d?.name ?? `${r.courseName} — ${r.teeName}`}
                    </Link>
                    <p className="text-xs text-muted font-mono">
                      {d?.name ? `${r.courseName} — ${r.teeName} · ` : ''}
                      {r.playedOn}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {r.grossScore}{' '}
                      <span className="text-muted font-normal text-sm">
                        ({r.grossScore - r.par >= 0 ? '+' : ''}
                        {r.grossScore - r.par} · par {r.par})
                      </span>
                    </p>
                    <p className={`text-sm font-medium ${r.sgTotal >= 0 ? 'text-pos' : 'text-neg'}`}>
                      SG {fmtSg(r.sgTotal)}
                    </p>
                  </div>
                </div>

                {/* Traditional scorecard stats — derived from the shots above, never a separate input. */}
                <dl className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs text-ink-2 border-t pt-2">
                  <div>
                    <dt className="text-faint">GIR</dt>
                    <dd className="font-medium text-ink">
                      {t.girCount}/{t.girTotal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-faint">Putts</dt>
                    <dd className="font-medium text-ink">{t.putts}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Fairways</dt>
                    <dd className="font-medium text-ink">
                      {t.fairwaysTotal > 0 ? `${t.fairwaysHit}/${t.fairwaysTotal}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-faint">Sand saves</dt>
                    <dd className="font-medium text-ink">
                      {t.sandSave.attempted > 0 ? `${t.sandSave.converted}/${t.sandSave.attempted}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-faint">Up &amp; down</dt>
                    <dd className="font-medium text-ink">
                      {t.upAndDown.attempted > 0 ? `${t.upAndDown.converted}/${t.upAndDown.attempted}` : '—'}
                    </dd>
                  </div>
                </dl>

                {(d?.notes || ratings.length > 0) && (
                  <div className="border-t pt-2 space-y-1">
                    {d?.notes && <ExpandableText text={d.notes} className="text-sm text-ink-2" />}
                    {ratings.length > 0 && (
                      <p className="font-mono text-xs text-muted">
                        {ratings.map(([label, v]) => `${label} ${v}/5`).join(' · ')}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted border-t pt-2">
                  {Object.entries(r.sgByCategory)
                    .filter(([, sg]) => Math.abs(sg) > 1e-9)
                    .map(([category, sg]) => (
                      <span key={category}>
                        {category.replace(/_/g, ' ')} <span className={sg >= 0 ? 'text-pos' : 'text-neg'}>{fmtSg(sg)}</span>
                      </span>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {roundCount > 0 && (
        <p className="text-sm text-muted">
          {roundCount} round{roundCount === 1 ? '' : 's'} logged at {selected?.name}.{' '}
          <Link className="underline" href={`/insights?course=${selectedCourseId}`}>
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
