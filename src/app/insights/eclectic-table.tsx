import Link from 'next/link';
import type { Eclectic } from '@/lib/insights/scorecard';
import { ScoreLegend, scoreToneClass } from '../score-cell';

function Cells({ scores, pars, strong = false }: { scores: (number | null)[]; pars: number[]; strong?: boolean }) {
  return (
    <>
      {scores.map((s, i) => (
        <td key={i} className="p-0.5">
          <div
            className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md font-mono text-xs ${scoreToneClass(
              s === null ? null : s - pars[i]!,
            )} ${strong ? 'ring-1 ring-ink/20' : ''}`}
          >
            {s ?? '–'}
          </div>
        </td>
      ))}
    </>
  );
}

/** Every round at this course, hole by hole, with the best and worst score made on each hole. */
export function EclecticTable({ eclectic }: { eclectic: Eclectic }) {
  const pars = eclectic.holes.map((h) => h.par);
  const parTotal = pars.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        {eclectic.eclecticTotal !== null ? (
          <>
            Your eclectic — the best you&apos;ve made on every hole —{' '}
            <span className="font-mono font-medium text-ink">
              {eclectic.eclecticTotal} ({eclectic.eclecticToPar! > 0 ? '+' : ''}
              {eclectic.eclecticToPar === 0 ? 'level' : eclectic.eclecticToPar})
            </span>
            . That score is in you.
          </>
        ) : (
          <>Eclectic so far covers {eclectic.holesCovered} of {eclectic.holes.length} holes — the total appears once every hole has been finished at least once.</>
        )}
      </p>

      {/* 18 columns never fit a phone: the table scrolls inside its own box, the page doesn't. */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="font-mono text-[11px] text-muted">
              <th className="sticky left-0 z-[1] min-w-[9rem] bg-card py-1 pr-2 text-left font-normal uppercase tracking-wide">Round</th>
              {eclectic.holes.map((h) => (
                <th key={h.holeNo} className="w-8 px-0.5 py-1 text-center font-normal">
                  {h.holeNo}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-normal uppercase tracking-wide">Tot</th>
            </tr>
            <tr className="border-b font-mono text-[11px] text-faint">
              <th className="sticky left-0 z-[1] bg-card py-0.5 pr-2 text-left font-normal uppercase tracking-wide">Par</th>
              {pars.map((p, i) => (
                <th key={i} className="px-0.5 py-0.5 text-center font-normal">
                  {p}
                </th>
              ))}
              <th className="px-2 py-0.5 text-right font-normal">{parTotal}</th>
            </tr>
          </thead>
          <tbody>
            {eclectic.rows.map((r) => (
              <tr key={r.roundId}>
                <td className="sticky left-0 z-[1] max-w-[11rem] bg-card py-0.5 pr-2">
                  <Link href={`/rounds/${r.roundId}/scorecard`} className="block truncate font-medium hover:underline" title={r.title}>
                    {r.title}
                  </Link>
                  <span className="block font-mono text-[10px] text-muted">{r.playedOn}</span>
                </td>
                <Cells scores={r.scores} pars={pars} />
                <td className="px-2 text-right font-mono text-xs">{r.total ?? <span className="text-faint">{r.holesPlayed}h</span>}</td>
              </tr>
            ))}
            <tr className="border-t">
              <td className="sticky left-0 z-[1] bg-card py-1 pr-2 font-semibold">Low score</td>
              <Cells scores={eclectic.low} pars={pars} strong />
              <td className="px-2 text-right font-mono text-xs font-medium">{eclectic.eclecticTotal ?? ''}</td>
            </tr>
            <tr>
              <td className="sticky left-0 z-[1] bg-card py-0.5 pr-2 font-semibold">High score</td>
              <Cells scores={eclectic.high} pars={pars} />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <ScoreLegend />
    </div>
  );
}
