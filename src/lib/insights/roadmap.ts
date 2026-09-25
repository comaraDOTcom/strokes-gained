/**
 * "What to work on" — the roadmap on `/trends`.
 *
 * Every area of the game (a distance band, a bunker type, off the tee,
 * recovery) gets three numbers, kept separate so none hides another:
 *
 * - IMPORTANCE: how much that kind of shot drives scoring differences between
 *   golfers, from Broadie (`importance-broadie.ts`), spread across bands by how
 *   often YOU hit each one. Structural; it doesn't move with your form.
 * - OPPORTUNITY: strokes a round you lose there against scratch, over your
 *   last few rounds.
 * - TREND: is it getting better? Recent half of those rounds vs the earlier
 *   half, with the same signal-strength gate the category trend uses.
 *
 * Priority = importance weight × opportunity. The weight is the Broadie
 * GROUP's (driving / approach / short game / putting), not the band's share,
 * because opportunity already counts how often you hit the shot; using the
 * band share too would count frequency twice and bury rare-but-costly areas.
 *
 * Penalties are not their own area: a penalty stroke is already inside the SG
 * of the shot that caused it. Each area carries its penalty count so the
 * sentence can say so.
 *
 * Pure and DB-free, like the rest of `src/lib/insights`.
 */
import type { Category } from '../sg/categorise';
import type { EnrichedShot } from './aggregate';
import {
  APPROACH_BAND_ORDER,
  PUTTING_BAND_ORDER,
  SHORT_GAME_BAND_ORDER,
  approachBand,
  puttingBand,
  shortGameBand,
} from './bands';
import {
  BROADIE_GROUPS,
  BROADIE_GROUP_LABEL,
  BROADIE_IMPORTANCE,
  type BroadieGroup,
  type ImportanceTable,
} from './importance-broadie';
import { classifySignalStrength, type SignalStrength } from './signal';

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

/** e.g. 'PUTTING:6-10ft', 'BUNKER:greenside', 'OFF_THE_TEE'. */
export type BucketKey = string;

export type Bucket = {
  key: BucketKey;
  category: Category;
  band: string | null;
  label: string;
  order: number;
  /** The Broadie group this area belongs to when it has no shots to go by. */
  nominalGroup: BroadieGroup;
};

function buildBuckets(): Bucket[] {
  const out: Omit<Bucket, 'order'>[] = [
    { key: 'OFF_THE_TEE', category: 'OFF_THE_TEE', band: null, label: 'Off the tee', nominalGroup: 'OFF_THE_TEE' },
    ...APPROACH_BAND_ORDER.map((band) => ({
      key: `APPROACH:${band}`,
      category: 'APPROACH' as const,
      band,
      label: `Approach ${band}`,
      // Broadie's short game runs to 100 yards, so the app's <100y approach band is short game to him.
      nominalGroup: (band === '<100y' ? 'SHORT_GAME' : 'APPROACH') as BroadieGroup,
    })),
    ...SHORT_GAME_BAND_ORDER.map((band) => ({
      key: `SHORT_GAME:${band}`,
      category: 'SHORT_GAME' as const,
      band,
      label: `Short game ${band}`,
      nominalGroup: 'SHORT_GAME' as const,
    })),
    { key: 'BUNKER:greenside', category: 'BUNKER', band: 'greenside', label: 'Bunker (greenside)', nominalGroup: 'SHORT_GAME' },
    { key: 'BUNKER:fairway', category: 'BUNKER', band: 'fairway', label: 'Bunker (fairway)', nominalGroup: 'APPROACH' },
    ...PUTTING_BAND_ORDER.map((band) => ({
      key: `PUTTING:${band}`,
      category: 'PUTTING' as const,
      band,
      label: `Putting ${band}`,
      nominalGroup: 'PUTTING' as const,
    })),
    { key: 'RECOVERY', category: 'RECOVERY', band: null, label: 'Recovery shots', nominalGroup: 'APPROACH' },
  ];
  return out.map((b, order) => ({ ...b, order }));
}

