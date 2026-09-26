import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { getAllEnrichedShots } from '@/lib/insights/queries';
import { DRILLS, drillById } from '@/lib/practice/drills';
import { DEFAULT_PLAN_ROUNDS, buildPracticePlan, parsePlanRounds } from '@/lib/practice/plan';
import { chronological, drillProgress, todayInIreland } from '@/lib/practice/progress';
import { listSessions } from '@/lib/practice/sessions';
import { DeleteSessionButton, LogSessionForm, type FormDrill } from './log-session-form';
import { PlanCard, RecordLine, SessionStrip, fmtDate } from './practice-parts';

export const dynamic = 'force-dynamic';

const WINDOW_CHOICES = [3, DEFAULT_PLAN_ROUNDS, 10];
const RECENT_LIST = 8;

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ rounds?: string | string[] }> }) {
  const user = await requirePageUser();
  const roundWindow = parsePlanRounds((await searchParams).rounds);
  const [shots, sessions] = await Promise.all([getAllEnrichedShots(user.id), listSessions(user.id)]);
  const plan = buildPracticePlan(shots, { roundWindow });
  const progress = drillProgress(sessions);
  const progressByDrill = new Map(progress.map((p) => [p.drillId, p]));
  const today = todayInIreland();

  const planDrillIds = new Set(plan.status === 'ready' ? plan.items.flatMap((i) => i.drills.map((d) => d.id)) : []);
  const formDrills: FormDrill[] = DRILLS.map((d) => ({
    id: d.id,
    name: d.name,
    outOf: d.outOf,
    passMark: d.passMark,
    scoreUnit: d.scoreUnit,
    inPlan: planDrillIds.has(d.id),
  }));
  const defaultDrillId = formDrills.find((d) => d.inPlan)?.id ?? DRILLS[0]!.id;
  const recent = chronological(sessions).reverse().slice(0, RECENT_LIST);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Practice</p>
        <h1 className="text-2xl font-semibold">Next session</h1>
        <p className="text-sm text-ink-2">
          Where your rounds say the strokes are, and a drill with a pass mark for each. Every drill is random practice: a
          new target or distance on every ball, and a score, so you know whether it&apos;s working.
        </p>
      </header>

      {plan.status === 'not-enough-rounds' ? (
        <section className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">Your plan needs {plan.minRounds} rounds</h2>
          <p className="text-sm text-ink-2">
            You&apos;ve logged {plan.roundsTotal} round{plan.roundsTotal === 1 ? '' : 's'}. After {plan.minRounds}, this page
            ranks the parts of your game costing you the most strokes and gives you a drill for each. You can log practice
            sessions below in the meantime.
          </p>
          <Link href="/rounds/new" className="inline-block rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-paper">
            Log a round
          </Link>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Your plan</h2>
            <nav className="flex items-center gap-1 font-mono text-xs" aria-label="Rounds to build the plan from">
              <span className="text-muted">Last</span>
              {WINDOW_CHOICES.map((n) => (
                <Link
                  key={n}
                  href={n === DEFAULT_PLAN_ROUNDS ? '/practice' : `/practice?rounds=${n}`}
                  className={`rounded px-1.5 py-0.5 ${n === roundWindow ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-paper-2'}`}
                >
                  {n}
                </Link>
              ))}
              <span className="text-muted">rounds</span>
            </nav>
          </div>
          <p className="text-xs text-muted">
            From your last {plan.roundsUsed} round{plan.roundsUsed === 1 ? '' : 's'} ({fmtDate(plan.firstPlayedOn)} to{' '}
            {fmtDate(plan.lastPlayedOn)}), ranked by strokes lost to scratch a round.
          </p>
          {plan.items.length === 0 ? (
            <p className="text-sm text-ink-2">
              Nothing in your last {plan.roundsUsed} rounds loses strokes to scratch. Keep doing what you&apos;re doing.
            </p>
          ) : (
            <ol className="space-y-3">
              {plan.items.map((item, i) => (
                <PlanCard key={item.area} item={item} rank={i + 1} progressByDrill={progressByDrill} />
              ))}
            </ol>
          )}
        </section>
      )}

      <section id="log" className="scroll-mt-28 space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-lg font-semibold">Log a session</h2>
        <LogSessionForm drills={formDrills} today={today} defaultDrillId={defaultDrillId} />
      </section>

      {progress.length > 0 && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="text-lg font-semibold">How your drills are going</h2>
          <ul className="space-y-2">
            {progress.map((p) => (
              <li key={p.drillId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-paper px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{drillById(p.drillId)?.name ?? p.drillId}</p>
                  <p className="text-xs">
                    <RecordLine progress={p} />
                  </p>
                </div>
                <SessionStrip rows={p.recent} />
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-2">Recent sessions</summary>
            <ul className="mt-2 divide-y">
              {recent.map((s) => {
                const name = drillById(s.drillId)?.name ?? s.drillId;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-muted">{fmtDate(s.practisedOn)}</span> {name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${s.passed ? 'text-pos' : 'text-ink-2'}`}>
                        {s.score}/{s.outOf} {s.passed ? 'pass' : 'not yet'}
                      </span>
                      <DeleteSessionButton id={s.id} label={`${name} on ${fmtDate(s.practisedOn)}`} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </details>
        </section>
      )}

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">How the plan works</summary>
        <div className="mt-2 space-y-2 text-ink-2">
          <p>
            Each part of your game gets one number: strokes lost to a scratch golfer a round, over your last{' '}
            {roundWindow} rounds. A 9-hole round counts as half. The top three become your plan. Inside each, the
            plan finds the distance range that costs the most (a 30-yard window for approach shots, 10 yards around the
            green, set ranges on the greens, greenside or fairway for bunkers) as long as it has at least 3 shots in it. A
            drill is offered only when it covers at least half that range.
          </p>
          <p>
            This differs from What to work on, on Trends, which also weighs how much each part of the game matters to
            scoring in general. This page goes straight to where your strokes are.
          </p>
          <p>
            Pass marks are starting points, not yet tuned to your handicap. If you pass a drill
            every time, it&apos;s time to make it harder.
          </p>
        </div>
      </details>
    </main>
  );
}
