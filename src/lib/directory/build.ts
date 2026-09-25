/**
 * Builds the course directory (every golf course on the island of Ireland, with a map position)
 * from OpenStreetMap data. Pure — `scripts/fetch-course-directory.ts` does the network calls and
 * file writes; everything that decides what ends up in the directory lives here and is tested.
 *
 * The directory is deliberately separate from `courses` (the scorecard library): a directory entry
 * is just "this course exists, here" — enough to tick it off as played and plot it. A scorecard
 * course can be linked to its directory entry (`courses.directory_key`), so logging a round there
 * marks it played automatically.
 *
 * Keys are `osm:<type>/<id>` (or `manual:<slug>` for entries added in overrides.json) and are what
 * `played_courses` stores, so they must stay stable: a course that vanishes from OSM on a refresh
 * is carried over from the previous file (flagged `stale`) rather than dropped — see `mergeWithPrevious`.
 */

export type Country = 'IE' | 'NI';

export type DirectoryCourse = {
  key: string;
  name: string;
  /** One of the 32 traditional counties (`COUNTIES`), or null when it couldn't be placed. */
  county: string | null;
  country: Country;
  lat: number;
  lng: number;
  /** 9, 18, 27, 36… when known (tagged, or counted from mapped holes); null = unknown. */
  holes: number | null;
  website: string | null;
  /** In the previous file but gone from OSM on the latest fetch; kept so played lists don't break. */
  stale?: true;
};

/** The subset of an Overpass `out tags center bb` element we use. */
export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
};

export type Overrides = {
  /** key -> reason. Dropped from the directory (pitch & putt, driving ranges, duplicates…). */
  exclude?: Record<string, string>;
  /** key -> fields to overwrite (a clearer name, a missing hole count or county…). */
  set?: Record<string, Partial<Pick<DirectoryCourse, 'name' | 'county' | 'holes' | 'website' | 'lat' | 'lng'>>>;
  /** Courses OSM doesn't have. Keys must start with `manual:`. */
  add?: DirectoryCourse[];
};

export const COUNTIES = [
  // Republic of Ireland (26)
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare', 'Kilkenny',
  'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
  // Northern Ireland (6)
  'Antrim', 'Armagh', 'Down', 'Fermanagh', 'Londonderry', 'Tyrone',
] as const;

/** Local authorities whose name isn't simply "<County> County Council". */
const AUTHORITY_TO_COUNTY: Record<string, string> = {
  fingal: 'Dublin',
  'dún laoghaire-rathdown': 'Dublin',
  'dun laoghaire-rathdown': 'Dublin',
  'south dublin': 'Dublin',
  'dublin city': 'Dublin',
  'cork city': 'Cork',
  'galway city': 'Galway',
  'limerick city and county': 'Limerick',
  'waterford city and county': 'Waterford',
  'north tipperary': 'Tipperary',
  'south tipperary': 'Tipperary',
  derry: 'Londonderry',
};

/**
 * "County Dublin", "Co. Kerry", "Kerry County Council", "Contae Chiarraí / County Kerry", "Fingal"
 * -> the traditional county, or null if the name isn't one of the 32.
 */
export function normaliseCounty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Bilingual names ("Contae na Mí / County Meath"): take the English half.
  const english = (raw.includes('/') ? raw.split('/').pop()! : raw).trim();
  const whole = AUTHORITY_TO_COUNTY[english.toLowerCase().replace(/\s+council$/, '')];
  if (whole) return whole;
  const s = english
    .replace(/^(county|co\.?)\s+/i, '')
    .replace(/\s+(county council|city council|county|council)$/i, '')
    .trim();
  const mapped = AUTHORITY_TO_COUNTY[s.toLowerCase()];
  if (mapped) return mapped;
  return COUNTIES.find((c) => c.toLowerCase() === s.toLowerCase()) ?? null;
}

export function elementKey(e: Pick<OsmElement, 'type' | 'id'>): string {
  return `osm:${e.type}/${e.id}`;
}

/** Names that are something other than a golf course. Pitch & putt is its own sport here. */
const NOT_A_COURSE =
  /pitch\s*(&|and|'?n'?|-)\s*putt|p\s*&\s*p\b|driving\s+range|golf\s+range|practice\s+(ground|range|area)|mini(ature)?\s*golf|crazy\s+golf|foot\s*golf|disc\s+golf|putting\s+(green|course)/i;

