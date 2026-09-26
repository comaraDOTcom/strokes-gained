/**
 * Quality gate on the COMMITTED course directory (`data/ireland.json`), not on the builder.
 * The builder's tests prove the rules; this proves the product a player sees on /profile.
 *
 * It's a ratchet: coverage may only go up, and the known-issues lists below may only shrink.
 * When a refresh or an override fixes one, the test fails until the entry is removed from the
 * list, so docs/quality.md and this file can't quietly drift from the data. When a refresh makes
 * things worse, it fails too. Tracked in GitHub issue #38.
 */
import { describe, expect, it } from 'vitest';
import { COUNTIES, countyInName, metresBetween, type DirectoryCourse } from './build';
import ireland from './data/ireland.json';

const courses = ireland.courses as DirectoryCourse[];
const aliases = ireland.aliases as Record<string, string>;

/**
 * Names that are not a golf course and should be excluded in overrides.json (or by NOT_A_COURSE).
 * Empty since #37 widened NOT_A_COURSE (football, academies, 1–8 hole courses); any new entry is a
 * regression in the filter.
 */
const KNOWN_NOT_A_COURSE: string[] = [];

/** Pairs that are one club listed twice; the second should be excluded or aliased. */
const KNOWN_DUPLICATES: [string, string][] = [
  ['Adare Manor Golf Club', 'Adare Manor Hotel & Golf Resort Ireland'],
  ['Druids Glen Golf Course', 'Druids Glenn Golf Resort, Wicklow'],
];

/** Clubs a player would expect to find and can't (substring of the name, case-insensitive). */
const KNOWN_MISSING = ['Killarney', 'Ceann Sib', 'Seapoint', 'Glasson', 'Athlone', 'County Louth', 'Carton House'];

/** Clubs that must be present; losing one on a refresh is a broken fetch, not a change. */
const ANCHORS = [
  'Elm Park', 'Portmarnock Golf Club', 'Royal County Down', 'Royal Portrush', 'Ballybunion', 'Lahinch',
  'Waterville', 'Old Head', 'The Island', 'Rosapenna', 'Carne', 'Mount Juliet', 'Adare Manor',
  'Druids Glen', 'K Club', 'Tralee', 'Dooks', 'Baltray', 'Dundalk', 'Mullingar', 'Galway Bay',
];

/** Share of courses with a known hole count. Measured 2026-09-26: 134/405. Raise it as data improves. */
const MIN_HOLES_COVERAGE = 0.32;

const NOT_A_COURSE_NAME =
  /pitch\s*(&|and|'?n'?|-)\s*putt?|driving\s+range|practice|academy|mini(ature)?\s*golf|crazy\s+golf|foot\s*golf|football|putting\s+(green|course)|\bpar[\s-]*3\b|^\d+\s*hole/i;

const has = (needle: string) => courses.some((c) => c.name.toLowerCase().includes(needle.toLowerCase()));

describe('course directory data (data/ireland.json)', () => {
  it('has a plausible number of courses, all with a county from the 32 and a position on the island', () => {
    expect(courses.length).toBeGreaterThan(380);
    for (const c of courses) {
      expect(COUNTIES as readonly string[], `${c.name} has county ${c.county}`).toContain(c.county);
      expect(c.lat, c.name).toBeGreaterThan(51.3);
      expect(c.lat, c.name).toBeLessThan(55.5);
      expect(c.lng, c.name).toBeGreaterThan(-10.8);
      expect(c.lng, c.name).toBeLessThan(-5.3);
    }
  });

  it('has unique keys and only whole-nines hole counts', () => {
    expect(new Set(courses.map((c) => c.key)).size).toBe(courses.length);
    for (const c of courses) {
      if (c.holes !== null) expect(c.holes % 9, `${c.name}: ${c.holes} holes`).toBe(0);
    }
  });

  it('keeps hole-count coverage at or above the ratchet', () => {
    const known = courses.filter((c) => c.holes !== null).length;
    expect(known / courses.length).toBeGreaterThanOrEqual(MIN_HOLES_COVERAGE);
  });

  it('contains no non-courses beyond the known list (fix: overrides.json exclude, then remove it here)', () => {
    const found = courses.filter((c) => NOT_A_COURSE_NAME.test(c.name)).map((c) => c.name).sort();
    expect(found).toEqual([...KNOWN_NOT_A_COURSE].sort());
  });

  it('contains no duplicate clubs beyond the known list', () => {
    for (const [a, b] of KNOWN_DUPLICATES) {
      expect(has(a), `${a} gone: remove the pair from KNOWN_DUPLICATES`).toBe(true);
      expect(has(b), `${b} gone: remove the pair from KNOWN_DUPLICATES`).toBe(true);
    }
    // Same name in the same county is a duplicate the merge should have caught.
    const seen = new Map<string, string>();
    for (const c of courses) {
      const k = `${c.county}|${c.name.toLowerCase().replace(/[^a-z]/g, '')}`;
      expect(seen.has(k), `${c.name} appears twice in ${c.county} (${seen.get(k)} and ${c.key})`).toBe(false);
      seen.set(k, c.key);
    }
  });

  it('still lacks exactly the known missing clubs (fix: overrides.json add, then remove it here)', () => {
    for (const name of KNOWN_MISSING) {
      expect(has(name), `${name} is now present: remove it from KNOWN_MISSING`).toBe(false);
    }
  });

  it('places a club named after a county in that county (Waterford GC was shown in Kilkenny)', () => {
    const wrong = courses
      .map((c) => ({ c, named: countyInName(c.name) }))
      .filter(({ c, named }) => named !== null && named !== c.county)
      .map(({ c, named }) => `${c.name}: named ${named}, placed in ${c.county}`);
    expect(wrong).toEqual([]);
  });

  it('has no hand-added course sitting on top of one OSM already maps (Lahinch was both)', () => {
    const osm = courses.filter((c) => c.key.startsWith('osm:') && !c.stale);
    const overlaps = courses
      .filter((c) => c.key.startsWith('manual:'))
      .flatMap((m) => osm.filter((o) => metresBetween(m, o) < 1500).map((o) => `${m.key} is ${Math.round(metresBetween(m, o))} m from ${o.key} ${o.name}`));
    expect(overlaps, 'retire the manual entry: remove its "add", point overrides.json "alias" at the OSM key').toEqual([]);
  });

  it('points every alias at a course that exists, so a tick on an old key still counts', () => {
    const keys = new Set(courses.map((c) => c.key));
    for (const [from, to] of Object.entries(aliases)) {
      expect(keys.has(to), `alias ${from} -> ${to}: target missing`).toBe(true);
      expect(keys.has(from), `alias ${from} is also a live key`).toBe(false);
    }
  });

  it('has every anchor club', () => {
    for (const name of ANCHORS) expect(has(name), `${name} missing from the directory`).toBe(true);
  });
});
