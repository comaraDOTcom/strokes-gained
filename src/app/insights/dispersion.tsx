/**
 * "Where you miss" and "Putting profile" on /insights, from the Detailed-entry tags. CSS only: a
 * four-direction cross puts each number where the miss is, which reads better on a phone than a
 * donut and needs no legend. Server components, no hooks.
 */
import {
  MIN_BREAK_ROW,
  MIN_TAGGED,
  type GreenMissProfile,
  type PuttingProfileBand,
  type TeeDispersion,
} from '@/lib/insights/dispersion';
import type { MissDirection } from '@/lib/rounds/entry';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const LABEL = 'font-mono text-[10px] uppercase tracking-wide text-muted';

function Sector({ p, dir, word }: { p: GreenMissProfile; dir: MissDirection; word: string }) {
  const hot = p.dominant === dir;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-1 py-1.5 ${hot ? 'border-neg bg-neg-soft' : 'bg-paper'}`}
      title={`${p.misses[dir]} of ${p.shots} shots finished ${word.toLowerCase()}`}
    >
      <span className={LABEL}>{word}</span>
      <span className={`font-mono text-lg font-medium ${hot ? 'text-neg' : ''}`}>{pct(p.shares[dir])}</span>
      <span className="font-mono text-[10px] text-faint">({p.misses[dir]})</span>
    </div>
  );
}

/** Long above, short below, left and right either side, green-hit rate in the middle. */
export function MissCross({ p, title }: { p: GreenMissProfile; title: string }) {
  return (
    <div className="space-y-2">
      <p className={LABEL}>{title}</p>
      <div className={`mx-auto grid w-full max-w-[15rem] grid-cols-3 grid-rows-3 gap-1.5 ${p.enough ? '' : 'opacity-60'}`}>
        <span />
        <Sector p={p} dir="LONG" word="Long" />
        <span />
        <Sector p={p} dir="LEFT" word="Left" />
        <div className="flex flex-col items-center justify-center rounded-full border-2 border-pos/50 bg-pos-soft">
          <span className={LABEL}>green</span>
          <span className="font-mono text-lg font-medium text-pos">{pct(p.onGreenPct)}</span>
          <span className="font-mono text-[10px] text-muted">n = {p.shots}</span>
        </div>
        <Sector p={p} dir="RIGHT" word="Right" />
        <span />
        <Sector p={p} dir="SHORT" word="Short" />
        <span />
      </div>
      <p className="text-center text-xs text-muted">
        {p.untagged > 0 && `${p.untagged} miss${p.untagged === 1 ? '' : 'es'} not tagged. `}
        {!p.enough && `Only ${p.tagged} tagged so far: ${MIN_TAGGED} needed before this means much.`}
      </p>
    </div>
  );
}

/** One row per distance band: shots, on-green rate, and each miss. */
export function BandMissTable({ rows }: { rows: GreenMissProfile[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs [&_td:not(:first-child)]:pl-2 [&_th:not(:first-child)]:pl-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="text-muted">
          <tr className="text-right">
            <th className="py-1 text-left font-normal">Band</th>
            <th className="font-normal">n</th>
            <th className="font-normal">Green</th>
            <th className="font-normal">L</th>
            <th className="font-normal">R</th>
            <th className="font-normal">Long</th>
            <th className="font-normal">Short</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.band} className={`border-t text-right ${r.enough ? '' : 'text-faint'}`}>
              <td className="py-1 text-left">{r.band}</td>
              <td>{r.shots}</td>
              <td>{pct(r.onGreenPct)}</td>
              {(['LEFT', 'RIGHT', 'LONG', 'SHORT'] as const).map((d) => (
                <td key={d} className={r.enough && r.dominant === d ? 'font-medium text-neg' : ''}>
                  {r.misses[d]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-muted">Counts of tagged misses. Faded rows have fewer than {MIN_TAGGED}.</p>
    </div>
  );
}

/** Left · fairway · right, as one bar. */
export function TeeSplitBar({ t }: { t: TeeDispersion }) {
  if (t.teeShots === 0) return null;
  const segs = [
    { key: 'left', label: 'Left', share: t.leftShare, cls: 'bg-neg text-paper' },
    { key: 'fairway', label: 'Fairway', share: t.fairwayPct, cls: 'bg-pos text-paper' },
    { key: 'right', label: 'Right', share: t.rightShare, cls: 'bg-neg text-paper' },
    { key: 'other', label: '', share: (t.untagged + t.onGreen) / t.teeShots, cls: 'bg-paper-2 text-muted' },
  ].filter((s) => s.share > 0);
  return (
    <div className={`space-y-1.5 ${t.enough ? '' : 'opacity-70'}`}>
      <p className={LABEL}>Off the tee (par 4s and 5s)</p>
      <div className="flex h-8 overflow-hidden rounded">
        {segs.map((s) => (
          <span
            key={s.key}
            className={`flex items-center justify-center font-mono text-[11px] ${s.cls}`}
            style={{ width: pct(s.share) }}
            title={`${s.label || 'Not tagged'} ${pct(s.share)}`}
          >
            {!s.label ? '' : s.share >= 0.22 ? `${s.label} ${pct(s.share)}` : s.share >= 0.1 ? pct(s.share) : ''}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted">
        Fairways {pct(t.fairwayPct)} · missed left {t.left} · missed right {t.right}
        {t.untagged > 0 && ` · ${t.untagged} miss${t.untagged === 1 ? '' : 'es'} not tagged`} · {t.teeShots} tee shots
        {!t.enough && `. Tag ${MIN_TAGGED} side misses before reading much into the split.`}
      </p>
    </div>
  );
}

const SPEED_WORD = { conservative: 'short', aggressive: 'long', balanced: 'even' } as const;
const BREAK_WORD = { LEFT_TO_RIGHT: 'Left-to-right', RIGHT_TO_LEFT: 'Right-to-left', STRAIGHT: 'Straight', UNKNOWN: 'Break not tagged' } as const;

/** Make rate, speed and side per putting band, then which side you miss by break. */
export function PuttingProfileTable({ overall, bands }: { overall: PuttingProfileBand; bands: PuttingProfileBand[] }) {
  if (overall.putts === 0) return null;
  const rows = [...bands, overall];
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs [&_td:not(:first-child)]:pl-2 [&_th:not(:first-child)]:pl-2 [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="text-muted">
            <tr className="text-right">
              <th className="py-1 text-left font-normal">Band</th>
              <th className="font-normal">Putts</th>
              <th className="font-normal">Made</th>
              <th className="font-normal" title="Missed short / missed long">Speed</th>
              <th className="font-normal" title="Missed on the high side / low side">Hi/Lo</th>
              <th className="font-normal">L/R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.band} className={`border-t text-right ${r.band === 'All' ? 'font-medium' : ''} ${r.enough ? '' : 'text-faint'}`}>
                <td className="py-1 text-left">{r.band}</td>
                <td>{r.putts}</td>
                <td>{pct(r.makePct)}</td>
                <td title={`${r.short} short, ${r.long} long`}>
                  {r.short}/{r.long}
                  {r.speed && <span className="block text-[10px] text-muted">{SPEED_WORD[r.speed]}</span>}
                </td>
                <td>
                  {r.high}/{r.low}
                </td>
                <td>
                  {r.left}/{r.right}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-[11px] text-muted">
          Missed putts only, from Detailed entry. Speed is missed short / long, with the tendency under it once there are
          {' '}{MIN_TAGGED}. Hi/Lo needs the break: on a left-to-right putt, missing left is the
          high side. Faded rows have fewer than {MIN_TAGGED} tagged misses.
        </p>
      </div>
      {overall.byBreak.length > 0 && (
        <ul className="space-y-1 text-sm">
          {overall.byBreak.map((b) => (
            <li key={b.break} className={`flex justify-between gap-3 ${b.enough ? '' : 'text-faint'}`}>
              <span>
                {BREAK_WORD[b.break]} <span className="font-mono text-xs text-muted">({b.putts} putts, {b.made} made)</span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-xs">
                {b.break === 'LEFT_TO_RIGHT' || b.break === 'RIGHT_TO_LEFT'
                  ? `high ${b.high} · low ${b.low}`
                  : `left ${b.missLeft} · right ${b.missRight}`}
              </span>
            </li>
          ))}
          <li className="text-[11px] text-muted">A row needs {MIN_BREAK_ROW} side misses before it says much.</li>
        </ul>
      )}
    </div>
  );
}
