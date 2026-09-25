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

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const DATA = resolve(import.meta.dirname, '../src/lib/directory/data');
const OUT = resolve(DATA, 'ireland.json');
const OVERRIDES = resolve(DATA, 'overrides.json');

const AREAS: Record<Country, string> = {
  IE: 'area["ISO3166-1"="IE"]["admin_level"="2"]',
  NI: 'area["ISO3166-2"="GB-NIR"]',
};

async function overpass(query: string): Promise<any[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'strokes-gained course directory (https://github.com/comaraDOTcom/strokes-gained)',
      },
      body: new URLSearchParams({ data: query }),
    });
    if (res.ok) return ((await res.json()) as { elements: any[] }).elements;
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = 15_000 * attempt;
      console.warn(`Overpass HTTP ${res.status}; retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
}

async function fetchCourses(country: Country): Promise<OsmElement[]> {
  return overpass(`[out:json][timeout:300];
${AREAS[country]}->.a;
nwr["leisure"="golf_course"](area.a);
out tags center bb;`);
}

async function fetchHoles(): Promise<OsmElement[]> {
  return overpass(`[out:json][timeout:300];
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
async function fetchAreaNames(): Promise<Map<string, string[]>> {
  const elements = await overpass(`[out:json][timeout:600];
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

function readPrevious(): { fetchedAt: string | null; courses: DirectoryCourse[] } {
  if (!existsSync(OUT)) return { fetchedAt: null, courses: [] };
  const j = JSON.parse(readFileSync(OUT, 'utf8'));
  return { fetchedAt: j.fetchedAt ?? null, courses: j.courses ?? [] };
}

/** One course per line, so a refresh reads as a clean diff. */
function serialise(fetchedAt: string, courses: DirectoryCourse[]): string {
  const head = {
    source: 'OpenStreetMap (leisure=golf_course), via the Overpass API',
    licence: 'Data © OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright',
    fetchedAt,
  };
  const lines = courses.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
  return `${JSON.stringify(head, null, 2).slice(0, -2)},\n  "courses": [\n${lines}\n  ]\n}\n`;
}

async function main() {
  const overrides: Overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, 'utf8')) : {};
  const previous = readPrevious();

  const ie = await fetchCourses('IE');
  const ni = await fetchCourses('NI');
  console.log(`Fetched ${ie.length} IE + ${ni.length} NI golf_course elements`);
  const holes = await fetchHoles();
  console.log(`Fetched ${holes.length} mapped holes`);
  const areaNames = await fetchAreaNames();

  const { courses, report } = buildDirectory(
    { courses: [{ country: 'IE', elements: ie }, { country: 'NI', elements: ni }], holes, areaNames },
    overrides,
  );
  const merged = mergeWithPrevious(courses, previous.courses, overrides);

  const section = (title: string, items: string[]) => {
    if (items.length) console.log(`\n${title} (${items.length}):\n  ${items.join('\n  ')}`);
  };
  console.log(`\n${courses.length} courses built; ${report.unnamed} unnamed elements skipped.`);
  section('Left out: not a golf course by name/tag', report.notACourse);
  section('Left out: too small to be a course', report.tooSmall);
  section('Merged duplicates', report.duplicates);
  section('No county found', report.noCounty);
  section('Gone from OSM, carried over as stale', merged.carried.map((c) => `${c.key} ${c.name}`));
  const byHoles = new Map<string, number>();
  for (const c of merged.courses) byHoles.set(String(c.holes ?? 'unknown'), (byHoles.get(String(c.holes ?? 'unknown')) ?? 0) + 1);
  console.log(`\nHoles: ${[...byHoles].map(([h, n]) => `${h}: ${n}`).join(', ')}`);

  if (JSON.stringify(merged.courses) === JSON.stringify(previous.courses)) {
    console.log('\nNo changes — ireland.json left as it is.');
    return;
  }
  writeFileSync(OUT, serialise(new Date().toISOString(), merged.courses));
  console.log(`\nWrote ${merged.courses.length} courses to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
