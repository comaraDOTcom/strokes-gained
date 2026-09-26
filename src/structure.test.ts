/**
 * Where code lives. Each kind of code has one place in the tree, so an agent (or a person)
 * never has to be told where something goes, and a file in the wrong place fails the suite
 * instead of a review. The rules are the ones the codebase already follows; the counts are
 * ratchets that may only move in the right direction. See .claude/skills/brigade/references/stations.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(relative(ROOT, p));
  }
  return out;
}

const all = walk(join(ROOT, 'src'));
const lib = all.filter((f) => f.startsWith('src/lib/'));
const app = all.filter((f) => f.startsWith('src/app/'));
const source = (f: string) => readFileSync(join(ROOT, f), 'utf8');

/**
 * Logic modules that have no colocated test today. Wiring, config, data tables and one-off CLIs
 * are allowed here; a new pure module is not. Remove an entry when its test lands.
 */
const LIB_WITHOUT_TESTS = [
  'src/lib/auth/auth-client.ts',
  'src/lib/auth/auth.ts',
  'src/lib/auth/claim.ts',
  'src/lib/auth/config.ts',
  'src/lib/auth/magic-link.ts',
  'src/lib/auth/permissions.ts',
  'src/lib/auth/session.ts',
  'src/lib/directory/index.ts',
  'src/lib/import/validate-parsed-sheet.ts',
  'src/lib/insights/signal.ts',
  'src/lib/notify.ts',
  'src/lib/sg/baseline-scratch.ts',
  'src/lib/sg/recompute-cli.ts',
  'src/lib/timing.ts',
  'src/lib/units.ts',
];

/**
 * Pages and route handlers that query the database themselves instead of through src/lib.
 * Measured 2026-09-26. New features go through a src/lib module (testable against PGlite);
 * this number may only go down.
 */
const MAX_APP_FILES_USING_DB_CLIENT = 16;

describe('where code lives', () => {
  it('src/lib holds logic only: no React, no route handlers', () => {
    expect(lib.filter((f) => f.endsWith('.tsx'))).toEqual([]);
    expect(lib.filter((f) => /\/(page|route|layout)\.ts$/.test(f))).toEqual([]);
  });

  it('tests live next to the logic in src/lib, never under src/app (vitest cannot import route handlers)', () => {
    expect(app.filter((f) => /\.test\.tsx?$/.test(f))).toEqual([]);
  });

  it('every logic module in src/lib has a colocated test, except the known list (which may only shrink)', () => {
    const untested = lib
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts'))
      .filter((f) => !lib.includes(f.replace(/\.ts$/, '.test.ts')))
      .sort();
    expect(untested).toEqual([...LIB_WITHOUT_TESTS].sort());
  });

  it('src/lib never imports from src/app', () => {
    const offenders = lib.filter((f) => /from ['"](@\/app|\.\.\/(\.\.\/)*app)\//.test(source(f)));
    expect(offenders).toEqual([]);
  });

  it('pages and routes reach the database through src/lib; the direct-access count may only fall', () => {
    const direct = app.filter((f) => /db\/client['"]/.test(source(f)));
    expect(direct.length, direct.join('\n')).toBeLessThanOrEqual(MAX_APP_FILES_USING_DB_CLIENT);
  });

  it('data files that ship to the browser are JSON under src/lib/*/data', () => {
    const json = all.filter((f) => f.endsWith('.json'));
    for (const f of json) expect(f, f).toMatch(/^src\/lib\/[a-z-]+\/(data|benchmark-data)\//);
  });
});
