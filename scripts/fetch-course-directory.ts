/**
 * Refresh the Ireland course directory (`src/lib/directory/data/ireland.json`) from OpenStreetMap.
 *
 *   pnpm directory:fetch
 *
 * Three Overpass queries (courses per country, mapped holes, and which county each course is in),
 * then `buildDirectory` (filters, de-duplicates, counts holes, applies `overrides.json`) and
 * `mergeWithPrevious` (never silently drops a key a player may have ticked off). Writes the file
 * only when the courses actually changed. Prints a report of everything it left out so a human
 * can add an override where it got something wrong.
 *
 * Also run by `.github/workflows/course-directory.yml`, because Overpass isn't reachable from
 * every sandbox. Data © OpenStreetMap contributors, ODbL — the app credits it wherever it's shown.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { resolve } from 'node:path';
import {
  buildDirectory,
  elementKey,
  mergeWithPrevious,
  type Country,
  type DirectoryCourse,
  type OsmElement,
  type Overrides,
} from '../src/lib/directory/build';

// Public Overpass instances, tried in turn. OVERPASS_URL puts your own choice first.
const ENDPOINTS = [
  process.env.OVERPASS_URL,
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
].filter((u): u is string => Boolean(u));

// Node's default 250 ms per-address connect attempt (IPv6 vs IPv4 racing) times out on some CI
// runners before a slow Overpass host answers.
setDefaultAutoSelectFamilyAttemptTimeout(5_000);

const DATA = resolve(import.meta.dirname, '../src/lib/directory/data');
const OUT = resolve(DATA, 'ireland.json');
const OVERRIDES = resolve(DATA, 'overrides.json');

/** More than this many courses vanishing, or lacking a county, in one refresh means a bad fetch. */
const MAX_VANISHED = 3;
const MAX_NO_COUNTY = 3;

const AREAS: Record<Country, string> = {
  IE: 'area["ISO3166-1"="IE"]["admin_level"="2"]',
  NI: 'area["ISO3166-2"="GB-NIR"]',
};

/**
 * One query against ONE Overpass server, retried there (3 attempts, backing off). Mirrors differ
 * slightly in what they hold, so a refresh never mixes servers — see `fetchAll`.
 */
async function overpass(url: string, query: string): Promise<any[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'strokes-gained course directory (https://github.com/comaraDOTcom/strokes-gained)',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(10 * 60_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { elements: any[]; remark?: string };
        // A timed-out or memory-limited query still answers 200, with PARTIAL elements and a remark.
        if (!body.remark || !/error|timed out|out of memory/i.test(body.remark)) return body.elements;
        throw new Error(`partial result: ${body.remark}`);
      }
      lastError = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      // A 4xx other than rate limiting means the query itself is wrong: don't retry it.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw Object.assign(lastError as Error, { fatal: true });
    } catch (err) {
      if ((err as { fatal?: boolean }).fatal) throw err;
      lastError = err;
    }
    console.warn(`Overpass ${url} attempt ${attempt} failed: ${lastError instanceof Error ? lastError.message : lastError}`);
    if (attempt < 3) await new Promise((r) => setTimeout(r, 20_000 * attempt));
  }
  throw lastError;
}

async function fetchCourses(url: string, country: Country): Promise<OsmElement[]> {
  return overpass(url, `[out:json][timeout:300];
${AREAS[country]}->.a;
nwr["leisure"="golf_course"](area.a);
out tags center bb;`);
}

async function fetchHoles(url: string): Promise<OsmElement[]> {
  return overpass(url, `[out:json][timeout:300];
${AREAS.IE}->.ie;
${AREAS.NI}->.ni;
(way["golf"="hole"](area.ie); way["golf"="hole"](area.ni););
out tags center;`);
}

/**
 * Every named administrative area (levels 5–8, plus Northern Ireland's historic counties) with the
 * golf courses inside it. Which level holds "the county" differs between the Republic (local
 * authorities, e.g. Fingal) and the North, so all are collected and `normaliseCounty` picks the one
 * that names a county.
 */
async function fetchAreaNames(url: string): Promise<Map<string, string[]>> {
  const elements = await overpass(url, `[out:json][timeout:600];
${AREAS.IE}->.ie;
${AREAS.NI}->.ni;
(
  rel(area.ie)["boundary"="administrative"]["admin_level"~"^[5-8]$"];
  rel(area.ni)["boundary"~"^(administrative|historic|ceremonial)$"]["admin_level"~"^[5-8]$"];
  rel(area.ni)["border_type"="county"];
)->.rels;
.rels map_to_area->.areas;
foreach.areas->.c(
  .c out tags;
  nwr(area.c)["leisure"="golf_course"];
  out ids;
);`);
  const names = new Map<string, string[]>();
  const levels = new Map<string, number>();
  let current: { name: string; level: number } | null = null;
  const seen = new Map<string, number>();
  for (const e of elements) {
    if (e.type === 'area') {
      const name = e.tags?.['name:en'] ?? e.tags?.name;
      current = name ? { name, level: Number(e.tags?.admin_level ?? 99) } : null;
      if (current) seen.set(`${current.level} ${current.name}`, 0);
      continue;
    }
    if (!current) continue;
    const key = elementKey(e);
    if (!names.has(key)) names.set(key, []);
    names.get(key)!.push(current.name);
    levels.set(`${key}|${current.name}`, current.level);
    seen.set(`${current.level} ${current.name}`, (seen.get(`${current.level} ${current.name}`) ?? 0) + 1);
  }
  // Lowest admin level first, so a county wins over a smaller area that happens to share its name.
  for (const [key, list] of names) list.sort((a, b) => levels.get(`${key}|${a}`)! - levels.get(`${key}|${b}`)!);
  console.log(`Areas seen (level name: courses): ${[...seen].map(([k, n]) => `${k}: ${n}`).join('; ')}`);
  return names;
}

