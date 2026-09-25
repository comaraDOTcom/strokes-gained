/**
 * Shot quality: strokes gained per shot, rescaled so 100 is a scratch golfer's
 * average shot.
 *
 *     quality = 100 + QUALITY_PER_SG_SHOT × (Σ sg / number of logged shots)
 *
 * - PER SHOT, not per 18: it describes how well you hit each kind of shot,
 *   not how often you hit it. A 9-hole round needs no scaling.
 * - The denominator is SHOT ROWS, not strokes. A penalty is already charged to
 *   the SG of the shot that caused it (see `computeHole`), so an OB drive is
 *   one shot worth about −2 SG. Every other per-shot number in the app
 *   (`RecapArea.perShot`, band `sgPerShot`) divides the same way.
 * - No clamping: a one-shot pool can read −110. Instead every stat carries its
 *   shot count and a `thin` flag, and the UI fades thin numbers.
 * - Derived at read time: it's a rescaled mean of the stored `shots.sg`, and
 *   k is a display convention, so storing it would only create a second source
 *   of truth.
 */
import type { Category } from '../sg/categorise';
import { categorySeries, type EnrichedShot } from './aggregate';
import { SG_TABLE_COLUMNS } from './sg-table';

/**
 * k. 100 reproduces Clippd's own worked example exactly: a 68 with +4 SG over
 * 68 shots is 4/68 = +0.059 a shot → 105.9 → 106. So one quality point is a
 * hundredth of a stroke gained per shot.
 */
export const QUALITY_PER_SG_SHOT = 100;
export const SCRATCH_QUALITY = 100;
/** Below this many shots a number is shown faded, never headlined (the same floor `classifySignalStrength` uses for "signal"). */
export const MIN_SHOTS_FOR_QUALITY = 10;
/** Rolling window for the trend: rounds, pooled by shots. Matches the 5-round line on /scoring. */
export const DEFAULT_TREND_WINDOW_ROUNDS = 5;

export type QualityStat = {
  /** Unrounded. */
  quality: number;
  shots: number;
  sg: number;
  thin: boolean;
};

export type CategoryQuality = QualityStat & { category: Category; label: string; short: string };

export type RoundQuality = {
  /** Null when there are no shots. */
  overall: QualityStat | null;
  /** SG_TABLE_COLUMNS order; only categories with at least one shot. */
  byCategory: CategoryQuality[];
};

function fromTotals(sg: number, shots: number): QualityStat | null {
  if (shots <= 0) return null;
  return { quality: SCRATCH_QUALITY + (QUALITY_PER_SG_SHOT * sg) / shots, shots, sg, thin: shots < MIN_SHOTS_FOR_QUALITY };
}

export function qualityStat(shots: readonly Pick<EnrichedShot, 'sg'>[]): QualityStat | null {
  return fromTotals(
    shots.reduce((a, s) => a + s.sg, 0),
    shots.length,
  );
}

/** 100 + k × mean SG per shot; null for an empty list. The one formula everything else uses. */
export function shotQuality(shots: readonly Pick<EnrichedShot, 'sg'>[]): number | null {
  return qualityStat(shots)?.quality ?? null;
}

export function qualityByCategory(shots: readonly EnrichedShot[]): CategoryQuality[] {
  const out: CategoryQuality[] = [];
  for (const col of SG_TABLE_COLUMNS) {
    const stat = qualityStat(shots.filter((s) => s.category === col.key));
    if (stat) out.push({ ...stat, category: col.key, label: col.label, short: col.short });
  }
  return out;
}

