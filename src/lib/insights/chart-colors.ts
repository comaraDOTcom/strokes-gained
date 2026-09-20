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
  positive: '#2a78d6', // blue
  negative: '#e34948', // red
  neutral: '#c3c2b7',
} as const;

export const CHROME = {
  surface: '#fcfcfb',
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

export function fmtSg(value: number): string {
  const s = value.toFixed(2);
  return value > 0 ? `+${s}` : s;
}

export function fmtPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}
