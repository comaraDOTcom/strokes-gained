import { QualityTrendChart, type QualityTrendDatum } from '../insights/charts';
import {
  MIN_SHOTS_FOR_QUALITY,
  formatQuality,
  qualityAxis,
  qualityTone,
  type QualityTrend,
} from '@/lib/insights/quality';

const TONE_CLASS = { pos: 'text-pos', neg: 'text-neg', neutral: 'text-ink' } as const;

function toData(t: QualityTrend): QualityTrendDatum[] {
  return t.points.map((p) => ({
    playedOn: p.playedOn,
    round: Math.round(p.round.quality * 10) / 10,
    roundShots: p.round.shots,
    rolling: Math.round(p.rolling.quality * 10) / 10,
    rollingShots: p.rolling.shots,
    thin: p.rolling.thin,
  }));
}

function TrendCard({ t, height }: { t: QualityTrend; height: number }) {
  const enough = t.latest !== null && !t.latest.thin && t.points.length >= 2;
  const noun = t.category === 'ALL' ? 'shots' : `${t.label.toLowerCase()} shots`;
  return (
    <div className="space-y-1 rounded-lg border bg-paper p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{t.label}</p>
        {t.latest && (
          <p className={`font-mono text-lg font-medium ${enough ? TONE_CLASS[qualityTone(t.latest.quality)] : 'text-faint'}`}>
            {formatQuality(t.latest.quality)}
          </p>
        )}
      </div>
      {enough ? (
        <>
          <p className="font-mono text-[11px] text-muted">
            last {t.windowRounds} rounds · {t.latest!.shots} shots
          </p>
          <QualityTrendChart data={toData(t)} height={height} {...qualityAxis(t.points.flatMap((p) => [p.round.quality, p.rolling.quality]))} />
        </>
      ) : (
        <p className="text-sm text-ink-2">
          Not enough {noun} to rate yet: {t.latest?.shots ?? 0} in your last {t.windowRounds} rounds with any,{' '}
          {MIN_SHOTS_FOR_QUALITY} needed.
        </p>
      )}
    </div>
  );
}

/** "Player quality" over time: every shot, then each area. */
export function QualityTrendsSection({ trends }: { trends: QualityTrend[] }) {
  if (trends.length === 0) return null;
  const [all, ...cats] = trends;
  const overYear = all!.since !== null;
  return (
    <section className="border rounded-xl bg-card p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-lg">Shot quality over time</h2>
        <p className="text-xs text-muted">
          {overYear ? 'The last year. ' : 'All your rounds. '}
          100 is a scratch golfer&apos;s average shot. The line is your last 5 rounds pooled together; dots are single
          rounds. A hollow point has under {MIN_SHOTS_FOR_QUALITY} shots behind it. Rounds from every course are mixed
          here, so a hard course pulls the line down.
        </p>
      </div>
      <TrendCard t={all!} height={200} />
      <div className="grid gap-3 sm:grid-cols-2">
        {cats.map((t) => (
          <TrendCard key={t.category} t={t} height={150} />
        ))}
      </div>
    </section>
  );
}
