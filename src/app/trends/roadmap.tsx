import type { BucketTrend, Roadmap, RoadmapItem, TrendDirection } from '@/lib/insights/roadmap';
import { CATEGORICAL, fmtSg } from '@/lib/insights/chart-colors';
import { SignalChip } from './signal-chip';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const MAX_CARDS = 5;

const ARROW: Record<TrendDirection, string> = { improving: '↑', worsening: '↓', flat: '→' };
const LEVEL_WORD = { none: 'None', low: 'Low', medium: 'Medium', high: 'High' } as const;
const TIER_WORD = { high: 'high', mid: 'mid', lower: 'lower' } as const;

/** Strokes a round vs scratch in this area, over the window: − lost, + gained. */
function per18(item: RoadmapItem, holes: number): number {
  return holes > 0 ? (item.sgTotal * 18) / holes : 0;
}

function Chip({ children, tone = 'plain', title }: { children: React.ReactNode; tone?: 'plain' | 'bad'; title?: string }) {
  return (
    <span
      title={title}
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        tone === 'bad' ? 'bg-neg-soft text-neg' : 'bg-paper-2 text-ink-2'
      }`}
    >
      {children}
    </span>
  );
}

/** One bar per round in the window: up = gained, down = lost. A dot for a round with no shots here. */
function Sparkline({ trend }: { trend: BucketTrend }) {
  const max = Math.max(...trend.series.map((p) => Math.abs(p.sg)), 0.01);
  return (
    <span className="flex items-center gap-[3px]" aria-label="Strokes gained here, round by round">
      {trend.series.map((p) => {
        const h = `${Math.max(8, (Math.abs(p.sg) / max) * 100)}%`;
        const title = `${p.playedOn}: ${p.attempts === 0 ? 'no shots' : `${fmtSg(p.sg)} over ${p.attempts} shot${p.attempts === 1 ? '' : 's'}`}`;
        return (
          <span key={p.roundId} title={title} className="flex h-8 w-1.5 flex-col">
            <span className="flex h-1/2 items-end">
              {p.attempts > 0 && p.sg > 0 && <span className="w-full rounded-t-sm bg-pos/70" style={{ height: h }} />}
            </span>
            <span className="flex h-1/2 items-start border-t border-line-strong">
              {p.attempts > 0 && p.sg <= 0 && <span className="w-full rounded-b-sm bg-neg/70" style={{ height: h }} />}
              {p.attempts === 0 && <span className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-faint" />}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function PriorityCard({ item, rank }: { item: RoadmapItem; rank: number }) {
  const { importance: imp, opportunity: opp, trend } = item;
  return (
    <li className="space-y-2 rounded-xl border bg-paper px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          <span className="mr-1.5 font-mono text-muted">{rank}.</span>
          {item.label}
        </p>
        {trend && <Sparkline trend={trend} />}
      </div>
      <p className="text-sm text-ink-2">{item.sentence}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip title={`${TIER_WORD[imp.tier]} importance: this area's share of what separates golfers' scores`}>
          Importance {pct(imp.bucketShare)}
        </Chip>
        <Chip tone={opp.level === 'high' ? 'bad' : 'plain'} title={`${opp.attempts} shots, ${fmtSg(opp.sgPerShot)} a shot`}>
          Opportunity {LEVEL_WORD[opp.level]} · −{opp.strokesPer18.toFixed(1)}/rd
        </Chip>
        {trend ? (
          <>
            <Chip title={`${fmtSg(trend.deltaPer18, 2)} strokes a round, recent ${trend.recentRounds} rounds vs the ${trend.earlierRounds} before`}>
              Trend {ARROW[trend.direction]} {trend.direction}
            </Chip>
            <SignalChip signal={trend.signal} short />
          </>
        ) : (
          <Chip>Trend: not enough rounds</Chip>
        )}
      </div>
    </li>
  );
}

export function RoadmapSection({ roadmap }: { roadmap: Roadmap }) {
  const { groups, items, all, windowRounds, holesInWindow, roundsTotal } = roadmap;
  // Only name a strength that's worth at least 0.1 strokes a round; smaller reads as "+0.0".
  const strengths = roadmap.strengths.filter((s) => per18(s, holesInWindow) >= 0.05);
  return (
    <section className="border rounded-xl bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-lg">What to work on</h2>
        <p className="text-xs text-muted">
          Each area gets three numbers. <b>Importance</b>: how much that kind of shot separates golfers&apos; scores
          (Broadie, <i>Every Shot Counts</i>), split by how often you hit it. <b>Opportunity</b>: strokes a round you
          lose there against scratch, over your last {windowRounds} round{windowRounds === 1 ? '' : 's'}.{' '}
          <b>Trend</b>: your recent rounds against the ones before. Ranked by importance × opportunity.
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Importance to scoring</p>
        <div className="flex h-5 overflow-hidden rounded" role="img" aria-label="Share of scoring differences by part of the game">
          {groups.map((g, i) => (
            <span key={g.group} title={`${g.label}: ${pct(g.share)}`} style={{ width: pct(g.share), background: CATEGORICAL[i] }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {groups.map((g, i) => (
            <div key={g.group} className="rounded-lg border bg-paper px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORICAL[i] }} />
                {g.label}
              </p>
              <p className="font-mono text-xl font-medium">{pct(g.share)}</p>
              <p className={`font-mono text-xs ${g.sgPer18 < -0.05 ? 'text-neg' : g.sgPer18 > 0.05 ? 'text-pos' : 'text-muted'}`}>
                you: {fmtSg(g.sgPer18, 1)} / round
              </p>
            </div>
          ))}
        </div>
        {roadmap.importanceStatus === 'placeholder' && (
          <p className="text-xs text-warn">
            These importance shares are rounded placeholders until they&apos;re checked against the book. The ranking
            below leans on them.
          </p>
        )}
      </div>

      {roundsTotal < 2 ? (
        <p className="text-sm text-ink-2">Log at least 2 rounds to rank what to work on.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-2">
          No area loses you shots over the last {windowRounds} rounds, so there&apos;s nothing to flag.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.slice(0, MAX_CARDS).map((item, i) => (
            <PriorityCard key={item.key} item={item} rank={i + 1} />
          ))}
        </ol>
      )}

      {strengths.length > 0 && (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-ink">Holding up:</span>{' '}
          {strengths
            .slice(0, 3)
            .map((s) => `${s.label} (${fmtSg(per18(s, holesInWindow), 1)} a round)`)
            .join(', ')}
          .
        </p>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2">All {all.length} areas</summary>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_2rem] gap-x-2 gap-y-1 font-mono text-xs">
          <span className="text-muted">Area</span>
          <span className="text-right text-muted">Import.</span>
          <span className="text-right text-muted">A round</span>
          <span className="text-right text-muted">Trend</span>
          {all.map((a) => (
            <Row key={a.key} item={a} holes={holesInWindow} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          &quot;A round&quot; is strokes gained per 18 holes against scratch over the last {windowRounds} rounds. A dash
          means no shots there yet.
        </p>
      </details>
    </section>
  );
}

function Row({ item, holes }: { item: RoadmapItem; holes: number }) {
  const v = per18(item, holes);
  const empty = item.attempts === 0;
  return (
    <>
      <span className={`truncate font-sans ${empty ? 'text-faint' : ''}`}>{item.label}</span>
      <span className="text-right">{pct(item.importance.bucketShare)}</span>
      <span className={`text-right ${empty ? 'text-faint' : v < -0.05 ? 'text-neg' : v > 0.05 ? 'text-pos' : ''}`}>
        {empty ? '—' : fmtSg(v, 1)}
      </span>
      <span className="text-right" title={item.trend ? `${item.trend.direction}, ${item.trend.signal}` : undefined}>
        {item.trend ? (
          <span className={item.trend.signal === 'noise' ? 'text-faint' : ''}>{ARROW[item.trend.direction]}</span>
        ) : (
          '—'
        )}
      </span>
    </>
  );
}