/** Works for any pool of shots: one round, or every round at a course. */
export function roundQuality(shots: readonly EnrichedShot[]): RoundQuality {
  return { overall: qualityStat(shots), byCategory: qualityByCategory(shots) };
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export type QualityTrendPoint = {
  roundId: number;
  playedOn: string;
  /** This round alone. */
  round: QualityStat;
  /** Pooled over this round and up to windowRounds − 1 earlier points. */
  rolling: QualityStat;
};

export type QualityTrend = {
  category: Category | 'ALL';
  label: string;
  /** Chronological. A point exists only for a round with at least one shot in the category. */
  points: QualityTrendPoint[];
  /** The last rolling value. */
  latest: QualityStat | null;
  windowRounds: number;
  /** The cut-off actually applied; null = all rounds. */
  since: string | null;
};

type Point = { roundId: number; playedOn: string; sg: number; shotCount: number };

function seriesFor(shots: readonly EnrichedShot[], category: Category | 'ALL'): Point[] {
  const points = categorySeries([...shots]);
  if (category !== 'ALL') return points.filter((p) => p.category === category);
  // ALL: sum the category points per round, keeping categorySeries' chronological order.
  const byRound = new Map<number, Point>();
  for (const p of points) {
    const e = byRound.get(p.roundId) ?? { roundId: p.roundId, playedOn: p.playedOn, sg: 0, shotCount: 0 };
    e.sg += p.sg;
    e.shotCount += p.shotCount;
    byRound.set(p.roundId, e);
  }
  return [...byRound.values()];
}

/**
 * Rolling shot quality for one category (or ALL). The window runs over the
 * category's own points, so for bunker it's the last 5 rounds that had a
 * bunker shot. Pooled by shots (Σ sg / Σ shots), NOT averaged per round:
 * a round with one bunker shot mustn't count as much as one with six.
 *
 * Rolling values are computed over the full history first, then points before
 * `since` are dropped, so the first kept point still has a full window. If
 * fewer than 2 points would survive, every point is kept and `since` is null.
 */
export function qualityTrend(
  shots: readonly EnrichedShot[],
  opts: { category: Category | 'ALL'; windowRounds?: number; since?: string | null },
): QualityTrend {
  const windowRounds = opts.windowRounds ?? DEFAULT_TREND_WINDOW_ROUNDS;
  const series = seriesFor(shots, opts.category);
  const all: QualityTrendPoint[] = series.map((p, i) => {
    const window = series.slice(Math.max(0, i - windowRounds + 1), i + 1);
    return {
      roundId: p.roundId,
      playedOn: p.playedOn,
      round: fromTotals(p.sg, p.shotCount)!,
      rolling: fromTotals(
        window.reduce((a, w) => a + w.sg, 0),
        window.reduce((a, w) => a + w.shotCount, 0),
      )!,
    };
  });

  let points = all;
  let since = opts.since ?? null;
  if (since !== null) {
    const kept = all.filter((p) => p.playedOn >= since!);
    if (kept.length >= 2) points = kept;
    else since = null;
  }

  const label =
    opts.category === 'ALL' ? 'All shots' : (SG_TABLE_COLUMNS.find((c) => c.key === opts.category)?.label ?? opts.category);
  return {
    category: opts.category,
    label,
    points,
    latest: points.length > 0 ? points[points.length - 1]!.rolling : null,
    windowRounds,
    since,
  };
}

/** ALL first, then every category that has shots, in SG_TABLE_COLUMNS order. */
export function qualityTrends(
  shots: readonly EnrichedShot[],
  opts: { windowRounds?: number; since?: string | null } = {},
): QualityTrend[] {
  const present = new Set(shots.map((s) => s.category));
  const cats: (Category | 'ALL')[] = ['ALL', ...SG_TABLE_COLUMNS.map((c) => c.key).filter((k) => present.has(k))];
  return shots.length === 0 ? [] : cats.map((category) => qualityTrend(shots, { ...opts, category }));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatQuality(q: number | null | undefined): string {
  if (q === null || q === undefined || !Number.isFinite(q)) return '—';
  const r = Math.round(q);
  return String(Object.is(r, -0) ? 0 : r);
}

/** Coloured by the ROUNDED value, so a displayed 100 is never green or red. */
export function qualityTone(q: number): 'pos' | 'neg' | 'neutral' {
  const r = Math.round(q);
  if (r > SCRATCH_QUALITY) return 'pos';
  if (r < SCRATCH_QUALITY) return 'neg';
  return 'neutral';
}

/** A y-axis for quality charts: steps of 5 (10 for a range over 30), always including 100, with a little padding. */
export function qualityAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(SCRATCH_QUALITY, ...finite) - 2;
  const hi = Math.max(SCRATCH_QUALITY, ...finite) + 2;
  const step = hi - lo > 30 ? 10 : 5;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { domain: [min, max], ticks };
}

/** The ISO date `days` before an ISO date, in UTC (same convention as calendar.ts). */
export function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
