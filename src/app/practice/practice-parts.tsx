import type { Drill } from '@/lib/practice/drills';
import type { PlanItem } from '@/lib/practice/plan';
import type { DrillProgress, PassTrend, SessionRow } from '@/lib/practice/progress';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const TREND_WORD: Record<PassTrend['direction'], string> = { up: 'Passing more often', down: 'Passing less often', steady: 'Steady' };

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** One bar per session, oldest first: height = score out of the maximum, green = passed. The
 * tick is the pass mark. */
export function SessionStrip({ rows }: { rows: SessionRow[] }) {
  return (
    <span className="flex items-end gap-[3px]" aria-label="Recent sessions, oldest first">
      {rows.map((r) => (
        <span
          key={r.id}
          title={`${fmtDate(r.practisedOn)}: ${r.score} of ${r.outOf}, ${r.passed ? 'passed' : 'not passed'}`}
          className="relative flex h-8 w-2 items-end rounded-sm bg-paper-2"
        >
          <span
            className={`w-full rounded-sm ${r.passed ? 'bg-pos' : 'bg-line-strong'}`}
            style={{ height: `${Math.max(6, (r.score / r.outOf) * 100)}%` }}
          />
          <span className="absolute inset-x-0 h-px bg-ink/60" style={{ bottom: `${(r.passMark / r.outOf) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

/** "3 of 5 passed (60%) · Passing more often", or "No sessions yet". */
export function RecordLine({ progress }: { progress: DrillProgress | undefined }) {
  if (!progress) return <span className="text-muted">No sessions logged yet.</span>;
  const { sessions, passes, passRate, trend } = progress;
  return (
    <span>
      <span className="font-mono">
        {passes} of {sessions} passed ({pct(passRate)})
      </span>
      {trend ? (
        <span className="text-ink-2">
          {' '}
          · {TREND_WORD[trend.direction]}
          <span className="text-muted">
            {' '}
            ({pct(trend.earlierRate)} → {pct(trend.recentRate)})
          </span>
        </span>
      ) : (
        <span className="text-muted"> · early days for a trend</span>
      )}
    </span>
  );
}

export function DrillCard({ drill, progress }: { drill: Drill; progress: DrillProgress | undefined }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium">{drill.name}</p>
        <p className="font-mono text-xs text-ink-2">
          Pass: {drill.passMark} of {drill.outOf} {drill.scoreUnit}
        </p>
      </div>
      <p className="text-sm text-ink-2">{drill.setup}</p>
      <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-2">
        {drill.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="text-xs text-muted">
        <span className="font-medium text-ink-2">Why: </span>
        {drill.rationale}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs">
        <RecordLine progress={progress} />
        {progress && <SessionStrip rows={progress.recent} />}
      </div>
    </div>
  );
}

export function PlanCard({ item, rank, progressByDrill }: { item: PlanItem; rank: number; progressByDrill: Map<string, DrillProgress> }) {
  return (
    <li className="space-y-3 rounded-xl border bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            <span className="mr-1.5 font-mono text-muted">{rank}.</span>
            {item.label}
            {item.focus && <span className="text-ink-2">, {item.focus.label}</span>}
          </p>
        </div>
        <p className="shrink-0 text-right font-mono text-sm text-neg" title="Strokes lost to scratch a round in this part of your game">
          −{item.strokesPerRound.toFixed(1)}
          <span className="text-xs text-muted"> a round</span>
        </p>
      </div>
      <p className="text-sm text-ink-2">{item.sentence}</p>
      {item.drills.length > 0 ? (
        <div className="space-y-2">
          {item.drills.map((d) => (
            <DrillCard key={d.id} drill={d} progress={progressByDrill.get(d.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted">
          There&apos;s no drill in the library for {item.focus ? item.focus.label : 'this part of the game'} yet.
        </p>
      )}
    </li>
  );
}
