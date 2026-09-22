import Link from 'next/link';
import { SG_TABLE_COLUMNS, barPercent, leakAndStrength, type SgTable, type SgTableRow } from '@/lib/insights/sg-table';
import { fmtSg } from '@/lib/insights/chart-colors';
import type { Category } from '@/lib/sg/categorise';

/** One decimal on screen; the exact two-decimal value on hover. */
function Sg({ value, className = '' }: { value: number; className?: string }) {
  const text = fmtSg(value, 1);
  const shown = Number(text); // colour by what's shown, so a "0.0" is never green or red
  return (
    <span title={fmtSg(value)} className={`font-mono tabular-nums ${shown < 0 ? 'text-neg' : shown > 0 ? 'text-pos' : 'text-muted'} ${className}`}>
      {text}
    </span>
  );
}

/** A diverging bar around a centre line: gained grows right in green, lost grows left in terracotta. */
function Diverging({ value, scale, height = 'h-3', strong = false }: { value: number; scale: number; height?: string; strong?: boolean }) {
  const pct = barPercent(value, scale);
  const pos = value >= 0;
  return (
    <div className="flex items-center" title={fmtSg(value)}>
      <div className="flex w-1/2 justify-end">
        {!pos && <div className={`${height} rounded-l-sm ${strong ? 'bg-neg' : 'bg-neg/70'}`} style={{ width: `${pct}%` }} />}
      </div>
      <div className="flex w-1/2 border-l border-line-strong">
        {pos && <div className={`${height} rounded-r-sm ${strong ? 'bg-pos' : 'bg-pos/70'}`} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

const LABEL = Object.fromEntries(SG_TABLE_COLUMNS.map((c) => [c.key, c.label])) as Record<Category, string>;

/**
 * The headline: where the strokes go on a typical round here (the average of full rounds, or the
 * only round there is). One row per discipline, big and spaced out, so this reads first.
 */
function Overview({ row, heading }: { row: SgTableRow; heading: string }) {
  const { leak, strength } = leakAndStrength(row);
  const scale = Math.max(1, ...SG_TABLE_COLUMNS.map(({ key }) => Math.abs(row.cells[key] ?? 0)));
  return (
    <div className="space-y-4 rounded-lg border bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{heading}</p>
          <p className="text-sm text-ink-2">
            {leak ? (
              <>
                Biggest leak: <span className="font-medium text-ink">{LABEL[leak]}</span>
              </>
            ) : (
              'No category lost strokes'
            )}
            {strength && (
              <>
                {' · '}
                {(row.cells[strength] ?? 0) >= 0 ? 'Best' : 'Holding up best'}:{' '}
                <span className="font-medium text-ink">{LABEL[strength]}</span>
              </>
            )}
          </p>
        </div>
        <p className="text-right">
          <Sg value={row.total} className="text-3xl font-medium" />
          <span className="block font-mono text-[11px] uppercase tracking-wide text-muted">total vs scratch</span>
        </p>
      </div>
      <ul className="space-y-3">
        {SG_TABLE_COLUMNS.map(({ key, label }) => {
          const v = row.cells[key];
          return (
            <li key={key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
              <span className={key === leak ? 'font-semibold' : 'text-ink-2'}>{label}</span>
              {v === null ? <span className="text-center font-mono text-xs text-faint">no shots</span> : <Diverging value={v} scale={scale} height="h-4" />}
              <span className="text-right">{v === null ? <span className="font-mono text-faint">—</span> : <Sg value={v} />}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RowTitle({ row }: { row: SgTableRow }) {
  const partial = row.holesPlayed < 18;
  return (
    <>
      <Link href={`/rounds/${row.roundId}`} className="line-clamp-1 font-medium hover:underline" title={row.title}>
        {row.title}
      </Link>
      <span className="block font-mono text-xs text-muted">
        {row.subtitle}
        {row.score && ` · ${row.score.gross} (${row.score.toPar >= 0 ? '+' : ''}${row.score.toPar})`}
        {partial && ` · ${row.holesPlayed} holes`}
      </span>
    </>
  );
}

/** A per-round cell: the number first, a slim bar under it — so neighbouring numbers never collide. */
function Cell({ value, scale, strong = false }: { value: number | null; scale: number; strong?: boolean }) {
  if (value === null) return <div className="text-center font-mono text-xs text-faint">—</div>;
  return (
    <div className="space-y-1">
      <div className="text-center text-sm">
        <Sg value={value} className={strong ? 'font-semibold' : ''} />
      </div>
      <Diverging value={value} scale={scale} height="h-1.5" strong={strong} />
    </div>
  );
}

export function SgRoundTable({ table }: { table: SgTable }) {
  // The average of full rounds when there are 2+; otherwise the one full round (or the only round).
  const full = table.rows.filter((r) => r.holesPlayed === 18);
  const single = full.length === 1 ? full[0]! : table.rows.length === 1 ? table.rows[0]! : null;
  const headline = table.average ?? single;
  const heading = table.average
    ? `Average round · ${table.average.subtitle}`
    : single
      ? `${table.rows.length === 1 ? 'Your round' : 'Your full round'} · ${single.subtitle}`
      : '';

  return (
    <div className="space-y-6">
      {headline && <Overview row={headline} heading={heading} />}

      {table.rows.length > 1 && (
        <div className="space-y-2">
          <h3 className="font-semibold">Round by round</h3>

          {/* lg and up: rounds × disciplines */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[58rem] table-fixed border-collapse text-sm">
              <thead>
                <tr className="border-b text-left font-mono text-[11px] uppercase tracking-wide text-muted">
                  <th className="w-60 py-2 pr-4 font-normal">Round</th>
                  {SG_TABLE_COLUMNS.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-center font-normal" title={c.label}>
                      {c.short}
                    </th>
                  ))}
                  <th className="w-28 px-3 py-2 text-center font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.roundId} className="border-b last:border-0">
                    <td className="py-3 pr-4 align-middle">
                      <RowTitle row={row} />
                    </td>
                    {SG_TABLE_COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3 align-middle">
                        <Cell value={row.cells[c.key]} scale={table.categoryScale} />
                      </td>
                    ))}
                    <td className="border-l px-3 py-3 align-middle">
                      <Cell value={row.total} scale={table.totalScale} strong />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* below lg: one card per round, disciplines stacked (no sideways scrolling) */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {table.rows.map((row) => (
              <li key={row.roundId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-sm">
                    <RowTitle row={row} />
                  </div>
                  <Sg value={row.total} className="shrink-0 text-lg font-semibold" />
                </div>
                <dl className="mt-3 space-y-2">
                  {SG_TABLE_COLUMNS.map((c) => {
                    const v = row.cells[c.key];
                    return (
                      <div key={c.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] items-center gap-2">
                        <dt className="text-xs text-muted">{c.label}</dt>
                        <dd>{v === null ? null : <Diverging value={v} scale={table.categoryScale} />}</dd>
                        <dd className="text-right text-xs">{v === null ? <span className="font-mono text-faint">—</span> : <Sg value={v} />}</dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
