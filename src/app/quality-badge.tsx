/**
 * Shot quality in a hexagon: 100 = a scratch golfer's average shot. No hooks, so it renders from
 * server pages (the rounds list, Insights) and the client recap deck alike.
 */
import { formatQuality, qualityTone, type QualityStat } from '@/lib/insights/quality';
import { fmtSg } from '@/lib/insights/chart-colors';

const STROKE = { pos: 'stroke-pos', neg: 'stroke-neg', neutral: 'stroke-line-strong' } as const;

export function qualityTitle(stat: QualityStat): string {
  const perShot = stat.sg / stat.shots;
  return `Shot quality ${formatQuality(stat.quality)} · ${fmtSg(perShot)} strokes gained per shot over ${stat.shots} shot${
    stat.shots === 1 ? '' : 's'
  } · 100 = scratch`;
}

export function QualityBadge({ stat, size = 'sm' }: { stat: QualityStat | null; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  const tone = stat ? qualityTone(stat.quality) : 'neutral';
  return (
    <span
      className={`inline-flex shrink-0 flex-col items-center ${stat?.thin ? 'opacity-60' : ''}`}
      title={stat ? qualityTitle(stat) : 'Shot quality: no shots yet'}
    >
      <span className={`relative inline-flex items-center justify-center ${lg ? 'h-[88px] w-[88px]' : 'h-11 w-11'}`}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <polygon
            points="50,3 93,26 93,74 50,97 7,74 7,26"
            className={`fill-card ${STROKE[tone]}`}
            strokeWidth={lg ? 5 : 7}
            strokeLinejoin="round"
          />
        </svg>
        <span className={`relative font-mono font-medium tabular-nums text-ink ${lg ? 'text-3xl' : 'text-sm'}`}>
          {formatQuality(stat?.quality)}
        </span>
      </span>
      {lg && <span className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted">shot quality</span>}
    </span>
  );
}
