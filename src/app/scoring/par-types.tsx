import type { ParTypeStats } from '@/lib/insights/scorecard';
import { fmtSg } from '@/lib/insights/chart-colors';

const toPar = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 'E' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const sgClass = (v: number) => (v > 0.005 ? 'text-pos' : v < -0.005 ? 'text-neg' : 'text-muted');
const scoreClass = (v: number) => (v > 0.005 ? 'text-neg' : v < -0.005 ? 'text-pos' : 'text-muted');

/** Par 3s, 4s and 5s side by side: average score to par and strokes gained, per hole and per round. */
export function ParTypes({ stats }: { stats: ParTypeStats[] }) {
  if (stats.length === 0) return <p className="py-4 text-sm text-faint">No finished holes yet.</p>;
  const worst = [...stats].sort((a, b) => a.sgPerRound - b.sgPerRound)[0]!;
  return (
    <div className="space-y-3">
      {stats.length > 1 && worst.sgPerRound < 0 && (
        <p className="text-base font-medium">
          Par {worst.par}s cost you the most: {fmtSg(worst.sgPerRound, 1)} strokes gained a round vs scratch.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {stats.map((p) => (
          <li key={p.par} className="space-y-3 rounded-lg border bg-paper p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-semibold">Par {p.par}s</p>
              <p className="font-mono text-xs text-muted">{p.holes} holes</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Avg score</dt>
                <dd className="font-mono text-xl font-medium" title={`${p.avgScore.toFixed(2)} strokes`}>
                  {p.avgScore.toFixed(2)}
                </dd>
                <dd className={`font-mono text-xs ${scoreClass(p.avgToPar)}`}>{toPar(p.avgToPar)} a hole</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Per round</dt>
                <dd className={`font-mono text-xl font-medium ${scoreClass(p.toParPerRound)}`}>{toPar(p.toParPerRound, 1)}</dd>
                <dd className="font-mono text-xs text-muted">over {Number.isInteger(p.perRound) ? p.perRound : p.perRound.toFixed(1)} holes</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">SG a hole</dt>
                <dd className={`font-mono text-sm ${sgClass(p.sgPerHole)}`} title={fmtSg(p.sgPerHole, 3)}>
                  {fmtSg(p.sgPerHole, 2)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">SG a round</dt>
                <dd className={`font-mono text-sm font-medium ${sgClass(p.sgPerRound)}`} title={fmtSg(p.sgPerRound)}>
                  {fmtSg(p.sgPerRound, 1)}
                </dd>
              </div>
            </dl>
            <p className="border-t pt-2 font-mono text-[11px] text-ink-2">
              Birdie+ {pct(p.birdieOrBetter)} · Par {pct(p.pars)} · Bogey {pct(p.bogeys)} · Double+ {pct(p.doubleOrWorse)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
