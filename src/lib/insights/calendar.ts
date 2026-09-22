/**
 * "When did I actually play?" — a GitHub-style calendar of rounds over a window of days, one
 * square per day, grouped into Monday→Sunday columns. Pure: dates are ISO `YYYY-MM-DD` strings
 * and all arithmetic is in UTC, so a summer-time boundary can never shift a square.
 */

export type CalendarRound = {
  roundId: number;
  playedOn: string;
  courseId: number;
  courseName: string;
  grossScore: number;
  par: number;
  holesPlayed: number;
};

export type CalendarDay = {
  date: string;
  /** False for the days either side that only exist to square off the first and last week. */
  inRange: boolean;
  rounds: CalendarRound[];
};

export type PlayCalendar = {
  start: string;
  end: string;
  /** Columns, oldest first; each is 7 days, Monday first. */
  weeks: CalendarDay[][];
  roundsPlayed: number;
  daysPlayed: number;
  /** Days since the last round, counting today as 0. Null when nothing was played in the window. */
  daysSinceLast: number | null;
  /** Longest run of days with no golf between two rounds in the window. Null with fewer than 2. */
  longestGapDays: number | null;
  /** Courses played in the window, most rounds first — the legend, and the colour order. */
  courses: { courseId: number; courseName: string; rounds: number }[];
};

const MS = 86_400_000;
const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Monday = 0 … Sunday = 6. */
const weekday = (ms: number) => (new Date(ms).getUTCDay() + 6) % 7;

export function buildPlayCalendar(rounds: readonly CalendarRound[], today: string, days = 90): PlayCalendar {
  const endMs = toUtc(today);
  const startMs = endMs - (days - 1) * MS;

  const byDate = new Map<string, CalendarRound[]>();
  for (const r of rounds) {
    const ms = toUtc(r.playedOn);
    if (ms < startMs || ms > endMs) continue;
    (byDate.get(r.playedOn) ?? byDate.set(r.playedOn, []).get(r.playedOn)!).push(r);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.roundId - b.roundId);

  // Square off both ends so every column is a full Monday→Sunday week.
  const gridStart = startMs - weekday(startMs) * MS;
  const gridEnd = endMs + (6 - weekday(endMs)) * MS;
  const weeks: CalendarDay[][] = [];
  for (let ms = gridStart; ms <= gridEnd; ms += 7 * MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = toIso(ms + i * MS);
        const d = ms + i * MS;
        return { date, inRange: d >= startMs && d <= endMs, rounds: d >= startMs && d <= endMs ? byDate.get(date) ?? [] : [] };
      }),
    );
  }

  const playedDates = [...byDate.keys()].sort();
  const counts = new Map<number, { courseId: number; courseName: string; rounds: number }>();
  for (const list of byDate.values()) {
    for (const r of list) {
      const c = counts.get(r.courseId) ?? { courseId: r.courseId, courseName: r.courseName, rounds: 0 };
      c.rounds += 1;
      counts.set(r.courseId, c);
    }
  }

  let longestGapDays: number | null = null;
  for (let i = 1; i < playedDates.length; i++) {
    const gap = (toUtc(playedDates[i]!) - toUtc(playedDates[i - 1]!)) / MS - 1;
    longestGapDays = longestGapDays === null ? gap : Math.max(longestGapDays, gap);
  }

  return {
    start: toIso(startMs),
    end: today,
    weeks,
    roundsPlayed: [...byDate.values()].reduce((a, l) => a + l.length, 0),
    daysPlayed: playedDates.length,
    daysSinceLast: playedDates.length ? (endMs - toUtc(playedDates[playedDates.length - 1]!)) / MS : null,
    longestGapDays,
    courses: [...counts.values()].sort((a, b) => b.rounds - a.rounds || a.courseName.localeCompare(b.courseName)),
  };
}

/** Month labels for the columns: the month name above the first week that starts a new month. */
export function monthLabels(weeks: readonly CalendarDay[][]): (string | null)[] {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let last = '';
  return weeks.map((w) => {
    const month = w[0]!.date.slice(0, 7);
    if (month === last) return null;
    last = month;
    return MONTHS[Number(month.slice(5, 7)) - 1]!;
  });
}
