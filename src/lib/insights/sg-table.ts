/**
 * The round-by-round strokes-gained table (rows = rounds, columns = SG categories, each cell a
 * small diverging bar around a shared zero line). Pure model; rendering is in
 * `src/app/insights/sg-round-table.tsx`.
 *
 * One bar SCALE is shared by every category column, so bar length is comparable across the
 * whole grid — "approach cost me more than putting gained" reads straight off it. Total gets
 * its own scale (it's the sum, so it would otherwise dwarf the rest).
 */
import type { Category } from '../sg/categorise';
import type { RoundSummary } from './aggregate';

export const SG_TABLE_COLUMNS: { key: Category; label: string; short: string }[] = [
  { key: 'OFF_THE_TEE', label: 'Off the tee', short: 'OTT' },
  { key: 'APPROACH', label: 'Approach', short: 'APP' },
  { key: 'SHORT_GAME', label: 'Short game', short: 'ARG' },
  { key: 'BUNKER', label: 'Bunker', short: 'BNK' },
  { key: 'PUTTING', label: 'Putting', short: 'PUTT' },
  { key: 'RECOVERY', label: 'Recovery', short: 'REC' },
];

export type SgTableRow = {
  roundId: number | null; // null = the average row
  title: string;
  subtitle: string;
  holesPlayed: number;
  score: { gross: number; toPar: number } | null;
  /** null = no shots in that category that round (shown as "—", not as a 0.00 bar). */
  cells: Record<Category, number | null>;
  total: number;
};

export type SgTable = {
  rows: SgTableRow[];
  /** Mean over FULL (18-hole) rounds only; null when there are fewer than 2 of them. */
  average: SgTableRow | null;
  categoryScale: number;
  totalScale: number;
};

const EPS = 1e-9;

export function buildSgTable(
  summaries: readonly RoundSummary[],
  namesById: ReadonlyMap<number, string | null> = new Map(),
): SgTable {
  const rows: SgTableRow[] = summaries.map((r) => ({
    roundId: r.roundId,
    title: namesById.get(r.roundId) ?? `${r.courseName} — ${r.teeName}`,
    subtitle: r.playedOn,
    holesPlayed: r.holesPlayed,
    score: { gross: r.grossScore, toPar: r.grossScore - r.par },
    cells: Object.fromEntries(
      SG_TABLE_COLUMNS.map(({ key }) => [key, Math.abs(r.sgByCategory[key] ?? 0) < EPS ? null : r.sgByCategory[key]]),
    ) as Record<Category, number | null>,
    total: r.sgTotal,
  }));

  const full = rows.filter((r) => r.holesPlayed === 18);
  const average: SgTableRow | null =
    full.length < 2
      ? null
      : {
          roundId: null,
          title: 'Average',
          subtitle: `${full.length} full rounds`,
          holesPlayed: 18,
          score: null,
          // A category with no shots in a round contributed 0 strokes gained that round.
          cells: Object.fromEntries(
            SG_TABLE_COLUMNS.map(({ key }) => [key, full.reduce((n, r) => n + (r.cells[key] ?? 0), 0) / full.length]),
          ) as Record<Category, number | null>,
          total: full.reduce((n, r) => n + r.total, 0) / full.length,
        };

  const all = average ? [...rows, average] : rows;
  const categoryScale = Math.max(1, ...all.flatMap((r) => SG_TABLE_COLUMNS.map(({ key }) => Math.abs(r.cells[key] ?? 0))));
  const totalScale = Math.max(1, ...all.map((r) => Math.abs(r.total)));
  return { rows, average, categoryScale, totalScale };
}

/** Bar length as a % of its half of the cell, clamped; tiny non-zero values still get a sliver. */
export function barPercent(value: number, scale: number): number {
  if (Math.abs(value) < EPS || scale <= 0) return 0;
  return Math.min(100, Math.max(3, (Math.abs(value) / scale) * 100));
}

/** The category that cost the most and the one that gained the most (or held up best) in a row. */
export function leakAndStrength(row: SgTableRow): { leak: Category | null; strength: Category | null } {
  const vals = SG_TABLE_COLUMNS.map(({ key }) => ({ key, v: row.cells[key] })).filter(
    (c): c is { key: Category; v: number } => c.v !== null,
  );
  if (vals.length === 0) return { leak: null, strength: null };
  const sorted = [...vals].sort((a, b) => a.v - b.v);
  const leak = sorted[0]!.v < 0 ? sorted[0]!.key : null;
  const best = sorted[sorted.length - 1]!;
  return { leak, strength: best.key !== leak ? best.key : null };
}