/** Rough distance in metres (equirectangular — plenty for a few km at Irish latitudes). */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.hypot(x, y) * R;
}

function bboxDiagonal(b: NonNullable<OsmElement['bounds']>): number {
  return metresBetween({ lat: b.minlat, lng: b.minlon }, { lat: b.maxlat, lng: b.maxlon });
}

/** Anything smaller corner-to-corner than this is a pitch & putt, range or practice area, not a course. */
export const MIN_COURSE_DIAGONAL_M = 250;

export function safeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().split(/[;\s]/)[0]!;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s) ? `https://${s}` : null;
  if (!withScheme) return null;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function tagHoles(tags: Record<string, string>): number | null {
  const raw = tags['holes'] ?? tags['golf:holes'] ?? tags['golf:course:holes'];
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 9 && n <= 72 ? n : null;
}

/**
 * Holes mapped inside each course (`golf=hole` ways), matched to the SMALLEST course bounding box
 * that contains the hole's centre (neighbouring clubs' boxes often overlap). Returns key -> count,
 * counting distinct `ref`s when the holes are numbered, else the ways themselves.
 */
export function countMappedHoles(courses: OsmElement[], holes: OsmElement[]): Map<string, number> {
  const boxes = courses
    .filter((c) => c.bounds)
    .map((c) => ({ key: elementKey(c), b: c.bounds!, area: (c.bounds!.maxlat - c.bounds!.minlat) * (c.bounds!.maxlon - c.bounds!.minlon) }))
    .sort((a, b) => a.area - b.area);
  const refs = new Map<string, Set<string>>();
  const ways = new Map<string, number>();
  for (const h of holes) {
    const p = h.center ?? (h.lat !== undefined && h.lon !== undefined ? { lat: h.lat, lon: h.lon } : null);
    if (!p) continue;
    const box = boxes.find(({ b }) => p.lat >= b.minlat && p.lat <= b.maxlat && p.lon >= b.minlon && p.lon <= b.maxlon);
    if (!box) continue;
    ways.set(box.key, (ways.get(box.key) ?? 0) + 1);
    const ref = h.tags?.ref?.trim();
    if (ref && /^\d{1,2}$/.test(ref)) {
      if (!refs.has(box.key)) refs.set(box.key, new Set());
      refs.get(box.key)!.add(String(Number(ref)));
    }
  }
  const out = new Map<string, number>();
  for (const [key, n] of ways) out.set(key, refs.get(key)?.size || n);
  return out;
}

/** A mapped-hole count is only trusted when it's a whole number of nines (9, 18, 27…). */
function trustedHoleCount(n: number | undefined): number | null {
  return n !== undefined && n >= 9 && n % 9 === 0 ? n : null;
}

export type BuildInput = {
  /** Golf courses per country (`leisure=golf_course`, `out tags center bb`). */
  courses: { country: Country; elements: OsmElement[] }[];
  /** `golf=hole` ways across the island (`out tags center`). */
  holes: OsmElement[];
  /** key -> names of every administrative area the course lies in (county, local authority, province…). */
  areaNames: Map<string, string[]>;
};

export type BuildReport = {
  unnamed: number;
  notACourse: string[];
  tooSmall: string[];
  duplicates: string[];
  noCounty: string[];
};

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(golf|club|course|links|gc|the|and|&|country|resort|hotel)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/** "Elm Park Golf Club" and "Elm Park Golf & Sports Club" are the same club; "Castle" and "Castlerock" aren't. */
function sameClub(a: string, b: string): boolean {
  const [x, y] = [normName(a), normName(b)];
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.startsWith(short) && sameWords(a, b);
}
/** Every significant word of the shorter name appears in the longer one. */
function sameWords(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !/^(golf|club|course|links|gc|the|and|country|resort|hotel)$/.test(w));
  const [wa, wb] = [words(a), words(b)];
  const [short, long] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return short.every((w) => long.has(w));
}

