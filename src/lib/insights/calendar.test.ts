import { describe, it, expect } from 'vitest';
import { buildPlayCalendar, monthLabels, type CalendarRound } from './calendar';

const round = (roundId: number, playedOn: string, courseId = 1, courseName = 'Elm Park'): CalendarRound => ({
  roundId, playedOn, courseId, courseName, grossScore: 79, par: 69, holesPlayed: 18,
});

describe('buildPlayCalendar', () => {
  // 2026-09-22 is a Tuesday.
  const today = '2026-09-22';

  it('covers the window and squares off whole Monday→Sunday weeks', () => {
    const c = buildPlayCalendar([], today, 90);
    expect(c.start).toBe('2026-06-25');
    expect(c.weeks[0]![0]!.date).toBe('2026-06-22'); // the Monday on/before the start
    expect(c.weeks.at(-1)!.at(-1)!.date).toBe('2026-09-27'); // the Sunday on/after today
    expect(c.weeks.every((w) => w.length === 7)).toBe(true);
    expect(c.weeks[0]![0]!.inRange).toBe(false); // padding, not part of the 90 days
    expect(c.weeks[0]![3]!).toMatchObject({ date: '2026-06-25', inRange: true });
  });

  it('puts each round on its day and counts days, rounds and courses', () => {
    const c = buildPlayCalendar(
      [round(1, '2026-09-20'), round(2, '2026-09-20', 2, 'Portmarnock'), round(3, '2026-09-13'), round(4, '2026-03-01')],
      today,
    );
    const day = c.weeks.flat().find((d) => d.date === '2026-09-20')!;
    expect(day.rounds.map((r) => r.roundId)).toEqual([1, 2]);
    expect(c.roundsPlayed).toBe(3); // the March round is outside the window
    expect(c.daysPlayed).toBe(2);
    expect(c.courses).toEqual([
      { courseId: 1, courseName: 'Elm Park', rounds: 2 },
      { courseId: 2, courseName: 'Portmarnock', rounds: 1 },
    ]);
  });

  it('measures the gap since the last round and the longest gap between rounds', () => {
    const c = buildPlayCalendar([round(1, '2026-09-13'), round(2, '2026-09-20'), round(3, '2026-07-01')], today);
    expect(c.daysSinceLast).toBe(2); // 20th → 22nd
    expect(c.longestGapDays).toBe(73); // 1 Jul → 13 Sep, days with no golf between
  });

  it('has no gaps to report when nothing was played', () => {
    const c = buildPlayCalendar([], today);
    expect(c).toMatchObject({ roundsPlayed: 0, daysPlayed: 0, daysSinceLast: null, longestGapDays: null, courses: [] });
  });

  it('counts a round played today as 0 days ago', () => {
    expect(buildPlayCalendar([round(1, today)], today).daysSinceLast).toBe(0);
  });
});

describe('monthLabels', () => {
  it('labels only the first column of each month', () => {
    const labels = monthLabels(buildPlayCalendar([], '2026-09-22', 90).weeks);
    expect(labels[0]).toBe('Jun');
    expect(labels.filter(Boolean)).toEqual(['Jun', 'Jul', 'Aug', 'Sep']);
  });
});
