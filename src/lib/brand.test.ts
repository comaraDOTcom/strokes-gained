import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

/** Every non-test .ts/.tsx source under src/. */
function sources(dir = ROOT): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `file:line` for every line of source matching `pattern`. */
function hits(pattern: RegExp): string[] {
  return sources().flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => (pattern.test(line) ? [`${relative(ROOT, file)}:${i + 1}`] : [])),
  );
}

describe('brand (issue #50)', () => {
  it('no source names the product "Strokes Gained"; the metric is lower-case "strokes gained"', () => {
    expect(hits(/Strokes Gained/)).toEqual([]);
  });

  it('no user-facing copy says "leak" (copy rule: "where the strokes go", "costliest shots")', () => {
    // A string literal containing the word, or a line of JSX text (starts with a capital or a
    // closing `>`, e.g. "Biggest leak: <span>…"). Identifiers such as `leakAndStrength` and
    // comments are fine: players never see them.
    const inString = /(['"`])[^'"`]*\bleak(s|ed|ing|y)?\b[^'"`]*\1/i;
    const jsxText = /^(>|[A-Z])[^=;(){}]*\b[Ll]eak(s|ed|ing|y)?\b/;
    const found = sources().flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((raw, i) => {
          const line = raw.trim();
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return [];
          return inString.test(line) || jsxText.test(line) ? [`${relative(ROOT, file)}:${i + 1}`] : [];
        }),
    );
    expect(found).toEqual([]);
  });
});
