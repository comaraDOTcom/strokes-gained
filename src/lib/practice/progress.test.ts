import { describe, expect, it } from 'vitest';
import { chronological, drillProgress, passTrend, practiceSummary, todayInIreland, type SessionRow } from './progress';

let nextId = 1;
function row(practisedOn: string, passed: boolean, o: Partial<SessionRow> = {}): SessionRow {
  return { id: nextId++, practisedOn, drillId: 'circle-putting', score: passed ? 17 : 12, outOf: 20, passMark: 16, passed, ...o };
}

describe('passTrend', () => {
  it('needs 4 sessions before it reads a trend', () => {
    expect(passTrend([row('2026-01-01', true), row('2026-01-02', false), row('2026-01-03', true)])).toBeNull();
  });

  it('compares the later half with the earlier half (worked example)', () => {
    // Earlier half: 1 of 3 passed; later half: 3 of 3. +67 points: up.
    const rows = ['01', '02', '03', '04', '05', '06'].map((d, i) => row(`2026-02-${d}`, i === 1 || i >= 3));
    expect(passTrend(rows)).toEqual({ direction: 'up', recentRate: 1, earlierRate: 1 / 3, recentSessions: 3, earlierSessions: 3 });
  });

  it('gives the odd session to the later half, and calls small moves steady', () => {
    // 5 sessions: earlier 2 (1 pass = 50%), later 3 (2 passes = 67%). +17 points < 20: steady.
    const rows = [true, false, true, false, true].map((p, i) => row(`2026-03-0${i + 1}`, p));
    expect(passTrend(rows)).toMatchObject({ direction: 'steady', earlierSessions: 2, recentSessions: 3 });
  });

  it('reads only the last 10 sessions', () => {
    const old = Array.from({ length: 10 }, (_, i) => row(`2025-01-${String(i + 1).padStart(2, '0')}`, true));
    const recent = Array.from({ length: 10 }, (_, i) => row(`2026-01-${String(i + 1).padStart(2, '0')}`, i < 5));
    expect(passTrend([...recent, ...old])).toMatchObject({ direction: 'down', earlierRate: 1, recentRate: 0 });
  });
});

describe('drillProgress', () => {
  it('sums each drill, oldest-first strip, most recently practised drill first', () => {
    const rows = [
      row('2026-04-03', false, { drillId: 'lag-putting', score: 5, outOf: 10, passMark: 7 }),
      row('2026-04-01', true),
      row('2026-04-02', false),
    ];
    const [lag, circle] = drillProgress(rows);
    expect(lag).toMatchObject({ drillId: 'lag-putting', sessions: 1, passes: 0, passRate: 0, trend: null });
    expect(circle).toMatchObject({ drillId: 'circle-putting', sessions: 2, passes: 1, passRate: 0.5, bestScore: 17 });
    expect(circle!.recent.map((r) => r.practisedOn)).toEqual(['2026-04-01', '2026-04-02']);
    expect(circle!.lastPractisedOn).toBe('2026-04-02');
  });

  it('orders two sessions on the same day by when they were logged', () => {
    const a = row('2026-05-01', false);
    const b = row('2026-05-01', true);
    expect(chronological([b, a]).map((r) => r.id)).toEqual([a.id, b.id]);
  });
});

describe('practiceSummary', () => {
  it('counts the last 30 days, today included', () => {
    const rows = [row('2026-08-27', false), row('2026-08-28', true), row('2026-09-26', true), row('2026-07-01', true)];
    expect(practiceSummary(rows, '2026-09-26')).toEqual({
      sessions: 2,
      passes: 2,
      passRate: 1,
      lastPractisedOn: '2026-09-26',
      days: 30,
    });
  });

  it('has no pass rate with no sessions in the window', () => {
    expect(practiceSummary([row('2026-01-01', true)], '2026-09-26')).toMatchObject({ sessions: 0, passRate: null, lastPractisedOn: '2026-01-01' });
    expect(practiceSummary([], '2026-09-26')).toMatchObject({ sessions: 0, passRate: null, lastPractisedOn: null });
  });
});

describe('todayInIreland', () => {
  it('uses Irish time, so a late-evening session lands on the right day', () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in Dublin (summer time).
    expect(todayInIreland(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01');
    expect(todayInIreland(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31');
  });
});
