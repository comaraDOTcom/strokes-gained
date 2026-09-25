/**
 * A published "top 100 courses in Ireland" ranking, used as a challenge on /profile: a badge on each
 * ranked course, a "Top 100" count, and a filter. Pure, so the matching and validation are tested.
 *
 * The ranking lives in `data/top100.json`: `{ title, year, source, entries: [{ rank, name, key }] }`.
 * `key` is the directory course it matched (null when the ranked course isn't in the directory yet —
 * add it via overrides.json, then re-match). Build the file from a pasted list with
 * `pnpm directory:top100 <list.txt>` (scripts/match-top100.ts), which uses `matchTop100` below.
 */
import type { DirectoryCourse } from './build';

export type Top100Entry = { rank: number; name: string; key: string | null };
export type Top100File = { title: string; year: number | null; source: string | null; entries: Top100Entry[] };

/** Words that say nothing about WHICH course it is. */
const FILLER = new Set(['golf', 'club', 'course', 'gc', 'the', 'and', 'resort', 'hotel', 'spa', 'country', 'estate', 'co', 'county']);

function words(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w));
}

/**
 * How well a ranked name matches a directory course, 0–1: the share of the ranked name's words found
 * in the course's name, penalised a little for extra words in the course name. "Royal County Down
 * (Championship)" -> "Royal County Down Golf Course" scores well; "Portmarnock" prefers "Portmarnock
 * Golf Club" over "Portmarnock Links".
 */
export function matchScore(rankedName: string, course: Pick<DirectoryCourse, 'name'>): number {
  const r = words(rankedName.replace(/\(.*?\)/g, ' '));
  const c = words(course.name);
  if (r.length === 0 || c.length === 0) return 0;
  const cs = new Set(c);
  const hit = r.filter((w) => cs.has(w)).length / r.length;
  const extra = c.filter((w) => !r.includes(w)).length;
  return hit - 0.05 * extra;
}

/**
 * "1. Royal County Down", "1 Royal County Down", "1\tRoyal County Down", "#1 – Royal County Down" or
 * just "Royal County Down" (rank = line number among non-empty lines).
 */
export function parseRankedLines(text: string): { rank: number; name: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const m = line.match(/^#?\s*(\d{1,3})\s*[.):\-–—\t]?\s+(.+)$/);
    return m ? { rank: Number(m[1]), name: m[2]!.trim() } : { rank: i + 1, name: line };
  });
}

export type MatchResult = {
  entries: Top100Entry[];
  /** Ranked names with no confident match, with the best guesses to put in overrides or fix by hand. */
  unmatched: { rank: number; name: string; guesses: string[] }[];
};

/** A match is taken when it scores at least this and beats the runner-up outright (a tie is left for a human). */
export const MIN_MATCH = 0.75;

export function matchTop100(ranked: { rank: number; name: string }[], directory: readonly DirectoryCourse[]): MatchResult {
  const entries: Top100Entry[] = [];
  const unmatched: MatchResult['unmatched'] = [];
  const taken = new Set<string>();
  for (const r of ranked) {
    // Scored against EVERY course: if the best one is already ranked, this name is suspect (a
    // duplicate line, or a second course at the same club) — leave it for a human, don't fall back.
    const scored = directory.map((c) => ({ c, s: matchScore(r.name, c) })).sort((a, b) => b.s - a.s);
    const [best, next] = scored;
    if (best && best.s >= MIN_MATCH && (!next || best.s > next.s) && !taken.has(best.c.key)) {
      entries.push({ rank: r.rank, name: r.name, key: best.c.key });
      taken.add(best.c.key);
    } else {
      entries.push({ rank: r.rank, name: r.name, key: null });
      unmatched.push({
        rank: r.rank,
        name: r.name,
        guesses: scored.slice(0, 3).filter((x) => x.s > 0).map((x) => `${x.c.key} ${x.c.name} (${x.s.toFixed(2)})`),
      });
    }
  }
  return { entries, unmatched };
}

/** Problems with a ranking file: duplicate ranks or keys, keys that aren't in the directory. */
export function validateTop100(file: Top100File, directory: readonly DirectoryCourse[]): string[] {
  const problems: string[] = [];
  const keys = new Set(directory.map((c) => c.key));
  const ranks = new Set<number>();
  const used = new Set<string>();
  for (const e of file.entries) {
    if (!Number.isInteger(e.rank) || e.rank < 1) problems.push(`bad rank ${e.rank} (${e.name})`);
    if (ranks.has(e.rank)) problems.push(`rank ${e.rank} appears twice`);
    ranks.add(e.rank);
    if (e.key !== null) {
      if (!keys.has(e.key)) problems.push(`#${e.rank} ${e.name}: ${e.key} isn't in the directory`);
      if (used.has(e.key)) problems.push(`#${e.rank} ${e.name}: ${e.key} is ranked twice`);
      used.add(e.key);
    }
  }
  return problems;
}

/** key -> rank, for the badge and the filter. */
export function rankByKey(file: Top100File): Map<string, number> {
  return new Map(file.entries.filter((e) => e.key !== null).map((e) => [e.key!, e.rank]));
}
