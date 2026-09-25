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

const byKey = new Map(DIRECTORY.map((c) => [c.key, c]));
export function directoryCourse(key: string): DirectoryCourse | undefined {
  return byKey.get(key);
}

import top100 from './data/top100.json';
import { rankByKey, type Top100File } from './top100';

/** The top-100 ranking used as the /profile challenge (empty until its list is added). */
export const TOP100 = top100 as Top100File;
export const TOP100_RANK: ReadonlyMap<string, number> = rankByKey(TOP100);
