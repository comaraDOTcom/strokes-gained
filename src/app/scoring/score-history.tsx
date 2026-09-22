import Link from 'next/link';
import type { RoundSummary } from '@/lib/insights/aggregate';
import { fmtSg } from '@/lib/insights/chart-colors';
import { TrendBarChart } from '../insights/charts';

const toPar = (v: number) => (v === 0 ? 'E' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`);

/** Every round ever logged, every course: a to-par chart of full rounds, headline numbers, and the list. */
export function ScoreHistory({ rounds, names }: { rounds: RoundSummary[]; names: Map<number, string | null> }) {
  const full = rounds.filter((r) => r.holesPlayed === 18);
  const oldestFirst = [...full].reverse();
  const chart = oldestFirst.map((r, i) => {
    const last = oldestFirst.slice(Math.max(0, i - 4), i + 1);
    return {
      round: r.playedOn,
      toPar: r.grossScore - r.par,
      avg: Number((last.reduce((a, x) => a + x.grossScore - x.par, 0) / last.length).toFixed(2)),
    };
  });
  const avg = (rs: RoundSummary[]) => rs.reduce((a, r) => a + r.grossScore, 0) / rs.length;
  const best = full.reduce<RoundSummary | null>((b, r) => (!b || r.grossScore - r.par < b.grossScore - b.par ? r : b), null);
  const stats: [string, string][] = full.length
    ? [
        ['Full rounds', `${full.length}`],
        ['Best', `${best!.grossScore} (${toPar(best!.grossScore - best!.par)})`],
        ['Average', avg(full).toFixed(1)],
        ['Last 5 avg', avg(full.slice(0, 5)).toFixed(1)],
      ]
    : [];
  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-paper px-3 py-2">
              <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">{k}</dt>
              <dd className="font-mono text-xl font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {chart.length > 1 && (
        <div>
          <p className="mb-1 text-xs text-muted">Score to par, full rounds, oldest to newest. Dashed: your average over the last 5.</p>
          <TrendBarChart data={chart} xKey="round" valueKey="toPar" rollingKey="avg" rollingLabel="5-round average" format="toPar" height={200} />
        </div>
      )}
      {/* A list, not a table: date/name/course take the flexible column, and the numbers that
          matter stay on screen at any width. */}
      <ul className="divide-y border-y text-sm">
        <li className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem] gap-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">
          <span>Round</span>
          <span className="text-right">Score</span>
          <span className="text-right">SG</span>
        </li>
        {rounds.map((r) => {
          const tp = r.grossScore - r.par;
          return (
            <li key={r.roundId} className="grid grid-cols-[minmax(0,1fr)_4.5rem_3.5rem] items-center gap-3 py-2">
              <div className="min-w-0">
                <Link href={`/rounds/${r.roundId}/scorecard`} className="line-clamp-1 font-medium hover:underline">
                  {names.get(r.roundId) ?? r.courseName}
                </Link>
                <span className="block truncate font-mono text-[11px] text-muted">
                  {r.playedOn} · {r.courseName}
                  {r.holesPlayed < 18 && ` · ${r.holesPlayed} holes`}
                </span>
              </div>
              <span className="text-right font-mono">
                {r.grossScore}{' '}
                <span className={`text-xs ${tp > 0 ? 'text-neg' : tp < 0 ? 'text-pos' : 'text-muted'}`}>({toPar(tp)})</span>
              </span>
              <span className={`text-right font-mono ${r.sgTotal >= 0 ? 'text-pos' : 'text-neg'}`} title={fmtSg(r.sgTotal)}>
                {fmtSg(r.sgTotal, 1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
