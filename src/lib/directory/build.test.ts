import { describe, expect, it } from 'vitest';
import {
  buildDirectory,
  countMappedHoles,
  mergeWithPrevious,
  normaliseCounty,
  safeWebsite,
  type DirectoryCourse,
  type OsmElement,
} from './build';

// A ~1.2 km x 1 km box around a point — comfortably a full course.
function way(id: number, name: string | null, lat: number, lon: number, tags: Record<string, string> = {}, size = 0.01): OsmElement {
  return {
    type: 'way',
    id,
    center: { lat, lon },
    bounds: { minlat: lat - size / 2, minlon: lon - size / 2, maxlat: lat + size / 2, maxlon: lon + size / 2 },
    tags: { leisure: 'golf_course', ...(name ? { name } : {}), ...tags },
  };
}
function hole(id: number, lat: number, lon: number, ref?: string): OsmElement {
  return { type: 'way', id, center: { lat, lon }, tags: { golf: 'hole', ...(ref ? { ref } : {}) } };
}
const input = (elements: OsmElement[], extra: Partial<Parameters<typeof buildDirectory>[0]> = {}) => ({
  courses: [{ country: 'IE' as const, elements }],
  holes: [],
  areaNames: new Map<string, string[]>(),
  ...extra,
});

describe('normaliseCounty', () => {
  it.each([
    ['County Dublin', 'Dublin'],
    ['Co. Kerry', 'Kerry'],
    ['Kerry County Council', 'Kerry'],
    ['Fingal', 'Dublin'],
    ['Dún Laoghaire-Rathdown', 'Dublin'],
    ['Cork City', 'Cork'],
    ['Limerick City and County', 'Limerick'],
    ['Contae na Mí / County Meath', 'Meath'],
    ['County Londonderry', 'Londonderry'],
    ['County Antrim', 'Antrim'],
  ])('%s -> %s', (raw, county) => expect(normaliseCounty(raw)).toBe(county));

  it.each(['Leinster', 'Belfast', 'Ireland', '', undefined])('%s -> null', (raw) => expect(normaliseCounty(raw)).toBeNull());
});

describe('safeWebsite', () => {
  it('keeps http(s) links and adds a scheme to a bare domain', () => {
    expect(safeWebsite('https://www.portmarnockgolfclub.ie/')).toBe('https://www.portmarnockgolfclub.ie/');
    expect(safeWebsite('elmparkgolfclub.ie')).toBe('https://elmparkgolfclub.ie/');
  });
  it('refuses anything that isn’t a web link', () => {
    expect(safeWebsite('javascript:alert(1)')).toBeNull();
    expect(safeWebsite('call the pro shop')).toBeNull();
    expect(safeWebsite(undefined)).toBeNull();
  });
});

describe('countMappedHoles', () => {
  it('counts distinct numbered holes, assigning each to the smallest box that contains it', () => {
    const big = way(1, 'Big Club', 53.4, -6.2, {}, 0.04);
    const small = way(2, 'Small Club', 53.4, -6.2, {}, 0.01);
    const holes = [
      ...Array.from({ length: 9 }, (_, i) => hole(100 + i, 53.4, -6.2, String(i + 1))),
      hole(200, 53.4, -6.2, '9'), // a second way for hole 9 (e.g. split fairway) isn't a 10th hole
      hole(300, 53.415, -6.2, '1'), // outside the small box, inside the big one
    ];
    const counts = countMappedHoles([big, small], holes);
    expect(counts.get('osm:way/2')).toBe(9);
    expect(counts.get('osm:way/1')).toBe(1);
  });
  it('falls back to counting ways when the holes aren’t numbered', () => {
    const c = way(1, 'Club', 53.4, -6.2);
    expect(countMappedHoles([c], [hole(1, 53.4, -6.2), hole(2, 53.4, -6.2)]).get('osm:way/1')).toBe(2);
  });
});

