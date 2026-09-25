import { describe, expect, it } from 'vitest';
import { buildPlayedProfile, matchesQuery } from './profile';
import type { DirectoryCourse } from './build';

const c = (key: string, name: string, county: string | null, holes: number | null): DirectoryCourse => ({
  key,
  name,
  county,
  country: 'IE',
  lat: 53,
  lng: -6,
  holes,
  website: null,
});
const DIR = [
  c('osm:way/1', 'Portmarnock Golf Club', 'Dublin', 27),
  c('osm:way/2', 'Elm Park Golf Club', 'Dublin', 18),
  c('osm:way/3', 'Lahinch Golf Club', 'Clare', 18),
  c('osm:way/4', 'Kilkea Castle', 'Kildare', 9),
  c('osm:way/5', 'Mystery Links', null, null),
];

describe('buildPlayedProfile', () => {
  it('combines ticked-off courses with courses that have logged rounds', () => {
    const p = buildPlayedProfile(DIR, ['osm:way/3', 'osm:way/2'], [
      { directoryKey: 'osm:way/2', playedOn: '2026-05-01' },
      { directoryKey: 'osm:way/2', playedOn: '2026-07-12' },
      { directoryKey: 'osm:way/1', playedOn: '2026-06-01' },
    ]);
    expect(p.played.map((e) => [e.course.name, e.ticked, e.rounds, e.lastPlayed])).toEqual([
      ['Elm Park Golf Club', true, 2, '2026-07-12'],
      ['Lahinch Golf Club', true, 0, null],
      ['Portmarnock Golf Club', false, 1, '2026-06-01'],
    ]);
    expect(p.stats).toEqual({ played: 3, total: 5, eighteen: 2, nine: 0, other: 1, counties: 2, totalCounties: 32, top100: 0, totalTop100: 0 });
  });

  it('counts per county across all 32, including counties with no courses played', () => {
    const p = buildPlayedProfile(DIR, ['osm:way/4'], []);
    expect(p.byCounty).toHaveLength(32);
    expect(p.byCounty.find((b) => b.county === 'Dublin')).toEqual({ county: 'Dublin', played: 0, total: 2 });
    expect(p.byCounty.find((b) => b.county === 'Kildare')).toEqual({ county: 'Kildare', played: 1, total: 1 });
    expect(p.stats.nine).toBe(1);
  });

  it('reports ticked keys that are no longer in the directory, and ignores unlinked rounds', () => {
    const p = buildPlayedProfile(DIR, ['osm:way/999', 'osm:way/5', 'osm:way/5'], [{ directoryKey: 'osm:way/998', playedOn: '2026-01-01' }]);
    expect(p.unknownKeys).toEqual(['osm:way/999']);
    expect(p.played.map((e) => e.course.key)).toEqual(['osm:way/5']);
    expect(p.stats.counties).toBe(0); // no county on file doesn't count as one
  });

  it('counts ranked courses played against ranked courses in the directory', () => {
    const rank = new Map([['osm:way/1', 3], ['osm:way/3', 7], ['osm:way/999', 1]]);
    const p = buildPlayedProfile(DIR, ['osm:way/3', 'osm:way/2'], [], rank);
    expect([p.stats.top100, p.stats.totalTop100]).toEqual([1, 2]);
  });

  it('is empty for a new player', () => {
    const p = buildPlayedProfile(DIR, [], []);
    expect(p.played).toEqual([]);
    expect(p.stats.played).toBe(0);
  });
});

describe('matchesQuery', () => {
  it('matches every word against name and county, ignoring case and accents', () => {
    expect(matchesQuery(c('k', 'Dún Laoghaire Golf Club', 'Wicklow', 27), 'dun laoghaire')).toBe(true);
    expect(matchesQuery(DIR[2]!, 'clare lahinch')).toBe(true);
    expect(matchesQuery(DIR[2]!, 'lahinch kerry')).toBe(false);
    expect(matchesQuery(DIR[2]!, '  ')).toBe(true);
  });
});
