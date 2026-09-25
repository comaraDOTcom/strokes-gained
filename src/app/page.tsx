import Link from 'next/link';
import { getAllEnrichedShots, getCourseOptions, getRoundDetailsById } from '@/lib/insights/queries';
import { resolveSelectedCourseId } from '@/lib/insights/course-filter';
import { CourseFilter } from './course-filter';
import { ExpandableText } from './expandable-text';
import { ReelIcon } from './recap-icon';
import { buildRoundRecap } from '@/lib/insights/recap';
import { sgClass } from './recap-parts';
import { roundSummaries } from '@/lib/insights/aggregate';
import { fmtSg } from '@/lib/insights/chart-colors';
import { requirePageUser } from '@/lib/auth/session';
import { qualityStat } from '@/lib/insights/quality';
import { QualityInfo } from './quality-info';
import { RoundsTip } from './rounds-tip';
import { ScenePicker } from './scene-picker';
import { cookies } from 'next/headers';
import { SCENE_COOKIE, SCENE_LABELS, parseScenePreference, resolveScene } from '@/lib/scene/scene';

// Reads live round/shot state — never statically prerendered.
export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const user = await requirePageUser();
  const { course } = await searchParams;
  const options = await getCourseOptions(user.id);
  const selectedCourseId = resolveSelectedCourseId(options, Array.isArray(course) ? course[0] : course);
  const selected = options.find((o) => o.courseId === selectedCourseId);
  const roundCount = selected?.roundCount ?? 0;
  const shots = selectedCourseId === null ? [] : await getAllEnrichedShots(user.id, selectedCourseId);
  const rounds = roundSummaries(shots);
  const detailsById = await getRoundDetailsById(user.id);
  const scenePref = parseScenePreference((await cookies()).get(SCENE_COOKIE)?.value);
  const scene = resolveScene(scenePref);
  const autoScene = resolveScene('auto');

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rounds</h1>
        <Link href="/rounds/new" className="bg-ink text-white text-sm font-medium px-4 py-2 rounded">
          New round
        </Link>
      </header>

      {/* The backdrop the player picked (or the season's, on Auto). The layout sets the scene
          on <body>, so this banner, the footer and the sign-in page all show the same one. */}
      <section className="space-y-3">
        <div
          role="img"
          aria-label={`${SCENE_LABELS[scene].weather} ${SCENE_LABELS[scene].name.toLowerCase()} on the course`}
          className="golf-scene golf-scene-hero h-40 sm:h-60 rounded-2xl border relative overflow-hidden"
        >
          <span className="absolute left-3 bottom-3 rounded-md bg-card/90 backdrop-blur-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-2">
            {SCENE_LABELS[scene].weather} {SCENE_LABELS[scene].name}
          </span>
        </div>
        <ScenePicker preference={scenePref} autoScene={autoScene} />
      </section>

      <CourseFilter options={options} selectedCourseId={selectedCourseId} basePath="/" />

      {roundCount > 0 && <RoundsTip />}

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
            const roundShots = shots.filter((s) => s.roundId === r.roundId);
            const story = buildRoundRecap(roundShots);
            const quality = qualityStat(roundShots);
            const bestHole = story.bestHoles[0];
            const worstHole = story.worstHoles[0];
            const ratings = [
              ['Balance', d?.mentalBalance],
              ['Tempo', d?.mentalTempo],
              ['Tension', d?.mentalTension],
            ].filter((x): x is [string, number] => typeof x[1] === 'number');
            return (
              <li key={r.roundId} className="border rounded-xl bg-card p-3 sm:p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                    <Link href={`/rounds/${r.roundId}`} className="font-semibold hover:underline">
                      {d?.name ?? `${r.courseName} — ${r.teeName}`}
                    </Link>
                    <p className="text-xs text-muted font-mono">
                      {d?.name ? `${r.courseName} — ${r.teeName} · ` : ''}
                      {r.playedOn}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                  <QualityInfo stat={quality} />
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
                </div>

                {/* The round's story at a glance — the full click-through is one tap away. */}
                {story.holesPlayed > 0 && (
                  <div className="rounded-xl border bg-paper p-3 space-y-2">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      {story.strongArea && (
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Strongest</dt>
                          <dd>
                            {story.strongArea.label}{' '}
                            <span className={`font-mono ${sgClass(story.strongArea.sg)}`}>{fmtSg(story.strongArea.sg)}</span>
                          </dd>
                        </div>
                      )}
                      {story.weakArea && (
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Work on</dt>
                          <dd>
                            {story.weakArea.label}{' '}
                            <span className={`font-mono ${sgClass(story.weakArea.sg)}`}>{fmtSg(story.weakArea.sg)}</span>
                          </dd>
                        </div>
                      )}
                      {bestHole && (
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Best hole</dt>
                          <dd>
                            {bestHole.holeNo} · {bestHole.result}{' '}
                            <span className={`font-mono ${sgClass(bestHole.sg)}`}>{fmtSg(bestHole.sg)}</span>
                          </dd>
                        </div>
                      )}
                      {worstHole && (
                        <div>
                          <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Worst hole</dt>
                          <dd>
                            {worstHole.holeNo} · {worstHole.result}{' '}
                            <span className={`font-mono ${sgClass(worstHole.sg)}`}>{fmtSg(worstHole.sg)}</span>
                          </dd>
                        </div>
                      )}
                    </dl>
                    <Link
                      href={`/rounds/${r.roundId}/recap`}
                      className="flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper"
                    >
                      <ReelIcon size={18} /> Watch the round recap
                    </Link>
                    <Link
                      href={`/rounds/${r.roundId}/scorecard`}
                      className="block text-center text-sm underline underline-offset-2 text-ink-2"
                    >
                      View scorecard
                    </Link>
                  </div>
                )}

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