describe('buildDirectory', () => {
  it('builds an entry with county, rounded position, holes and website', () => {
    const e = way(10, 'Portmarnock Golf Club', 53.412345678, -6.123456789, { website: 'portmarnockgolfclub.ie' });
    const holes = Array.from({ length: 18 }, (_, i) => hole(100 + i, 53.4123, -6.1234, String(i + 1)));
    const { courses } = buildDirectory(input([e], { holes, areaNames: new Map([['osm:way/10', ['Leinster', 'Fingal']]]) }));
    expect(courses).toEqual([
      {
        key: 'osm:way/10',
        name: 'Portmarnock Golf Club',
        county: 'Dublin',
        country: 'IE',
        lat: 53.41235,
        lng: -6.12346,
        holes: 18,
        website: 'https://portmarnockgolfclub.ie/',
      },
    ]);
  });

  it('places an outline Overpass returned with bounds but no centre at the middle of its box', () => {
    const e: OsmElement = { type: 'way', id: 7, bounds: { minlat: 53.0, minlon: -7.02, maxlat: 53.02, maxlon: -7.0 }, tags: { leisure: 'golf_course', name: 'Box Only Golf Club' } };
    const hole18 = Array.from({ length: 18 }, (_, i) => hole(100 + i, 53.01, -7.01, String(i + 1)));
    const { courses, report } = buildDirectory(input([e], { holes: hole18 }));
    expect(courses.map((c) => [c.lat, c.lng, c.holes])).toEqual([[53.01, -7.01, 18]]);
    expect(report.noPosition).toEqual([]);
  });

  it('reports, rather than silently drops, a course with no position at all', () => {
    const e: OsmElement = { type: 'relation', id: 8, tags: { leisure: 'golf_course', name: 'Nowhere Golf Club' } };
    const { courses, report } = buildDirectory(input([e]));
    expect(courses).toEqual([]);
    expect(report.noPosition).toEqual(['osm:relation/8 Nowhere Golf Club']);
  });

  it('prefers a tagged hole count and ignores a mapped count that isn’t a whole number of nines', () => {
    const tagged = way(1, 'Tagged', 53, -7, { holes: '9' });
    const partial = way(2, 'Partly mapped', 54, -8);
    const holes = Array.from({ length: 7 }, (_, i) => hole(100 + i, 54, -8, String(i + 1)));
    const { courses } = buildDirectory(input([tagged, partial], { holes }));
    expect(courses.find((c) => c.key === 'osm:way/1')!.holes).toBe(9);
    expect(courses.find((c) => c.key === 'osm:way/2')!.holes).toBeNull();
  });

  it('leaves out unnamed features, pitch & putt, ranges and anything too small to be a course', () => {
    const { courses, report } = buildDirectory(
      input([
        way(1, null, 53, -7),
        way(2, 'Mulhuddart Pitch & Putt', 53.1, -7),
        way(3, 'Glen Pitch and Putt', 53.2, -7),
        way(4, 'City Driving Range', 53.3, -7),
        way(5, 'Tiny Practice Thing', 53.4, -7, {}, 0.001),
        way(6, 'Real Golf Club', 53.5, -7),
        way(7, "Mitchelstown Pitch n' Put", 53.6, -7),
        way(8, "Smuggler's Cove Adventure Golf", 53.7, -7),
        way(9, 'Enniskillen Golf Club', 54.3, -7.6, {}, 0.0003), // only the clubhouse is mapped
      ]),
    );
    expect(courses.map((c) => c.name)).toEqual(['Enniskillen Golf Club', 'Real Golf Club']);
    expect(report.unnamed).toBe(1);
    expect(report.notACourse).toHaveLength(5);
    expect(report.tooSmall).toHaveLength(1);
  });

  it('merges a clubhouse node into the same-named course outline nearby, keeping the outline', () => {
    const outline = way(1, 'Elm Park Golf Club', 53.315, -6.225);
    const node: OsmElement = { type: 'node', id: 9, lat: 53.316, lon: -6.226, tags: { leisure: 'golf_course', name: 'Elm Park Golf & Sports Club', website: 'https://elmparkgolfclub.ie' } };
    const { courses, report } = buildDirectory(input([node, outline]));
    expect(courses).toHaveLength(1);
    expect(courses[0]!.key).toBe('osm:way/1');
    expect(courses[0]!.website).toBe('https://elmparkgolfclub.ie/'); // borrowed from the dropped node
    expect(report.duplicates).toHaveLength(1);
  });

  it('keeps neighbours whose names merely start the same', () => {
    const { courses } = buildDirectory(input([way(1, 'Castle Golf Club', 53.3, -6.3), way(2, 'Castlerock Golf Club', 53.301, -6.301)]));
    expect(courses).toHaveLength(2);
  });

  it('keeps a separate "Links" course next to the club of the same name', () => {
    const { courses } = buildDirectory(input([way(1, 'Portmarnock Golf Club', 53.42, -6.12), way(2, 'Portmarnock Links', 53.41, -6.13)]));
    expect(courses.map((c) => c.name)).toEqual(['Portmarnock Golf Club', 'Portmarnock Links']);
  });

  it('names an unnamed feature from another name tag, or from an override', () => {
    const { courses, report } = buildDirectory(
      input([way(1, null, 53, -7, { operator: 'Operated Golf Club' }), way(2, null, 52.94, -9.35), way(3, null, 54, -8)]),
      { set: { 'osm:way/2': { name: 'Named By Override' } } },
    );
    expect(courses.map((c) => c.name)).toEqual(['Named By Override', 'Operated Golf Club']);
    expect(report.unnamedList).toEqual(['osm:way/3 (54.0000, -8.0000)']);
  });

  it('keeps same-named courses that are far apart', () => {
    const { courses } = buildDirectory(input([way(1, 'Castle Golf Club', 53.3, -6.3), way(2, 'Castle Golf Club', 52.0, -9.0)]));
    expect(courses).toHaveLength(2);
  });

  it('applies overrides: exclude, set and add', () => {
    const { courses } = buildDirectory(input([way(1, 'Old Name', 53, -7), way(2, 'Gone', 53.5, -7)]), {
      exclude: { 'osm:way/2': 'duplicate of something' },
      set: { 'osm:way/1': { name: 'New Name', holes: 18, county: 'Offaly' } },
      add: [{ key: 'manual:the-island', name: 'The Island Golf Club', county: 'Dublin', country: 'IE', lat: 53.47, lng: -6.13, holes: 18, website: null }],
    });
    expect(courses.map((c) => [c.key, c.name, c.holes, c.county])).toEqual([
      ['osm:way/1', 'New Name', 18, 'Offaly'],
      ['manual:the-island', 'The Island Golf Club', 18, 'Dublin'],
    ]);
  });

  it('refuses an added course without a manual: key, and a county that isn’t one of the 32', () => {
    const bad = { key: 'osm:way/5', name: 'X', county: null, country: 'IE' as const, lat: 53, lng: -7, holes: null, website: null };
    expect(() => buildDirectory(input([]), { add: [bad] })).toThrow(/manual:/);
    expect(() => buildDirectory(input([way(1, 'X', 53, -7)]), { set: { 'osm:way/1': { county: 'Leinster' } } })).toThrow(/32/);
  });

  it('counts an element returned for both countries once', () => {
    const e = way(1, 'Border Golf Club', 54.2, -7.5);
    const { courses } = buildDirectory({ courses: [{ country: 'IE', elements: [e] }, { country: 'NI', elements: [e] }], holes: [], areaNames: new Map() });
    expect(courses).toHaveLength(1);
  });
});

describe('mergeWithPrevious', () => {
  const c = (key: string, name: string): DirectoryCourse => ({ key, name, county: null, country: 'IE', lat: 53, lng: -7, holes: null, website: null });

  it('carries over a course that vanished from OSM, flagged stale, so played lists keep it', () => {
    const { courses, carried } = mergeWithPrevious([c('osm:way/1', 'A')], [c('osm:way/1', 'A'), c('osm:way/2', 'B')]);
    expect(courses.map((x) => [x.key, x.stale ?? false])).toEqual([
      ['osm:way/1', false],
      ['osm:way/2', true],
    ]);
    expect(carried).toHaveLength(1);
  });

  it('un-stales a course that came back, and drops one that was excluded on purpose', () => {
    const prev = [{ ...c('osm:way/1', 'A'), stale: true as const }, c('osm:way/2', 'B')];
    const { courses } = mergeWithPrevious([c('osm:way/1', 'A')], prev, { exclude: { 'osm:way/2': 'not a course' } });
    expect(courses).toEqual([c('osm:way/1', 'A')]);
  });
});
