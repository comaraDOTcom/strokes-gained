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
  /**
   * old key -> current key, for a course retired by hand (typically a `manual:` entry once OSM maps
   * the club), so a player's tick on the old key still counts. Remove the `add` in the same edit.
   */
  alias?: Record<string, string>;
};

export const COUNTIES = [
  // Republic of Ireland (26)
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare', 'Kilkenny',
  'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
  // Northern Ireland (6)
  'Antrim', 'Armagh', 'Derry', 'Down', 'Fermanagh', 'Tyrone',
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
  // Shown as Derry; OSM (and some councils) call it County Londonderry.
  londonderry: 'Derry',
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

/** The county a course's name names, as a whole word ("Waterford Golf Club", "County Sligo GC"), or null. */
export function countyInName(name: string): string | null {
  for (const word of name.split(/[^A-Za-z]+/)) {
    const c = word === 'Londonderry' ? 'Derry' : word;
    if ((COUNTIES as readonly string[]).includes(c)) return c;
  }
  return null;
}

export function elementKey(e: Pick<OsmElement, 'type' | 'id'>): string {
  return `osm:${e.type}/${e.id}`;
}

/** Names that are something other than a full golf course. Pitch & putt and par-3 courses are their own thing here. */
const NOT_A_COURSE =
  /pitch\s*(&|and|'?n'?|-)\s*putt?|p\s*&\s*p\b|driving\s+range|golf\s+range|practice\s+(ground|range|area)|mini(ature)?\s*golf|crazy\s+golf|adventure\s+golf|foot\s*golf|disc\s+golf|putting\s+(green|course)|\bpar[\s-]*3\b|football|(practice|golf)\s+academy|\b[1-8][\s-]*holes?\b/i;

/** Words that make a name identify a venue on its own. */
const CLUB_WORDS = /golf|links|club|resort|hotel|house|\bG\.?C\.?\b/i;

/** "The O'Meara", "Old Course", "Lackabane Course": a course's own name, with no club in it. */
export function isGenericName(name: string): boolean {
  return !CLUB_WORDS.test(name) && (/\bcourse$/i.test(name.trim()) || /^the\s+/i.test(name.trim()));
}

/** A name that says it's a real club: a tiny outline with this name is the clubhouse, not the course. */
const CLUB_NAME = /golf\s+(club|course|links)|\blinks\b|\bG\.?C\.?$/i;

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

/**
 * Where to put an element: a node's own position, else Overpass's `center`, else the middle of its
 * bounding box. (`out center bb` returns only the bounds for ways and relations — `center` and
 * `bb` are alternative geometry modes, and the last one wins.)
 */
export function position(e: OsmElement): { lat: number; lon: number } | null {
  if (e.lat !== undefined && e.lon !== undefined) return { lat: e.lat, lon: e.lon };
  if (e.center) return e.center;
  if (e.bounds) return { lat: (e.bounds.minlat + e.bounds.maxlat) / 2, lon: (e.bounds.minlon + e.bounds.maxlon) / 2 };
  return null;
}

/**
 * Anything smaller corner-to-corner than this is a pitch & putt, range or practice area, not a course
 * — unless it's named as a golf club, when it's the clubhouse outline standing in for the course.
 */
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
    const p = position(h);
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
  /** Unnamed features, with a position, so one that is a real course can be named in overrides.json. */
  unnamedList: string[];
  /** No coordinates, no centre and no bounds — can't be put on a map. */
  noPosition: string[];
  notACourse: string[];
  tooSmall: string[];
  duplicates: string[];
  noCounty: string[];
  /** Venue-less course names given their venue's name ("The O'Meara" -> "Carton House – The O'Meara"). */
  namedAfterVenue: string[];
  /** Courses whose name names a different county than the boundary they sit in (the name wins). */
  countyFromName: string[];
  /** Keys left out on purpose by a rule (not a course, too small, duplicate), for `mergeWithPrevious`. */
  filteredKeys: Set<string>;
};

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(golf|club|course|gc|the|and|&|country|resort|hotel)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * "Elm Park Golf Club" and "Elm Park Golf & Sports Club" are the same club; "Castle" and "Castlerock"
 * aren't, and neither are "Portmarnock Golf Club" and "Portmarnock Links" ("links" is kept: it
 * usually names a separate course).
 */
function sameClub(a: string, b: string): boolean {
  const [x, y] = [normName(a), normName(b)];
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.startsWith(short) && sameWords(a, b);
}
/**
 * Every significant word of the shorter name appears in the longer one, and whatever the longer name
 * adds is generic ("& Sports", "Resort") — not a word that names a different course ("Links", "North").
 */
const INSIGNIFICANT = /^(golf|club|course|gc|the|and|country|resort|hotel)$/;
const GENERIC_EXTRA = /^(sports|leisure|spa|society|ltd|limited|estate|park|centre|center)$/;
function sameWords(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !INSIGNIFICANT.test(w));
  const [wa, wb] = [words(a), words(b)];
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  const shortSet = new Set(short);
  return short.every((w) => long.includes(w)) && long.filter((w) => !shortSet.has(w)).every((w) => GENERIC_EXTRA.test(w));
}

