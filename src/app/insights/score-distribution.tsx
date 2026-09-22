import type { ScoreDistribution } from '@/lib/insights/scorecard';
import { toneFillClass } from '../score-cell';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ratio = (x: number | null) => (x === null ? '—' : `${x.toFixed(1)} : 1`);

function Ratio({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className="rounded-lg border bg-paper px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-2xl font-medium">{ratio(value)}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}

/** Share of every hole played that finished eagle-or-better … triple-or-worse, plus the two ratios that matter. */
export function ScoreDistributionChart({ d }: { d: ScoreDistribution }) {
  if (d.holesPlayed === 0) return <p className="py-4 text-sm text-faint">No finished holes yet.</p>;
  const max = Math.max(...d.buckets.map((b) => b.pct));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Ratio
          label="Par or better : bogey"
          value={d.parToBogey}
          detail={`${d.parOrBetter} par or better, ${d.bogeys} bogey${d.bogeys === 1 ? '' : 's'}`}
        />
        <Ratio
          label="Par or better : double+"
          value={d.parToDoublePlus}
          detail={`${d.parOrBetter} par or better, ${d.doubleOrWorse} double or worse`}
        />
      </div>
      <ul className="space-y-1.5">
        {d.buckets.map((b) => (
          <li key={b.key} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-2 text-sm">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{b.label}</span>
            <span className="h-5 border-l border-line-strong">
              <span
                className={`block h-full rounded-r-sm ring-1 ring-inset ring-ink/10 ${toneFillClass(b.key)}`}
                style={{ width: max ? `${(b.pct / max) * 100}%` : 0 }}
              />
            </span>
            <span className="text-right font-mono text-xs">
              {pct(b.pct)} <span className="text-faint">({b.count})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