function readPrevious(): { fetchedAt: string | null; courses: DirectoryCourse[]; aliases: Record<string, string> } {
  if (!existsSync(OUT)) return { fetchedAt: null, courses: [], aliases: {} };
  const j = JSON.parse(readFileSync(OUT, 'utf8'));
  return { fetchedAt: j.fetchedAt ?? null, courses: j.courses ?? [], aliases: j.aliases ?? {} };
}

/** One course per line, so a refresh reads as a clean diff. */
function serialise(fetchedAt: string, courses: DirectoryCourse[], aliases: Record<string, string>): string {
  const head = {
    source: 'OpenStreetMap (leisure=golf_course), via the Overpass API',
    licence: 'Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    fetchedAt,
    // Keys OSM re-numbered: old -> current, so players' ticks on the old key still count.
    aliases,
  };
  const lines = courses.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
  return `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "courses": [\n${lines}\n  ]\n}\n`;
}

/**
 * All four queries from the SAME server: the first that answers every one of them. Mixing servers
 * made refreshes flip between a club's outline and its relation (different ids each run).
 */
async function fetchAll() {
  let lastError: unknown;
  for (const url of ENDPOINTS) {
    try {
      const ie = await fetchCourses(url, 'IE');
      const ni = await fetchCourses(url, 'NI');
      console.log(`Fetched ${ie.length} IE + ${ni.length} NI golf_course elements from ${url}`);
      const holes = await fetchHoles(url);
      console.log(`Fetched ${holes.length} mapped holes`);
      const areaNames = await fetchAreaNames(url);
      return { ie, ni, holes, areaNames };
    } catch (err) {
      lastError = err;
      console.warn(`Giving up on ${url} for this refresh; trying the next server.`);
    }
  }
  throw lastError;
}

async function main() {
  const overrides: Overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {};
  const previous = readPrevious();

  const { ie, ni, holes, areaNames } = await fetchAll();

  const { courses, report } = buildDirectory(
    { courses: [{ country: 'IE', elements: ie }, { country: 'NI', elements: ni }], holes, areaNames },
    overrides,
  );
  const merged = mergeWithPrevious(courses, previous.courses, overrides, report.filteredKeys, previous.aliases);

  const section = (title: string, items: string[]) => {
    if (items.length) console.log(`\n${title} (${items.length}):\n  ${items.join('\n  ')}`);
  };
  console.log(`\n${courses.length} courses built; ${report.unnamed} unnamed elements skipped.`);
  section('Left out: no position', report.noPosition);
  section('Left out: unnamed (name one with overrides.json "set")', report.unnamedList);
  section('Left out: not a golf course by name/tag', report.notACourse);
  section('Left out: too small to be a course', report.tooSmall);
  section('Merged duplicates', report.duplicates);
  section('No county found', report.noCounty);
  section('County taken from the name, not the boundary', report.countyFromName);
  section('Named after their venue', report.namedAfterVenue);
  section('Gone from OSM, carried over as stale', merged.carried.map((c) => `${c.key} ${c.name}`));
  section('Re-keyed in OSM (alias old -> new)', Object.entries(merged.aliases).filter(([k]) => !previous.aliases[k]).map(([a, b]) => `${a} -> ${b}`));
  const byHoles = new Map<string, number>();
  for (const c of merged.courses) byHoles.set(String(c.holes ?? 'unknown'), (byHoles.get(String(c.holes ?? 'unknown')) ?? 0) + 1);
  console.log(`\nHoles: ${[...byHoles].map(([h, n]) => `${h}: ${n}`).join(', ')}`);

  // Overpass sometimes answers a query with a quietly incomplete result (no error remark). The
  // symptoms are courses vanishing and courses the county query didn't cover. Refuse to write
  // rather than commit that; the next run tries again. DIRECTORY_ALLOW_DROPS=1 overrides when the
  // change is real (clubs closing, a big re-map in OSM).
  const noCounty = merged.courses.filter((c) => c.county === null).length;
  const suspect = previous.courses.length > 0 && (merged.carried.length > MAX_VANISHED || noCounty > MAX_NO_COUNTY);
  if (suspect && process.env.DIRECTORY_ALLOW_DROPS !== '1') {
    console.error(
      `\nNot written: ${merged.carried.length} courses vanished (max ${MAX_VANISHED}) and ${noCounty} have no county ` +
        `(max ${MAX_NO_COUNTY}) — this looks like an incomplete Overpass result. Run it again, or set ` +
        'DIRECTORY_ALLOW_DROPS=1 if the change is real.',
    );
    process.exitCode = 1;
    return;
  }

  if (JSON.stringify(merged.courses) === JSON.stringify(previous.courses) && JSON.stringify(merged.aliases) === JSON.stringify(previous.aliases)) {
    console.log('\nNo changes — ireland.json left as it is.');
    return;
  }
  writeFileSync(OUT, serialise(new Date().toISOString(), merged.courses, merged.aliases));
  console.log(`\nWrote ${merged.courses.length} courses to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
