/**
 * Presentational pieces of the round/course "story" — used by the recap click-through (a client
 * component), the rounds list and the Insights page (server components). No hooks in here.
 */
import { CATEGORY_LABEL, type RecapArea, type RecapHole, type RecapShot, type ShotGroups, type StoryHole } from '@/lib/insights/recap';
import { fmtSg } from '@/lib/insights/chart-colors';

export const sgClass = (v: number) => (v >= 0 ? 'text-pos' : 'text-neg');

export function HoleRow({ h }: { h: RecapHole }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-paper px-4 py-3">
      <div>
        <p className="font-semibold">
          Hole {h.holeNo} <span className="font-normal text-muted">· par {h.par}</span>
        </p>
        <p className="text-sm text-ink-2">
          {h.result} <span className="font-mono text-xs text-muted">({h.score})</span>
        </p>
      </div>
      <p className={`font-mono text-lg font-medium ${sgClass(h.sg)}`}>{fmtSg(h.sg)}</p>
    </li>
  );
}

/** A hole averaged over several rounds. */
export function StoryHoleRow({ h }: { h: StoryHole }) {
  const toPar = h.avgToPar;
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-paper px-4 py-3">
      <div>
        <p className="font-semibold">
          Hole {h.holeNo} <span className="font-normal text-muted">· par {h.par}</span>
        </p>
        <p className="text-sm text-ink-2">
          avg {toPar >= 0 ? '+' : ''}
          {toPar.toFixed(1)} to par{' '}
          <span className="font-mono text-xs text-muted">
            · played {h.plays}×
          </span>
        </p>
      </div>
      <p className={`font-mono text-lg font-medium ${sgClass(h.avgSg)}`}>
        {fmtSg(h.avgSg)}
        <span className="block text-right text-[10px] font-normal uppercase tracking-wide text-muted">per play</span>
      </p>
    </li>
  );
}

export function ShotRow({ s, rank, showDate = false }: { s: RecapShot; rank: number; showDate?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-wide text-muted">
          {rank}. Hole {s.holeNo} · shot {s.shotNo} · {CATEGORY_LABEL[s.category]}
          {showDate && ` · ${s.playedOn}`}
        </p>
        <p className="text-sm">{s.text}</p>
      </div>
      <p className={`shrink-0 font-mono font-medium ${sgClass(s.sg)}`}>{fmtSg(s.sg)}</p>
    </li>
  );
}

/** Tee-to-green and putts ranked separately — a holed putt would otherwise own every list. */
export function ShotGroupsBody({ groups, showDate = false }: { groups: ShotGroups; showDate?: boolean }) {
  const sections = [
    { label: 'Tee to green', shots: groups.longGame },
    { label: 'On the green', shots: groups.putts },
  ].filter((g) => g.shots.length > 0);
  return (
    <div className="space-y-4">
      {sections.map((g) => (
        <div key={g.label} className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-wide text-ink-2">{g.label}</h3>
          <ul className="space-y-2">
            {g.shots.map((s, i) => (
              <ShotRow key={`${s.roundId}-${s.holeNo}-${s.shotNo}`} s={s} rank={i + 1} showDate={showDate} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AreaCard({
  a,
  tone,
  kicker,
  per18,
}: {
  a: RecapArea;
  tone: 'pos' | 'neg';
  kicker: string;
  /** When set, lead with SG per 18 holes (many rounds) instead of the round's total. */
  per18?: number;
}) {
  const lead = per18 ?? a.sg;
  return (
    <div className={`rounded-xl border p-4 ${tone === 'pos' ? 'bg-pos-soft border-pos/40' : 'bg-neg-soft border-neg/40'}`}>
      <p className="font-mono text-xs uppercase tracking-wide text-ink-2">{kicker}</p>
      <p className="text-2xl font-semibold">{a.label}</p>
      <p className="text-sm text-ink-2">
        <span className={`font-mono font-medium ${sgClass(lead)}`}>{fmtSg(lead)}</span>{' '}
        {per18 !== undefined ? 'per 18 holes' : ''} over {a.shots} shot{a.shots === 1 ? '' : 's'}{' '}
        <span className="text-muted">({fmtSg(a.perShot)} per shot)</span>
      </p>
    </div>
  );
}
