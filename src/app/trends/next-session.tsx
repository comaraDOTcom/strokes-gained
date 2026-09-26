import Link from 'next/link';
import type { PracticePlan } from '@/lib/practice/plan';
import type { PracticeSummary } from '@/lib/practice/progress';

/** The practice plan's top line and the practice log's last 30 days, pointing at /practice. */
export function NextSessionSection({ plan, summary }: { plan: PracticePlan; summary: PracticeSummary }) {
  const top = plan.status === 'ready' ? plan.items[0] : undefined;
  const drill = top?.drills[0];
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Next session</h2>
        <Link href="/practice" className="text-sm text-accent underline-offset-4 hover:underline">
          Your practice plan
        </Link>
      </div>
      {plan.status === 'not-enough-rounds' ? (
        <p className="text-sm text-ink-2">After {plan.minRounds} rounds you get a practice plan with drills for the parts of your game costing the most.</p>
      ) : top ? (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">
            {top.label}
            {top.focus ? `, ${top.focus.label}` : ''}
          </span>
          : −{top.strokesPerRound.toFixed(1)} a round over your last {plan.roundsUsed} rounds.
          {drill ? ` Drill: ${drill.name}, pass at ${drill.passMark} of ${drill.outOf}.` : ''}
        </p>
      ) : (
        <p className="text-sm text-ink-2">Nothing in your last {plan.roundsUsed} rounds loses strokes to scratch.</p>
      )}
      <p className="text-xs text-muted">
        {summary.sessions === 0
          ? summary.lastPractisedOn
            ? `No practice sessions logged in the last ${summary.days} days.`
            : 'No practice sessions logged yet.'
          : `${summary.sessions} practice session${summary.sessions === 1 ? '' : 's'} in the last ${summary.days} days, ${summary.passes} passed (${Math.round(
              (summary.passRate ?? 0) * 100,
            )}%).`}{' '}
        The plan ranks by strokes lost a round, so it can differ from the list above, which also weighs importance.
      </p>
    </section>
  );
}
