import { scoreTone, type ScoreTone } from '@/lib/insights/scorecard';

/**
 * Score colours follow the rest of the app — green is good, terracotta is bad — rather than the
 * printed-scorecard convention of red for birdies, so a colour never means two things here.
 */
const TONE: Record<ScoreTone, string> = {
  eagle: 'bg-pos text-paper font-semibold',
  birdie: 'bg-pos/70 text-paper font-medium',
  par: 'bg-pos-soft text-ink',
  bogey: 'bg-neg-soft text-ink',
  double: 'bg-neg/60 text-paper',
  worse: 'bg-neg text-paper font-medium',
  none: 'text-faint',
};

export function scoreToneClass(toPar: number | null): string {
  return TONE[scoreTone(toPar)];
}

export function ScoreLegend() {
  const items: [string, ScoreTone][] = [
    ['Eagle+', 'eagle'],
    ['Birdie', 'birdie'],
    ['Par', 'par'],
    ['Bogey', 'bogey'],
    ['Double', 'double'],
    ['Worse', 'worse'],
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-muted">
      {items.map(([label, tone]) => (
        <li key={tone} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded-sm ${TONE[tone].split(' ')[0]}`} /> {label}
        </li>
      ))}
    </ul>
  );
}

/** Just the fill colour for a score tone — for bars and swatches. */
export function toneFillClass(tone: ScoreTone): string {
  return TONE[tone].split(' ')[0]!;
}
