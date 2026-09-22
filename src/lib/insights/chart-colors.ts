/**
 * Chart palette for `/insights` and `/trends` — the validated default
 * instance from the `dataviz` skill's `references/palette.md`, used
 * verbatim (no brand substitution requested). The rest of this app is
 * light-mode-only Tailwind with no theme toggle (see `globals.css` /
 * `layout.tsx`), so charts match that scope rather than adding dark-mode
 * theming nothing else in the app has.
 */

/** Fixed-order categorical hues — assign by identity, never cycle/re-sort. */
export const CATEGORICAL = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

/** Diverging pair for SG (polarity: gained vs. lost), neutral midpoint for ~0. */
export const DIVERGING = {
  positive: '#2d7a4f', // green (design mock)
  negative: '#b5432b', // terracotta (design mock)
  neutral: '#c3c2b7',
} as const;

export const CHROME = {
  surface: '#faf9f4',
  primaryInk: '#0b0b0b',
  secondaryInk: '#52514e',
  mutedInk: '#898781',
  gridline: '#e1e0d9',
  baseline: '#c3c2b7',
} as const;

export function sgColor(value: number): string {
  if (value > 0.02) return DIVERGING.positive;
  if (value < -0.02) return DIVERGING.negative;
  return DIVERGING.neutral;
}

export function fmtSg(value: number, digits = 2): string {
  const s = value.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits); // no "-0.0" / "+0.0"
  return value > 0 ? `+${s}` : s;
}

export function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

/**
 * A y-axis on round numbers (steps of 1, 2 or 5 × 10ⁿ) that always includes 0 and leaves
 * headroom past the longest bar in each direction for its label.
 */
export function niceAxis(values: number[]): { domain: [number, number]; ticks: number[]; decimals: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...finite);
  const hi = Math.max(0, ...finite);
  const range = hi - lo || 1;
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Number(([1, 2, 5, 10].map((m) => m * mag).find((st) => st >= raw)!).toPrecision(6));
  const pad = range * 0.12;
  const min = lo < 0 ? Math.floor((lo - pad) / step) * step : 0;
  const max = hi > 0 ? Math.ceil((hi + pad) / step) * step : 0;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 1e6; t += step) ticks.push(Number(t.toFixed(6)));
  // Decimals the tick labels need so no two ticks print the same (0.05 steps need 2).
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return { domain: [min, max], ticks, decimals };
}
