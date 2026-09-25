/**
 * A player's "courses played" profile. Pure, so it's tested without a database.
 *
 * A course counts as played when the player ticked it off (`played_courses`) OR logged a round on a
 * scorecard course linked to it (`courses.directory_key`). Both can be true; the rounds are shown
 * either way, and only a ticked-off course can be un-ticked (a round is proof you played it).
 */
import { COUNTIES, type DirectoryCourse } from './build';

export type RoundCourse = { directoryKey: string; playedOn: string };

export type PlayedEntry = {
  course: DirectoryCourse;
  /** Ticked off by hand (so it can be un-ticked). */
  ticked: boolean;
  /** Rounds logged here in the app. */
  rounds: number;
  /** Most recent logged round (YYYY-MM-DD), or null. */
  lastPlayed: string | null;
};

export type PlayedProfile = {
  played: PlayedEntry[];
  /** Keys ticked off that aren't in the directory any more (shouldn't happen — see mergeWithPrevious). */
  unknownKeys: string[];
  stats: {
    played: number;
    total: number;
    /** Played courses by size; `other` = 27/36-hole venues and unknown sizes. */
    eighteen: number;
    nine: number;
    other: number;
    counties: number;
    totalCounties: number;
    /** Ranked courses played / ranked courses in the directory (0 / 0 when there's no ranking). */
    top100: number;
    totalTop100: number;
  };
  /** Every county, with how many of its courses the player has played. */
  byCounty: { county: string; played: number; total: number }[];
};

export function buildPlayedProfile(
  directory: readonly DirectoryCourse[],
  tickedKeys: readonly string[],
  roundCourses: readonly RoundCourse[],
  top100Rank: ReadonlyMap<string, number> = new Map(),
): PlayedProfile {
  const byKey = new Map(directory.map((c) => [c.key, c]));
  const entries = new Map<string, PlayedEntry>();
  const unknownKeys: string[] = [];
  const entry = (key: string) => {
    const course = byKey.get(key);
    if (!course) return null;
    if (!entries.has(key)) entries.set(key, { course, ticked: false, rounds: 0, lastPlayed: null });
    return entries.get(key)!;
  };

  for (const key of new Set(tickedKeys)) {
    const e = entry(key);
    if (e) e.ticked = true;
    else unknownKeys.push(key);
  }
  for (const r of roundCourses) {
    const e = entry(r.directoryKey);
    if (!e) continue;
    e.rounds++;
    if (e.lastPlayed === null || r.playedOn > e.lastPlayed) e.lastPlayed = r.playedOn;
  }

  const played = [...entries.values()].sort((a, b) => a.course.name.localeCompare(b.course.name, 'en'));
  const counties = new Set(played.map((p) => p.course.county).filter((c): c is string => c !== null));
  const byCounty = COUNTIES.map((county) => ({
    county,
    played: played.filter((p) => p.course.county === county).length,
    total: directory.filter((c) => c.county === county).length,
  }));

  return {
    played,
    unknownKeys,
    stats: {
      played: played.length,
      total: directory.length,
      eighteen: played.filter((p) => p.course.holes === 18).length,
      nine: played.filter((p) => p.course.holes === 9).length,
      other: played.filter((p) => p.course.holes !== 18 && p.course.holes !== 9).length,
      counties: counties.size,
      totalCounties: COUNTIES.length,
      top100: played.filter((p) => top100Rank.has(p.course.key)).length,
      totalTop100: directory.filter((c) => top100Rank.has(c.key)).length,
    },
    byCounty,
  };
}

/** Case- and accent-insensitive search on name and county. */
export function matchesQuery(course: DirectoryCourse, query: string): boolean {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold(`${course.name} ${course.county ?? ''}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}
