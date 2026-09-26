/**
 * The drill library for `/practice` (issue #55). The drills themselves are data
 * (`data/drills.json`); this module types them, checks the file's shape, and matches drills to a
 * part of the game and a distance range.
 *
 * Every drill is random practice with a score: a new target, distance or lie on every ball, and a
 * pass mark out of a fixed number of balls. There are no blocked-practice drills (the same shot
 * over and over), because that practice feels good and transfers poorly to the course.
 *
 * Ranges use the app's display units: yards off the green, feet on it (`EnrichedShot.startDistance`).
 */
import type { BunkerSubtype, Category } from '../sg/categorise';
import raw from './data/drills.json';

export type Drill = {
  id: string;
  name: string;
  /** The part of the game this drill trains (a strokes-gained category). */
  area: Category;
  /** Start distances it covers: yards, or feet for putting. Null = any distance (bunker by subtype). */
  range: { min: number; max: number } | null;
  bunkerSubtype: BunkerSubtype | null;
  outOf: number;
  passMark: number;
  /** What the score counts, e.g. "putts holed". */
  scoreUnit: string;
  setup: string;
  steps: string[];
  rationale: string;
};

const CATEGORIES: readonly Category[] = ['OFF_THE_TEE', 'APPROACH', 'SHORT_GAME', 'BUNKER', 'PUTTING', 'RECOVERY'];

/** Throws on a malformed drill, so a bad edit to the JSON fails the tests and the build, not a page. */
export function parseDrills(input: unknown): Drill[] {
  const list = (input as { drills?: unknown })?.drills;
  if (!Array.isArray(list)) throw new Error('drills.json: expected { drills: [...] }');
  const seen = new Set<string>();
  return list.map((d: Record<string, unknown>, i) => {
    const where = `drills.json drill ${i} (${String(d.id)})`;
    if (typeof d.id !== 'string' || !/^[a-z0-9-]+$/.test(d.id)) throw new Error(`${where}: id must be kebab-case`);
    if (seen.has(d.id)) throw new Error(`${where}: duplicate id`);
    seen.add(d.id);
    if (!CATEGORIES.includes(d.area as Category)) throw new Error(`${where}: unknown area`);
    const outOf = d.outOf as number;
    const passMark = d.passMark as number;
    if (!Number.isInteger(outOf) || outOf < 1) throw new Error(`${where}: outOf must be a positive whole number`);
    if (!Number.isInteger(passMark) || passMark < 1 || passMark > outOf) {
      throw new Error(`${where}: passMark must be between 1 and outOf`);
    }
    const range = d.range as Drill['range'];
    if (range !== null && !(typeof range?.min === 'number' && typeof range.max === 'number' && range.min < range.max)) {
      throw new Error(`${where}: range must be null or { min < max }`);
    }
    for (const k of ['name', 'scoreUnit', 'setup', 'rationale'] as const) {
      if (typeof d[k] !== 'string' || (d[k] as string).trim() === '') throw new Error(`${where}: ${k} is required`);
    }
    if (!Array.isArray(d.steps) || d.steps.length === 0 || d.steps.some((s) => typeof s !== 'string')) {
      throw new Error(`${where}: steps must be a non-empty list of text`);
    }
    return d as unknown as Drill;
  });
}

export const DRILLS: readonly Drill[] = parseDrills(raw);
const BY_ID = new Map(DRILLS.map((d) => [d.id, d]));

export function drillById(id: string): Drill | undefined {
  return BY_ID.get(id);
}

/** How much of [lo, hi] the drill's range covers, 0..1. A drill with no range covers everything. */
function overlap(drill: Drill, lo: number, hiRaw: number): number {
  if (drill.range === null) return 1;
  // An open-ended range ("50+ ft") is scored as if it ran to twice its start.
  const hi = Number.isFinite(hiRaw) ? hiRaw : Math.max(lo * 2, lo + 1);
  const width = hi - lo;
  if (width <= 0) return lo >= drill.range.min && lo <= drill.range.max ? 1 : 0;
  return Math.max(0, Math.min(hi, drill.range.max) - Math.max(lo, drill.range.min)) / width;
}

/**
 * Drills for a part of the game and, optionally, a focus range or bunker type: those that cover
 * the range, best cover first. Empty when the library has nothing for it yet (the page says so
 * rather than offering an unrelated drill).
 */
export function drillsFor(
  area: Category,
  focus: { min: number; max: number } | null,
  bunkerSubtype: BunkerSubtype | null = null,
): Drill[] {
  return DRILLS.filter((d) => d.area === area)
    .filter((d) => d.bunkerSubtype === null || bunkerSubtype === null || d.bunkerSubtype === bunkerSubtype)
    .map((d) => ({ d, cover: focus ? overlap(d, focus.min, focus.max) : 1 }))
    .filter((x) => x.cover > 0)
    .sort((a, b) => b.cover - a.cover)
    .map((x) => x.d);
}

/** Pass or fail for a score on a drill (the only place the rule lives). */
export function passes(score: number, passMark: number): boolean {
  return score >= passMark;
}