/** Every area the roadmap can rank, in the order of a hole (tee to green, then recovery). */
export const ROADMAP_BUCKETS: readonly Bucket[] = buildBuckets();
const BUCKET_BY_KEY = new Map(ROADMAP_BUCKETS.map((b) => [b.key, b]));

type ShotForBucket = Pick<EnrichedShot, 'category' | 'startDistance' | 'bunkerSubtype'>;

export function bucketOf(s: ShotForBucket): BucketKey {
  switch (s.category) {
    case 'OFF_THE_TEE':
      return 'OFF_THE_TEE';
    case 'RECOVERY':
      return 'RECOVERY';
    case 'APPROACH':
      return `APPROACH:${approachBand(s.startDistance).label}`;
    case 'SHORT_GAME':
      return `SHORT_GAME:${shortGameBand(s.startDistance).label}`;
    case 'PUTTING':
      return `PUTTING:${puttingBand(s.startDistance).label}`;
    case 'BUNKER':
      return `BUNKER:${s.bunkerSubtype ?? (s.startDistance <= 30 ? 'greenside' : 'fairway')}`;
  }
}

export type BucketStat = Bucket & { attempts: number; sgTotal: number; sgPerShot: number; penaltyStrokes: number };

/** Every bucket, zero-filled, in ROADMAP_BUCKETS order. */
export function bucketStats(shots: readonly EnrichedShot[]): BucketStat[] {
  const acc = new Map<BucketKey, { attempts: number; sgTotal: number; penaltyStrokes: number }>();
  for (const s of shots) {
    const key = bucketOf(s);
    const a = acc.get(key) ?? { attempts: 0, sgTotal: 0, penaltyStrokes: 0 };
    a.attempts += 1;
    a.sgTotal += s.sg;
    a.penaltyStrokes += s.penaltyStrokes;
    acc.set(key, a);
  }
  return ROADMAP_BUCKETS.map((b) => {
    const a = acc.get(b.key) ?? { attempts: 0, sgTotal: 0, penaltyStrokes: 0 };
    return { ...b, ...a, sgPerShot: a.attempts > 0 ? a.sgTotal / a.attempts : 0 };
  });
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

/** Round ids oldest first, by playedOn then id (roundId order from the DB isn't chronological). */
export function chronologicalRoundIds(shots: readonly EnrichedShot[]): number[] {
  const playedOn = new Map<number, string>();
  for (const s of shots) playedOn.set(s.roundId, s.playedOn);
  return [...playedOn.keys()].sort((a, b) => playedOn.get(a)!.localeCompare(playedOn.get(b)!) || a - b);
}

/** The shots from the last `n` rounds played. */
export function lastNRoundsShots(shots: readonly EnrichedShot[], n: number): EnrichedShot[] {
  const lastN = new Set(chronologicalRoundIds(shots).slice(-n));
  return shots.filter((s) => lastN.has(s.roundId));
}

/** Distinct holes played, so a 9-hole round counts as half a round. */
export function holesPlayed(shots: readonly EnrichedShot[]): number {
  return new Set(shots.map((s) => `${s.roundId}:${s.holeNo}`)).size;
}

// ---------------------------------------------------------------------------
// Importance
// ---------------------------------------------------------------------------

/** Broadie's part of the game for one shot. His short game runs to 100 yards; the app's to 30. */
export function broadieGroup(s: Pick<EnrichedShot, 'category' | 'startDistance'>): BroadieGroup {
  if (s.category === 'PUTTING') return 'PUTTING';
  if (s.category === 'OFF_THE_TEE') return 'OFF_THE_TEE';
  return s.startDistance > 100 ? 'APPROACH' : 'SHORT_GAME';
}

export type ImportanceTier = 'high' | 'mid' | 'lower';
/** Weight 1 = an average part of the game (a quarter of scoring differences). */
export const IMPORTANCE_TIERS = { high: 1.2, mid: 0.8 } as const;

export type Importance = {
  /** The Broadie group most of this area's shots belong to. */
  group: BroadieGroup;
  groupShare: number;
  /** Mean over the area's shots of (their group's share × 4). A pure approach area = 1.6. Drives priority. */
  weight: number;
  /** This area's share of ALL scoring differences: its group's share, split by how often you hit it. Shown as "Importance 14%". */
  bucketShare: number;
  basis: 'exposure' | 'table';
  tier: ImportanceTier;
};

function tierOf(weight: number): ImportanceTier {
  if (weight >= IMPORTANCE_TIERS.high) return 'high';
  if (weight >= IMPORTANCE_TIERS.mid) return 'mid';
  return 'lower';
}

/**
 * Importance per bucket, over ALL rounds (how often you hit a shot is
 * stable; it doesn't need to be recent). A shot's group share is divided
 * evenly among every shot in that group, so the bucket shares add up to the
 * shares of the groups you have shots in (1, once all four have data).
 */
export function importanceByBucket(
  allShots: readonly EnrichedShot[],
  table: ImportanceTable = BROADIE_IMPORTANCE,
): Map<BucketKey, Importance> {
  const groupCount = new Map<BroadieGroup, number>();
  for (const s of allShots) {
    const g = broadieGroup(s);
    groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
  }

  const perBucket = new Map<BucketKey, { share: number; weightSum: number; n: number; groups: Map<BroadieGroup, number> }>();
  for (const s of allShots) {
    const g = broadieGroup(s);
    const key = bucketOf(s);
    const e = perBucket.get(key) ?? { share: 0, weightSum: 0, n: 0, groups: new Map() };
    e.share += table.share[g] / groupCount.get(g)!;
    e.weightSum += table.share[g] * BROADIE_GROUPS.length;
    e.n += 1;
    e.groups.set(g, (e.groups.get(g) ?? 0) + 1);
    perBucket.set(key, e);
  }

  const out = new Map<BucketKey, Importance>();
  for (const b of ROADMAP_BUCKETS) {
    const e = perBucket.get(b.key);
    let group = b.nominalGroup;
    if (e) {
      let best = -1;
      for (const g of BROADIE_GROUPS) {
        const c = e.groups.get(g) ?? 0;
        if (c > best) {
          best = c;
          group = g;
        }
      }
    }
    const weight = e ? e.weightSum / e.n : table.share[b.nominalGroup] * BROADIE_GROUPS.length;
    const fixed = table.bucketShare?.[b.key];
    out.set(b.key, {
      group,
      groupShare: table.share[group],
      weight,
      bucketShare: fixed ?? e?.share ?? 0,
      basis: fixed !== undefined ? 'table' : 'exposure',
      tier: tierOf(weight),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Opportunity
// ---------------------------------------------------------------------------

export type OpportunityLevel = 'none' | 'low' | 'medium' | 'high';
/** Strokes lost per 18 holes. ≥ 0.75 is close to a shot a round from one skill. */
export const OPPORTUNITY_THRESHOLDS = { medium: 0.25, high: 0.75 } as const;
/** Below this many shots in the window, an area's numbers are a hint, not a finding. */
export const SMALL_SAMPLE_ATTEMPTS = 10;

export type Opportunity = {
  /** Strokes a round (per 18 holes) lost to scratch here; 0 when you gain. */
  strokesPer18: number;
  sgPerShot: number;
  attempts: number;
  attemptsPer18: number;
  level: OpportunityLevel;
  smallSample: boolean;
};

export function opportunity(stat: Pick<BucketStat, 'sgTotal' | 'attempts'>, holesInWindow: number): Opportunity {
  const per18 = holesInWindow > 0 ? 18 / holesInWindow : 0;
  const strokesPer18 = Math.max(0, -stat.sgTotal * per18);
  let level: OpportunityLevel;
  if (stat.sgTotal >= 0) level = 'none';
  else if (strokesPer18 >= OPPORTUNITY_THRESHOLDS.high) level = 'high';
  else if (strokesPer18 >= OPPORTUNITY_THRESHOLDS.medium) level = 'medium';
  else level = 'low';
  return {
    strokesPer18,
    sgPerShot: stat.attempts > 0 ? stat.sgTotal / stat.attempts : 0,
    attempts: stat.attempts,
    attemptsPer18: stat.attempts * per18,
    level,
    smallSample: stat.attempts < SMALL_SAMPLE_ATTEMPTS,
  };
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export type TrendDirection = 'improving' | 'worsening' | 'flat';
/** A change smaller than this many strokes per 18 holes reads as flat. */
export const TREND_FLAT_PER18 = 0.1;

export type BucketTrend = {
  direction: TrendDirection;
  /** Recent per-shot SG minus earlier per-shot SG. */
  deltaPerShot: number;
  /** deltaPerShot scaled by how often you hit the shot: the change in strokes per 18 holes. */
  deltaPer18: number;
  /** Kept apart from direction: a noisy "improving" is still shown, just labelled. */
  signal: SignalStrength;
  recentRounds: number;
  earlierRounds: number;
  /** One point per round in the window, oldest first; attempts may be 0. For the sparkline. */
  series: { roundId: number; playedOn: string; sg: number; attempts: number }[];
};

/**
 * Recent half of the window's rounds (the later ceil(n/2)) vs the earlier
 * half. Null when fewer than 2 rounds have a shot in this area, or either half
 * has none: there's nothing to compare.
 */
export function bucketTrend(windowShots: readonly EnrichedShot[], key: BucketKey): BucketTrend | null {
  const roundIds = chronologicalRoundIds(windowShots);
  const inBucket = windowShots.filter((s) => bucketOf(s) === key);
  if (new Set(inBucket.map((s) => s.roundId)).size < 2) return null;

  const playedOn = new Map(windowShots.map((s) => [s.roundId, s.playedOn]));
  const series = roundIds.map((roundId) => {
    const rs = inBucket.filter((s) => s.roundId === roundId);
    return { roundId, playedOn: playedOn.get(roundId)!, sg: rs.reduce((a, s) => a + s.sg, 0), attempts: rs.length };
  });

  const recentCount = Math.ceil(roundIds.length / 2);
  const recentIds = new Set(roundIds.slice(-recentCount));
  const recent = inBucket.filter((s) => recentIds.has(s.roundId));
  const earlier = inBucket.filter((s) => !recentIds.has(s.roundId));
  if (recent.length === 0 || earlier.length === 0) return null;

  const mean = (xs: readonly EnrichedShot[]) => xs.reduce((a, s) => a + s.sg, 0) / xs.length;
  const deltaPerShot = mean(recent) - mean(earlier);
  const holes = holesPlayed(windowShots);
  const attemptsPer18 = holes > 0 ? (inBucket.length * 18) / holes : 0;
  const deltaPer18 = deltaPerShot * attemptsPer18;

  return {
    direction: Math.abs(deltaPer18) < TREND_FLAT_PER18 ? 'flat' : deltaPer18 > 0 ? 'improving' : 'worsening',
    deltaPerShot,
    deltaPer18,
    signal: classifySignalStrength(
      recent.reduce((a, s) => a + s.sg, 0),
      recent.length,
      earlier.map((s) => s.sg),
    ),
    recentRounds: recentCount,
    earlierRounds: roundIds.length - recentCount,
    series,
  };
}

// ---------------------------------------------------------------------------
// The roadmap
// ---------------------------------------------------------------------------

export type RoadmapItem = BucketStat & {
  importance: Importance;
  opportunity: Opportunity;
  trend: BucketTrend | null;
  /** importance.weight × opportunity.strokesPer18. Higher = work on it first. */
  priority: number;
  sentence: string;
};

export type RoadmapGroup = {
  group: BroadieGroup;
  label: string;
  share: number;
  /** Your SG per 18 holes in this group over the window (negative = lost). */
  sgPer18: number;
  attemptsPer18: number;
};

export type Roadmap = {
  roundsTotal: number;
  windowRounds: number;
  holesInWindow: number;
  /** The "importance to scoring" bar, in BROADIE_GROUPS order. */
  groups: RoadmapGroup[];
  /** Areas that cost you shots, highest priority first. */
  items: RoadmapItem[];
  /** Areas where you gain on scratch, best first. */
  strengths: RoadmapItem[];
  /** Every area, in ROADMAP_BUCKETS order, including ones with no shots. */
  all: RoadmapItem[];
  importanceStatus: ImportanceTable['source']['status'];
};

export const DEFAULT_ROADMAP_WINDOW = 8;

export function buildRoadmap(
  shots: readonly EnrichedShot[],
  opts: { roundWindow?: number; importance?: ImportanceTable } = {},
): Roadmap {
  const roundWindow = opts.roundWindow ?? DEFAULT_ROADMAP_WINDOW;
  const table = opts.importance ?? BROADIE_IMPORTANCE;
  const roundsTotal = chronologicalRoundIds(shots).length;
  const window = lastNRoundsShots(shots, roundWindow);
  const windowRounds = chronologicalRoundIds(window).length;
  const holesInWindow = holesPlayed(window);
  const importance = importanceByBucket(shots, table);

  const all: RoadmapItem[] = bucketStats(window).map((stat) => {
    const imp = importance.get(stat.key)!;
    const opp = opportunity(stat, holesInWindow);
    const trend = stat.attempts > 0 ? bucketTrend(window, stat.key) : null;
    const base = { ...stat, importance: imp, opportunity: opp, trend, priority: imp.weight * opp.strokesPer18 };
    return { ...base, sentence: roadmapSentence(base) };
  });

  const items = all
    .filter((i) => i.opportunity.level !== 'none')
    .sort(
      (a, b) =>
        b.priority - a.priority || b.opportunity.strokesPer18 - a.opportunity.strokesPer18 || a.order - b.order,
    );
  const strengths = all.filter((i) => i.attempts > 0 && i.sgTotal > 0).sort((a, b) => b.sgTotal - a.sgTotal);

  const per18 = holesInWindow > 0 ? 18 / holesInWindow : 0;
  const groups: RoadmapGroup[] = BROADIE_GROUPS.map((group) => {
    const gs = window.filter((s) => broadieGroup(s) === group);
    return {
      group,
      label: BROADIE_GROUP_LABEL[group],
      share: table.share[group],
      sgPer18: gs.reduce((a, s) => a + s.sg, 0) * per18,
      attemptsPer18: gs.length * per18,
    };
  });

  return {
    roundsTotal,
    windowRounds,
    holesInWindow,
    groups,
    items,
    strengths,
    all,
    importanceStatus: table.source.status,
  };
}

// ---------------------------------------------------------------------------
// The sentence
// ---------------------------------------------------------------------------

const TIER_PHRASE: Record<ImportanceTier, string> = {
  high: 'a high-importance area',
  mid: 'a mid-importance area',
  lower: 'a lower-importance area',
};

function trendPhrase(t: BucketTrend | null): string {
  if (t === null || t.signal === 'noise') return "there aren't enough shots yet to see a trend";
  if (t.direction === 'flat') return "it isn't moving";
  const firm = t.signal === 'signal';
  if (t.direction === 'improving') return firm ? "it's improving" : 'it may be improving';
  return firm ? "it's getting worse" : 'it may be getting worse';
}

function lossPhrase(strokesPer18: number): string {
  if (strokesPer18 < 0.05) return 'You lose under 0.1 strokes a round here';
  return `You lose ${strokesPer18.toFixed(1)} strokes a round here`;
}

/** One plain sentence (two with a small sample) for a roadmap card, which shows the area's name above it. */
export function roadmapSentence(i: Omit<RoadmapItem, 'sentence'>): string {
  const { opportunity: opp } = i;
  const penalties =
    i.penaltyStrokes > 0 ? ` (including ${i.penaltyStrokes} penalty stroke${i.penaltyStrokes === 1 ? '' : 's'})` : '';
  const lead = opp.level === 'none' ? 'You gain on scratch here' : `${lossPhrase(opp.strokesPer18)}${penalties}`;
  const body = `${lead}; it's ${TIER_PHRASE[i.importance.tier]} and ${trendPhrase(i.trend)}.`;
  if (i.attempts > 0 && opp.smallSample) {
    return `${body} Only ${i.attempts} shot${i.attempts === 1 ? '' : 's'} so far, so treat it as a hint.`;
  }
  return body;
}

/** Look up a bucket definition by key (for tests and the UI). */
export function bucketByKey(key: BucketKey): Bucket | undefined {
  return BUCKET_BY_KEY.get(key);
}
