import { describe, expect, it } from 'vitest';
import { matchScore, matchTop100, parseRankedLines, rankByKey, validateTop100, type Top100File } from './top100';
import type { DirectoryCourse } from './build';
import { DIRECTORY, TOP100, resolveKey } from './index';

const c = (key: string, name: string): DirectoryCourse => ({ key, name, county: null, country: 'IE', lat: 53, lng: -6, holes: 18, website: null });
const DIR = [
  c('osm:way/1', 'Royal County Down Golf Course'),
  c('osm:way/2', 'Portmarnock Golf Club'),
  c('osm:way/3', 'Portmarnock Links'),
  c('osm:way/4', 'Ballybunion Golf Club'),
  c('manual:lahinch', 'Lahinch Golf Club'),
  c('osm:way/6', 'The European Club'),
];

describe('parseRankedLines', () => {
  it('reads "1. Name", "2) Name", "#3 – Name", tabs, and bare names by position', () => {
    expect(parseRankedLines('1. Royal County Down\n2) Portmarnock\n\n#3 – Ballybunion (Old)\n4\tLahinch\nThe European Club')).toEqual([
      { rank: 1, name: 'Royal County Down' },
      { rank: 2, name: 'Portmarnock' },
      { rank: 3, name: 'Ballybunion (Old)' },
      { rank: 4, name: 'Lahinch' },
      { rank: 5, name: 'The European Club' },
    ]);
  });
});

describe('matchTop100', () => {
  it('matches ranked names to directory courses, ignoring filler words and course suffixes', () => {
    const { entries, unmatched } = matchTop100(parseRankedLines('1. Royal County Down (Championship)\n2. Portmarnock\n3. Ballybunion (Old)\n4. Lahinch (Old)\n5. The European Club'), DIR);
    expect(entries.map((e) => e.key)).toEqual(['osm:way/1', 'osm:way/2', 'osm:way/4', 'manual:lahinch', 'osm:way/6']);
    expect(unmatched).toEqual([]);
  });

  it('prefers the exact club over a neighbour with an extra word', () => {
    expect(matchScore('Portmarnock', DIR[1]!)).toBeGreaterThan(matchScore('Portmarnock', DIR[2]!));
    expect(matchTop100([{ rank: 1, name: 'Portmarnock Links' }], DIR).entries[0]!.key).toBe('osm:way/3');
  });

  it('leaves a course it can’t place unmatched, with guesses, rather than guessing', () => {
    const { entries, unmatched } = matchTop100([{ rank: 9, name: 'Old Head' }], DIR);
    expect(entries).toEqual([{ rank: 9, name: 'Old Head', key: null }]);
    expect(unmatched[0]!.rank).toBe(9);
  });

  it('never gives one course two ranks', () => {
    const { entries } = matchTop100([{ rank: 1, name: 'Portmarnock' }, { rank: 2, name: 'Portmarnock Golf Club' }], DIR);
    expect(entries.map((e) => e.key)).toEqual(['osm:way/2', null]);
  });
});

describe('validateTop100', () => {
  const file = (entries: Top100File['entries']): Top100File => ({ title: 't', year: 2023, source: null, entries });
  it('flags duplicate ranks, duplicate keys and keys missing from the directory', () => {
    expect(
      validateTop100(
        file([
          { rank: 1, name: 'A', key: 'osm:way/1' },
          { rank: 1, name: 'B', key: 'osm:way/1' },
          { rank: 2, name: 'C', key: 'osm:way/404' },
          { rank: 3, name: 'D', key: null },
        ]),
        DIR,
      ),
    ).toEqual(['rank 1 appears twice', '#1 B: osm:way/1 is ranked twice', "#2 C: osm:way/404 isn't in the directory"]);
  });
  it('maps key -> rank for matched entries only', () => {
    expect([...rankByKey(file([{ rank: 4, name: 'A', key: 'osm:way/1' }, { rank: 5, name: 'B', key: null }]))]).toEqual([['osm:way/1', 4]]);
  });
});

describe('the committed ranking', () => {
  it('is consistent with the committed directory (old keys count once aliased)', () => {
    const resolved = { ...TOP100, entries: TOP100.entries.map((e) => ({ ...e, key: e.key === null ? null : resolveKey(e.key) })) };
    expect(validateTop100(resolved, DIRECTORY)).toEqual([]);
  });
});
