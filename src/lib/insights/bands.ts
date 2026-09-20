/**
 * Distance-band bucketing for the `/insights` drill-down charts (BUILD.md
 * "Phase 4 — Dashboard views"). Bands are labeled ranges over the shot's
 * DISPLAY-unit distance: feet for putting, yards for short game/approach.
 * Each bucketer returns the band label a distance falls into; `order` is
 * exported alongside so charts can sort bands correctly (string sort would
 * put "10-20" before "3-6").
 */

export type Band = { label: string; order: number };

const PUTTING_BANDS: ReadonlyArray<{ max: number; label: string }> = [
  { max: 3, label: '0-3ft' },
  { max: 6, label: '3-6ft' },
  { max: 10, label: '6-10ft' },
  { max: 20, label: '10-20ft' },
  { max: 30, label: '20-30ft' },
  { max: Infinity, label: '30ft+' },
];

/** Putting bands, per BUILD.md: 0-3, 3-6, 6-10, 10-20, 20-30, 30ft+. Distance in feet. */
export function puttingBand(feet: number): Band {
  const idx = PUTTING_BANDS.findIndex((b) => feet <= b.max);
  const i = idx === -1 ? PUTTING_BANDS.length - 1 : idx;
  return { label: PUTTING_BANDS[i]!.label, order: i };
}

const SHORT_GAME_BANDS: ReadonlyArray<{ max: number; label: string }> = [
  { max: 10, label: '0-10y' },
  { max: 20, label: '10-20y' },
  { max: 30, label: '20-30y' },
];

/** Short-game bands, per BUILD.md: 0-10, 10-20, 20-30y. Distance in yards. */
export function shortGameBand(yards: number): Band {
  const idx = SHORT_GAME_BANDS.findIndex((b) => yards <= b.max);
  const i = idx === -1 ? SHORT_GAME_BANDS.length - 1 : idx;
  return { label: SHORT_GAME_BANDS[i]!.label, order: i };
}

const APPROACH_BANDS: ReadonlyArray<{ max: number; label: string }> = [
  { max: 100, label: '<100y' },
  { max: 150, label: '100-150y' },
  { max: 200, label: '150-200y' },
  { max: Infinity, label: '200y+' },
];

/** Approach bands, per BUILD.md: <100, 100-150, 150-200, 200y+. Distance in yards. */
export function approachBand(yards: number): Band {
  const idx = APPROACH_BANDS.findIndex((b) => yards <= b.max);
  const i = idx === -1 ? APPROACH_BANDS.length - 1 : idx;
  return { label: APPROACH_BANDS[i]!.label, order: i };
}

export const PUTTING_BAND_ORDER = PUTTING_BANDS.map((b) => b.label);
export const SHORT_GAME_BAND_ORDER = SHORT_GAME_BANDS.map((b) => b.label);
export const APPROACH_BAND_ORDER = APPROACH_BANDS.map((b) => b.label);
