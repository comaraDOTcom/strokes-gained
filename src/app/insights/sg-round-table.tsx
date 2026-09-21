import Link from 'next/link';
import { SG_TABLE_COLUMNS, barPercent, type SgTable, type SgTableRow } from '@/lib/insights/sg-table';
import { fmtSg } from '@/lib/insights/chart-colors';

/**
 * One diverging bar around a centre line: strokes gained grow right in green, strokes lost grow
 * left in terracotta, with the number on the opposite side so it never sits on the bar.
 */
function SgBar({ value, scale, strong = false }: { value: number | null; scale: number; strong?: boolean }) {
  if (value === null) return <div className="text-center font-mono text-xs text-faint">—</div>;
  const pct = barPercent(value, scale);
  const pos = value >= 0;
  const num = (
    <span className={`font-mono text-xs tabular-nums ${strong ? 'font-medium text-ink' : 'text-ink-2'}`}>{fmtSg(value)}</span>
  );
  return (
    <div className="flex items-center" title={fmtSg(value)}>
      <div className="flex w-1/2 items-center justify-end pr-1">
        {pos ? num : <div className={`h-3 rounded-l-sm ${strong ? 'bg-neg' : 'bg-neg/70'}`} style={{ width: `${pct}%` }} />}
      </div>
      <div className="flex w-1/2 items-center border-l border-line-strong pl-1">
        {pos ? <div className={`h-3 rounded-r-sm ${strong ? 'bg-pos' : 'bg-pos/70'}`} style={{ width: `${pct}%` }} /> : num}
      </div>
    </div>
  );
}

function RowTitle({ row }: { row: SgTableRow }) {
  const partial = row.roundId !== null && row.holesPlayed < 18;
  return (
    <>
      {row.roundId === null ? (
        <span className="font-semibold">{row.title}</span>
      ) : (
        <Link href={`/rounds/${row.roundId}`} className="font-medium hover:underline line-clamp-2">
          {row.title}
        </Link>
      )}
      <span className="block font-mono text-xs text-muted">
        {row.subtitle}
        {partial && ` · ${row.holesPlayed} holes`}
      </span>
    </>
  );
}

const scoreText = (row: SgTableRow) =>
  row.score ? `${row.score.gross} (${row.score.toPar >= 0 ? '+' : ''}${row.score.toPar})` : '';

export function SgRoundTable({ table }: { table: SgTable }) {
  const rows = table.average ? [table.average, ...table.rows] : table.rows;

  return (
    <>
      {/* lg and up: the full grid (it needs ~60rem to breathe) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full min-w-[58rem] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b text-left font-mono text-[11px] uppercase tracking-wide text-muted">
              <th className="w-56 py-1.5 pr-2 font-normal">Round</th>
              <th className="w-20 py-1.5 pr-2 font-normal">Score</th>
              {SG_TABLE_COLUMNS.map((c) => (
                <th key={c.key} className="py-1.5 text-center font-normal" title={c.label}>
                  {c.short}
                </th>
              ))}
              <th className="w-32 bg-paper-2 py-1.5 text-center font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.roundId ?? 'avg'} className={`border-b last:border-0 ${row.roundId === null ? 'bg-accent-soft/40' : ''}`}>
                <td className="py-2 pr-3 align-middle">
                  <RowTitle row={row} />
                </td>
                <td className="whitespace-nowrap py-2 pr-2 font-mono text-xs text-ink-2">{scoreText(row)}</td>
                {SG_TABLE_COLUMNS.map((c) => (
                  <td key={c.key} className="px-1 py-2 align-middle">
                    <SgBar value={row.cells[c.key]} scale={table.categoryScale} />
                  </td>
                ))}
                <td className="bg-paper-2 px-2 py-2 align-middle">
                  <SgBar value={row.total} scale={table.totalScale} strong />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* below lg: one card per round, categories stacked (no sideways scrolling) */}
      <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <li key={row.roundId ?? 'avg'} className={`rounded-lg border p-3 ${row.roundId === null ? 'bg-accent-soft/40' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm">
                <RowTitle row={row} />
              </div>
              <span className="shrink-0 font-mono text-xs text-ink-2">{scoreText(row)}</span>
            </div>
            <dl className="mt-2 space-y-1">
              {SG_TABLE_COLUMNS.map((c) => (
                <div key={c.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
                  <dt className="text-xs text-muted">{c.label}</dt>
                  <dd>
                    <SgBar value={row.cells[c.key]} scale={table.categoryScale} />
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 border-t pt-1">
                <dt className="text-xs font-medium">Total</dt>
                <dd>
                  <SgBar value={row.total} scale={table.totalScale} strong />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
