import Link from 'next/link';
import { monthLabels, type PlayCalendar } from '@/lib/insights/calendar';
import { CATEGORICAL } from '@/lib/insights/chart-colors';

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const toPar = (v: number) => (v === 0 ? 'E' : `${v > 0 ? '+' : '−'}${Math.abs(v)}`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * A square per day over the window, coloured by course — where the golf actually happened, and
 * how long the gaps were. Days with a round link to it; a day with two rounds gets a corner mark.
 */
export function PlayCalendarGrid({ calendar, days }: { calendar: PlayCalendar; days: number }) {
  const colour = new Map(calendar.courses.map((c, i) => [c.courseId, CATEGORICAL[i % CATEGORICAL.length]!]));
  const months = monthLabels(calendar.weeks);
  const stats: [string, string][] = [
    ['Rounds', `${calendar.roundsPlayed}`],
    ['Days played', `${calendar.daysPlayed} of ${days}`],
    ['Last round', calendar.daysSinceLast === null ? '—' : calendar.daysSinceLast === 0 ? 'today' : `${plural(calendar.daysSinceLast, 'day')} ago`],
    ['Longest gap', calendar.longestGapDays === null ? '—' : plural(calendar.longestGapDays, 'day')],
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-paper px-3 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">{k}</dt>
            <dd className="font-mono text-lg font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {/* 13 columns of squares fit a phone; the box scrolls if a longer window is ever passed. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          <div className="mr-1 flex w-7 shrink-0 flex-col gap-[3px] pt-4">
            {DAY_LABELS.map((d, i) => (
              <span key={i} className="h-[14px] font-mono text-[9px] leading-[14px] text-muted">
                {d}
              </span>
            ))}
          </div>
          {calendar.weeks.map((week, w) => (
            <div key={week[0]!.date} className="flex flex-col gap-[3px]">
              <span className="h-4 font-mono text-[9px] text-muted">{months[w]}</span>
              {week.map((day) => {
                const r = day.rounds[0];
                const label = r
                  ? `${day.date}: ${day.rounds
                      .map((x) => `${x.courseName} ${x.grossScore} (${toPar(x.grossScore - x.par)})${x.holesPlayed < 18 ? ` · ${x.holesPlayed} holes` : ''}`)
                      .join(', ')}`
                  : day.date;
                const box = (
                  <span
                    title={label}
                    className={`relative block h-[14px] w-[14px] rounded-[3px] ${
                      !day.inRange ? 'bg-transparent' : r ? '' : 'bg-line/60'
                    }`}
                    style={r ? { backgroundColor: colour.get(r.courseId) } : undefined}
                  >
                    {day.rounds.length > 1 && <span className="absolute right-0 top-0 h-1 w-1 rounded-full bg-paper" />}
                  </span>
                );
                return r ? (
                  <Link key={day.date} href={`/rounds/${r.roundId}`} aria-label={label}>
                    {box}
                  </Link>
                ) : (
                  <span key={day.date}>{box}</span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {calendar.courses.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {calendar.courses.map((c) => (
            <li key={c.courseId} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: colour.get(c.courseId) }} />
              {c.courseName} <span className="font-mono text-muted">{c.rounds}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No rounds in the last {days} days.</p>
      )}
    </div>
  );
}