export function buildDirectory(input: BuildInput, overrides: Overrides = {}): { courses: DirectoryCourse[]; report: BuildReport } {
  const report: BuildReport = { unnamed: 0, notACourse: [], tooSmall: [], duplicates: [], noCounty: [] };
  const mapped = countMappedHoles(input.courses.flatMap((c) => c.elements), input.holes);

  type Candidate = DirectoryCourse & { diag: number };
  const candidates: Candidate[] = [];
  const seenKeys = new Set<string>();
  for (const { country, elements } of input.courses) {
    for (const e of elements) {
      const key = elementKey(e);
      if (seenKeys.has(key)) continue; // an element on a border can come back in both countries
      seenKeys.add(key);
      const tags = e.tags ?? {};
      const name = (tags['name:en'] ?? tags.name ?? '').trim();
      if (!name) {
        report.unnamed++;
        continue;
      }
      if (overrides.exclude?.[key]) continue;
      if (NOT_A_COURSE.test(name) || tags.golf === 'pitch_and_putt' || tags['golf:course'] === 'pitch_and_putt') {
        report.notACourse.push(`${key} ${name}`);
        continue;
      }
      const diag = e.bounds ? bboxDiagonal(e.bounds) : 0;
      if (e.bounds && diag < MIN_COURSE_DIAGONAL_M) {
        report.tooSmall.push(`${key} ${name} (${Math.round(diag)}m)`);
        continue;
      }
      const p = e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null);
      if (!p) continue;
      const county =
        (input.areaNames.get(key) ?? []).map(normaliseCounty).find((c) => c !== null) ?? normaliseCounty(tags['addr:county']);
      candidates.push({
        key,
        name,
        county,
        country,
        lat: round5(p.lat),
        lng: round5(p.lon),
        holes: tagHoles(tags) ?? trustedHoleCount(mapped.get(key)),
        website: safeWebsite(tags.website ?? tags['contact:website'] ?? tags.url),
        diag,
      });
    }
  }

  // The same club is often mapped twice (a node for the clubhouse, a way for the course). Keep the
  // biggest outline among same-named entries within 3 km of each other.
  candidates.sort((a, b) => b.diag - a.diag || a.key.localeCompare(b.key));
  const kept: Candidate[] = [];
  for (const c of candidates) {
    const dupe = kept.find((k) => sameClub(k.name, c.name) && metresBetween(k, c) < 3000);
    if (dupe) {
      report.duplicates.push(`${c.key} ${c.name} (same as ${dupe.key})`);
      if (dupe.holes === null && c.holes !== null) dupe.holes = c.holes;
      if (dupe.website === null && c.website !== null) dupe.website = c.website;
      continue;
    }
    kept.push(c);
  }

  const byKey = new Map<string, DirectoryCourse>();
  for (const { diag: _diag, ...c } of kept) byKey.set(c.key, c);
  for (const a of overrides.add ?? []) {
    if (!a.key.startsWith('manual:')) throw new Error(`overrides.add key must start with "manual:": ${a.key}`);
    byKey.set(a.key, { ...a });
  }
  for (const [key, patch] of Object.entries(overrides.set ?? {})) {
    const c = byKey.get(key);
    if (!c) continue; // may simply be missing from this fetch; mergeWithPrevious handles that
    Object.assign(c, patch);
  }
  for (const c of byKey.values()) {
    if (c.county !== null && !(COUNTIES as readonly string[]).includes(c.county)) {
      throw new Error(`${c.key} has county "${c.county}", which isn't one of the 32`);
    }
    if (c.county === null) report.noCounty.push(`${c.key} ${c.name}`);
  }

  return { courses: sortDirectory([...byKey.values()]), report };
}

export function sortDirectory(list: DirectoryCourse[]): DirectoryCourse[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.key.localeCompare(b.key));
}

/**
 * Keys are referenced by players' played lists, so a course that has disappeared from OSM (deleted,
 * re-drawn with a new id, or temporarily broken) is carried over from the previous directory and
 * flagged `stale` instead of silently vanishing. Excluding it in overrides.json drops it for real.
 */
export function mergeWithPrevious(
  next: DirectoryCourse[],
  previous: DirectoryCourse[],
  overrides: Overrides = {},
): { courses: DirectoryCourse[]; carried: DirectoryCourse[] } {
  const keys = new Set(next.map((c) => c.key));
  const carried = previous
    .filter((p) => !keys.has(p.key) && !overrides.exclude?.[p.key])
    .map((p) => ({ ...p, stale: true as const }));
  const fresh = next.map((c) => {
    const { stale: _stale, ...rest } = c;
    return rest;
  });
  return { courses: sortDirectory([...fresh, ...carried]), carried };
}
