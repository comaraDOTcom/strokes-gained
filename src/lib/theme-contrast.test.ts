/**
 * Ratchet for the brand tokens in src/app/globals.css (issue #51): every text colour reads at
 * ≥ 4.5:1 (WCAG AA body text) on every surface, in the light theme and the dark theme, and the
 * score-cell text reads on its fill. Change a token and this says which pair broke.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** `--color-*` values declared inside the first block that starts at `marker`. */
function tokens(marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`globals.css has no ${marker} block`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++;
    if (css[end] === '}' && --depth === 0) break;
  }
  const out: Record<string, string> = {};
  for (const [, name, hex] of css.slice(open, end).matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[name!] = hex!;
  return out;
}

const light = tokens('@theme');
const dark = { ...light, ...tokens(":root[data-theme='dark']") };

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two tokens in one theme. */
function contrast(t: Record<string, string>, fg: string, bg: string): number {
  const a = t[fg];
  const b = t[bg];
  if (!a || !b) throw new Error(`missing token: ${a ? bg : fg}`);
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['ink', 'ink-2', 'muted', 'pos', 'neg', 'accent', 'warn'];
const SURFACES = ['paper', 'paper-2', 'card'];
/** Text on its own tinted background (chips, callouts). */
const ON_SOFT: [string, string][] = [
  ['pos', 'pos-soft'],
  ['neg', 'neg-soft'],
  ['accent', 'accent-soft'],
  ['warn', 'warn-soft'],
  ['ink', 'accent-soft'],
];
/** Filled cells and buttons: [text, fill]. Score fills don't change with the theme. */
const ON_FILL: [string, string][] = [
  ['on-light', 'eagle'],
  ['on-fill', 'birdie'],
  ['on-light', 'bogey'],
  ['on-fill', 'double'],
  ['on-fill', 'worse'],
  ['on-fill', 'green'],
  ['paper', 'ink'],
  ['paper', 'pos'],
  ['paper', 'neg'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, t) => {
  it('parses the tokens it checks', () => {
    for (const k of [...TEXT, ...SURFACES, ...ON_FILL.flat(), ...ON_SOFT.flat()]) expect(t[k], k).toMatch(/^#/);
  });

  it('every text colour is ≥ 4.5:1 on every surface', () => {
    const failing = TEXT.flatMap((fg) =>
      SURFACES.filter((bg) => contrast(t, fg, bg) < 4.5).map((bg) => `${fg} on ${bg}: ${contrast(t, fg, bg).toFixed(2)}`),
    );
    expect(failing).toEqual([]);
  });

  it('text on tinted and filled backgrounds is ≥ 4.5:1', () => {
    const failing = [...ON_SOFT, ...ON_FILL]
      .filter(([fg, bg]) => contrast(t, fg, bg) < 4.5)
      .map(([fg, bg]) => `${fg} on ${bg}: ${contrast(t, fg, bg).toFixed(2)}`);
    expect(failing).toEqual([]);
  });
});

it('the prefers-color-scheme block and the data-theme="dark" block declare the same dark tokens', () => {
  expect(tokens(':root:not([data-theme=\'light\'])')).toEqual(tokens(":root[data-theme='dark']"));
});
