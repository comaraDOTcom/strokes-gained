import { scoreTone, type ScoreTone } from '@/lib/insights/scorecard';

/**
 * Score colours: the structure of a tour leaderboard (gold eagle, NO fill for par, blue bogey,
 * navy double and worse — each step its own colour, and par blank so every non-par stands out)
 * with one change: birdie is green, not red, because red means "strokes lost" everywhere else in
 * this app and a colour should never mean two things. The fills are theme-independent (globals.css),
 * so the text on them is too: on-light or on-fill, never ink/paper, which flip in the dark theme.
 * Every score cell sets its number in the mono face with tabular digits.
 */
const TONE: Record<ScoreTone, { cell: string; fill: string }> = {
  eagle: { cell: 'bg-eagle text-on-light font-semibold', fill: 'bg-eagle' },
  birdie: { cell: 'bg-birdie text-on-fill font-semibold', fill: 'bg-birdie' },
  par: { cell: 'text-ink ring-1 ring-inset ring-line', fill: 'bg-card ring-1 ring-inset ring-line-strong' },
  bogey: { cell: 'bg-bogey text-on-light', fill: 'bg-bogey' },
  double: { cell: 'bg-double text-on-fill font-medium', fill: 'bg-double' },
  // The ring keeps the navy cell's edge visible on the dark theme's near-black card.
  worse: { cell: 'bg-worse text-on-fill font-semibold ring-1 ring-inset ring-line-strong', fill: 'bg-worse ring-1 ring-inset ring-line-strong' },
  none: { cell: 'text-faint', fill: '' },
};

export function scoreToneClass(toPar: number | null): string {
  return `${TONE[scoreTone(toPar)].cell} font-mono tabular-nums`;
}

export function ScoreLegend() {
  const items: [string, ScoreTone][] = [
    ['Eagle+', 'eagle'],
    ['Birdie', 'birdie'],
    ['Par', 'par'],
    ['Bogey', 'bogey'],
    ['Double', 'double'],
    ['Triple+', 'worse'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-muted">
      {items.map(([label, tone]) => (
        <li key={tone} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded-sm ${TONE[tone].fill}`} /> {label}
        </li>
      ))}
    </ul>
  );
}

/** Just the fill colour for a score tone — for bars and swatches. */
export function toneFillClass(tone: ScoreTone): string {
  return TONE[tone].fill;
}