export function buildDirectory(input: BuildInput, overrides: Overrides = {}): { courses: DirectoryCourse[]; report: BuildReport } {
  const report: BuildReport = { unnamed: 0, unnamedList: [], noPosition: [], notACourse: [], tooSmall: [], duplicates: [], noCounty: [], countyFromName: [], namedAfterVenue: [], filteredKeys: new Set() };
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
      // An override can name a feature OSM left unnamed (it's listed in the report with its key).
      const name = (overrides.set?.[key]?.name ?? tags['name:en'] ?? tags.name ?? tags.official_name ?? tags.operator ?? '').trim();
      if (!name) {
        report.unnamed++;
        const p = position(e);
        report.unnamedList.push(`${key}${p ? ` (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})` : ''}`);
        continue;
      }
      if (overrides.exclude?.[key]) continue;
      if (NOT_A_COURSE.test(name) || tags.golf === 'pitch_and_putt' || tags['golf:course'] === 'pitch_and_putt') {
        report.notACourse.push(`${key} ${name}`);
        report.filteredKeys.add(key);
        continue;
      }
      const diag = e.bounds ? bboxDiagonal(e.bounds) : 0;
      if (e.bounds && diag < MIN_COURSE_DIAGONAL_M && !CLUB_NAME.test(name)) {
        report.tooSmall.push(`${key} ${name} (${Math.round(diag)}m)`);
        report.filteredKeys.add(key);
        continue;
      }
      const p = position(e);
      if (!p) {
        report.noPosition.push(`${key} ${name}`);
        continue;
      }
      const areaCounty =
        (input.areaNames.get(key) ?? []).map(normaliseCounty).find((c) => c !== null) ?? normaliseCounty(tags['addr:county']);
      // A club named after a county belongs to it, even when the course sits just over the boundary
      // (Waterford GC is north of the Suir, inside Kilkenny's boundary).
      const namedCounty = countyInName(name);
      if (namedCounty && areaCounty && namedCounty !== areaCounty) report.countyFromName.push(`${key} ${name}: ${areaCounty} -> ${namedCounty}`);
      const county = namedCounty ?? areaCounty;
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
      report.filteredKeys.add(c.key);
      if (dupe.holes === null && c.holes !== null) dupe.holes = c.holes;
      if (dupe.website === null && c.website !== null) dupe.website = c.website;
      continue;
    }
    kept.push(c);
  }

  // One course of a multi-course venue is often mapped with only its own name ("The O'Meara",
  // "Old Course"). Put the venue in front: the nearest club-named course within 2 km.
  for (const c of kept) {
    if (!isGenericName(c.name)) continue;
    const venue = kept
      .filter((k) => k !== c && !isGenericName(k.name) && CLUB_WORDS.test(k.name) && metresBetween(k, c) < 2000)
      .sort((a, b) => metresBetween(a, c) - metresBetween(b, c))[0];
    if (!venue) continue;
    const renamed = `${venue.name} – ${c.name.replace(/^the\s+/i, 'The ')}`;
    report.namedAfterVenue.push(`${c.key} ${c.name} -> ${renamed}`);
    c.name = renamed;
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
 * Also keeps a previously known hole count when the new fetch has none, and turns a course that was
 * re-keyed in OSM (same name, same place, new id) into an alias `old key -> new key`.
 *
 * Keys are referenced by players' played lists, so a course that has disappeared from OSM (deleted,
 * re-drawn with a new id, or temporarily broken) is carried over from the previous directory and
 * flagged `stale` instead of silently vanishing. Excluding it in overrides.json drops it for real, and
 * so does a filter rule that now leaves it out on purpose (`filtered`: a par 3, a pitch & putt, a
 * duplicate) — those didn't vanish, they were judged not to be courses.
 */
export function mergeWithPrevious(
  next: DirectoryCourse[],
  previous: DirectoryCourse[],
  overrides: Overrides = {},
  filtered: ReadonlySet<string> = new Set(),
  previousAliases: Readonly<Record<string, string>> = {},
): { courses: DirectoryCourse[]; carried: DirectoryCourse[]; aliases: Record<string, string> } {
  const keys = new Set(next.map((c) => c.key));
  const aliases: Record<string, string> = {};
  const carried: DirectoryCourse[] = [];
  for (const p of previous) {
    if (keys.has(p.key) || overrides.exclude?.[p.key] || filtered.has(p.key)) continue;
    const pinned = overrides.alias?.[p.key];
    if (pinned && keys.has(pinned)) {
      aliases[p.key] = pinned;
      continue;
    }
    // Re-keyed in OSM (the same club, re-drawn with a new id): point the old key at the new one, so a
    // tick on the old key still counts, instead of keeping a stale copy of the same course.
    const successor = next.find((c) => sameClub(c.name, p.name) && metresBetween(c, p) < 3000);
    if (successor) aliases[p.key] = successor.key;
    else carried.push({ ...p, stale: true as const });
  }
  // Keep earlier aliases, following any chain (a -> b, b -> c) to a key that still exists.
  const live = new Set([...keys, ...carried.map((c) => c.key)]);
  for (const [from, to] of Object.entries({ ...previousAliases, ...aliases })) {
    let target = to;
    for (let hops = 0; !live.has(target) && (aliases[target] ?? previousAliases[target]) && hops < 10; hops++) {
      target = aliases[target] ?? previousAliases[target]!;
    }
    if (live.has(target) && !live.has(from)) aliases[from] = target;
    else delete aliases[from];
  }
  const before = new Map(previous.map((p) => [p.key, p]));
  const fresh = next.map((c) => {
    const { stale: _stale, ...rest } = c;
    // Mapped holes come and go with how complete the fetch was; a known count never reverts to unknown.
    const was = before.get(c.key);
    if (rest.holes === null && was?.holes) rest.holes = was.holes;
    return rest;
  });
  return { courses: sortDirectory([...fresh, ...carried]), carried, aliases: sortKeys(aliases) };
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}
