/**
 * Practice-log read-outs for `/practice` and `/trends` (issue #55): pass rate per drill, the recent
 * results strip, and whether the pass rate is moving. Pure; the rows come from `sessions.ts`.
 */
import { isoDaysBefore } from '../insights/quality';

export type SessionRow = {
  id: number;
  practisedOn: string; // YYYY-MM-DD
  drillId: string;
  score: number;
  outOf: number;
  passMark: number;
  passed: boolean;
};

/** How many recent sessions the strip shows and the trend reads. */
export const RECENT_SESSIONS = 10;
/** Fewer sessions than this on a drill: no trend, just "early days". */
export const MIN_SESSIONS_FOR_TREND = 4;
/** A change in pass rate smaller than this reads as steady. */
export const PASS_RATE_STEADY = 0.2;

export type PassTrend = {
  direction: 'up' | 'down' | 'steady';
  recentRate: number;
  earlierRate: number;
  recentSessions: number;
  earlierSessions: number;
};

export type DrillProgress = {
  drillId: string;
  sessions: number;
  passes: number;
  passRate: number;
  bestScore: number;
  lastPractisedOn: string;
  /** Up to RECENT_SESSIONS, oldest first, for the strip. */
  recent: SessionRow[];
  /** Null under MIN_SESSIONS_FOR_TREND sessions. */
  trend: PassTrend | null;
};

/** Oldest first: by date, then by the order they were logged. */
export function chronological(rows: readonly SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) => a.practisedOn.localeCompare(b.practisedOn) || a.id - b.id);
}

const rate = (rows: readonly SessionRow[]) => rows.filter((r) => r.passed).length / rows.length;

/** The later half of the last RECENT_SESSIONS sessions against the earlier half. */
export function passTrend(rows: readonly SessionRow[]): PassTrend | null {
  const last = chronological(rows).slice(-RECENT_SESSIONS);
  if (last.length < MIN_SESSIONS_FOR_TREND) return null;
  const recentCount = Math.ceil(last.length / 2);
  const recent = last.slice(-recentCount);
  const earlier = last.slice(0, last.length - recentCount);
  const recentRate = rate(recent);
  const earlierRate = rate(earlier);
  const delta = recentRate - earlierRate;
  return {
    direction: Math.abs(delta) < PASS_RATE_STEADY - 1e-9 ? 'steady' : delta > 0 ? 'up' : 'down',
    recentRate,
    earlierRate,
    recentSessions: recent.length,
    earlierSessions: earlier.length,
  };
}

/** Progress per drill, most recently practised first. */
export function drillProgress(rows: readonly SessionRow[]): DrillProgress[] {
  const byDrill = new Map<string, SessionRow[]>();
  for (const r of chronological(rows)) (byDrill.get(r.drillId) ?? byDrill.set(r.drillId, []).get(r.drillId)!).push(r);
  return [...byDrill.entries()]
    .map(([drillId, list]) => ({
      drillId,
      sessions: list.length,
      passes: list.filter((r) => r.passed).length,
      passRate: rate(list),
      bestScore: Math.max(...list.map((r) => r.score)),
      lastPractisedOn: list[list.length - 1]!.practisedOn,
      recent: list.slice(-RECENT_SESSIONS),
      trend: passTrend(list),
    }))
    .sort((a, b) => b.lastPractisedOn.localeCompare(a.lastPractisedOn) || a.drillId.localeCompare(b.drillId));
}

export type PracticeSummary = {
  /** Sessions in the last `days` days, today included. */
  sessions: number;
  passes: number;
  /** Null when there were none. */
  passRate: number | null;
  lastPractisedOn: string | null;
  days: number;
};

/** A one-line read-out for `/trends`: sessions and pass rate over the last `days` days. */
export function practiceSummary(rows: readonly SessionRow[], today: string, days = 30): PracticeSummary {
  const since = isoDaysBefore(today, days - 1);
  const inWindow = rows.filter((r) => r.practisedOn >= since && r.practisedOn <= today);
  const last = chronological(rows).at(-1);
  return {
    sessions: inWindow.length,
    passes: inWindow.filter((r) => r.passed).length,
    passRate: inWindow.length > 0 ? rate(inWindow) : null,
    lastPractisedOn: last?.practisedOn ?? null,
    days,
  };
}

/** Today's date in Ireland (the app's players are there), as YYYY-MM-DD. */
export function todayInIreland(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' }).format(now);
}
