/**
 * The course directory at runtime: a static file (`data/ireland.json`, refreshed by
 * `pnpm directory:fetch`), bundled with the app — no table, no seed step, and a refresh ships with
 * the next deploy. See `build.ts` for how it's made and why keys are stable.
 */
import ireland from './data/ireland.json';
import type { DirectoryCourse } from './build';

export type { DirectoryCourse } from './build';
export { COUNTIES } from './build';

export const DIRECTORY: readonly DirectoryCourse[] = ireland.courses as DirectoryCourse[];
export const DIRECTORY_FETCHED_AT: string | null = ireland.fetchedAt;

/** Keys OSM re-numbered: old -> current (see mergeWithPrevious). */
const ALIASES: Readonly<Record<string, string>> = (ireland as { aliases?: Record<string, string> }).aliases ?? {};

/** The current key for a stored key (a tick or a course link may predate a re-key in OSM). */
export function resolveKey(key: string): string {
  return ALIASES[key] ?? key;
}

/** Every stored key that means this course: itself and any old keys aliased to it. */
export function keysFor(key: string): string[] {
  return [key, ...Object.keys(ALIASES).filter((k) => ALIASES[k] === key)];
}

const byKey = new Map(DIRECTORY.map((c) => [c.key, c]));
export function directoryCourse(key: string): DirectoryCourse | undefined {
  return byKey.get(resolveKey(key));
}

import top100 from './data/top100.json';
import { rankByKey, type Top100File } from './top100';

/** The top-100 ranking used as the /profile challenge (empty until its list is added). */
export const TOP100 = top100 as Top100File;
export const TOP100_RANK: ReadonlyMap<string, number> = new Map(
  [...rankByKey(TOP100)].map(([key, rank]) => [resolveKey(key), rank]),
);
