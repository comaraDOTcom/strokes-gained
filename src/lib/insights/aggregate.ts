/**
 * Pure aggregation logic for the dashboard (`/`) and insights (`/insights`)
 * pages. Consumes a flat list of `EnrichedShot` (produced by
 * `src/lib/insights/queries.ts`, which is the only file that touches the
 * DB) and produces chart-ready shapes. Kept DB-free and synchronous so it
 * can be unit tested directly, the same separation `compute.ts` /
 * `recompute.ts` use for the SG engine.
 */
import { expectedStrokes } from '../sg/interpolate';
import type { Lie } from '../sg/baseline-scratch';
import type { Category, BunkerSubtype } from '../sg/categorise';
import type { PenaltyType } from '../sg/compute';
import {
  computeHoleTraditionalStats,
  aggregateTraditionalStats,
  type RoundTraditionalStats,
} from './traditional-stats';
import { puttingBand, shortGameBand, approachBand } from './bands';

export type EnrichedShot = {
  roundId: number;
  playedOn: string; // ISO date, YYYY-MM-DD
  courseId: number;
  courseName: string;
  teeId: number;
  teeName: string;
  holeNo: number;
  par: number;
  shotNo: number;
  startLie: Lie;
  startDistance: number; // display units: feet on GREEN, yards otherwise
  endLie: Lie | null;
  endDistance: number;
  holed: boolean;
  penaltyStrokes: number;
  penaltyType: PenaltyType;
  sg: number;
  category: Category;
  bunkerSubtype: BunkerSubtype | null;
};

const ALL_CATEGORIES: Category[] = [
  'OFF_THE_TEE',
  'APPROACH',
  'SHORT_GAME',
  'BUNKER',
  'PUTTING',
  'RECOVERY',
];

function byRound(shots: EnrichedShot[]): Map<number, EnrichedShot[]> {
  const map = new Map<number, EnrichedShot[]>();
  for (const s of shots) {
    (map.get(s.roundId) ?? map.set(s.roundId, []).get(s.roundId)!).push(s);
  }
  return map;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Round summaries — `/` dashboard
// ---------------------------------------------------------------------------

export type RoundSummary = {
  roundId: number;
  playedOn: string;
  courseId: number;
  courseName: string;
  teeId: number;
  teeName: string;
  /** Holes with at least one shot logged — 18 for a full round; fewer = a partial round. */
  holesPlayed: number;
  grossScore: number;
  par: number;
  sgTotal: number;
  sgByCategory: Record<Category, number>;
  traditional: RoundTraditionalStats;
};

/** One row per round, newest first. */
export function roundSummaries(shots: EnrichedShot[]): RoundSummary[] {
  const rounds = byRound(shots);
  const out: RoundSummary[] = [];

  for (const [roundId, roundShots] of rounds) {
    const first = roundShots[0]!;
    const holeGroups = new Map<number, EnrichedShot[]>();
    for (const s of roundShots) {
      (holeGroups.get(s.holeNo) ?? holeGroups.set(s.holeNo, []).get(s.holeNo)!).push(s);
    }

    const holeStats = [...holeGroups.entries()].map(([holeNo, hs]) =>
      computeHoleTraditionalStats(
        holeNo,
        hs.map((s) => ({
          shotNo: s.shotNo,
          startLie: s.startLie,
          endLie: s.endLie,
          holed: s.holed,
          penaltyStrokes: s.penaltyStrokes,
        })),
        hs[0]!.par,
      ),
    );

    const par = sum([...holeGroups.values()].map((hs) => hs[0]!.par));
    const sgByCategory = Object.fromEntries(
      ALL_CATEGORIES.map((c) => [c, sum(roundShots.filter((s) => s.category === c).map((s) => s.sg))]),
    ) as Record<Category, number>;

    out.push({
      roundId,
      playedOn: first.playedOn,
      courseId: first.courseId,
      courseName: first.courseName,
      teeId: first.teeId,
      teeName: first.teeName,
      holesPlayed: holeGroups.size,
      grossScore: sum(holeStats.map((h) => h.grossScore)),
      par,
      sgTotal: sum(Object.values(sgByCategory)),
      sgByCategory,
      traditional: aggregateTraditionalStats(holeStats),
    });
  }

  out.sort((a, b) => (a.playedOn === b.playedOn ? a.roundId - b.roundId : a.playedOn.localeCompare(b.playedOn)));
  return out.reverse();
}

// ---------------------------------------------------------------------------
// Per-round, per-category SG series — feeds the "latest vs prior 3" bars,
// the rolling-average time series (Phase 4), and the trend/signal-strength
// and practice-priority logic (Phase 5, see trends.ts).
// ---------------------------------------------------------------------------

export type CategoryRoundPoint = {
  roundId: number;
  playedOn: string;
  category: Category;
  sg: number;
  shotCount: number;
};

/** Oldest round first (chronological), one point per (round, category). */
export function categorySeries(shots: EnrichedShot[]): CategoryRoundPoint[] {
  const rounds = byRound(shots);
  const points: CategoryRoundPoint[] = [];

  for (const [roundId, roundShots] of rounds) {
    const playedOn = roundShots[0]!.playedOn;
    for (const category of ALL_CATEGORIES) {
      const inCategory = roundShots.filter((s) => s.category === category);
      if (inCategory.length === 0) continue;
      points.push({ roundId, playedOn, category, sg: sum(inCategory.map((s) => s.sg)), shotCount: inCategory.length });
    }
  }

  points.sort((a, b) => (a.playedOn === b.playedOn ? a.roundId - b.roundId : a.playedOn.localeCompare(b.playedOn)));
  return points;
}

/** 3-round trailing rolling average of `sg`, per category, in chronological order. */
export function rollingAverageByCategory(
  points: CategoryRoundPoint[],
  windowSize = 3,
): (CategoryRoundPoint & { rollingAvg: number })[] {
  const byCategory = new Map<Category, CategoryRoundPoint[]>();
  for (const p of points) {
    (byCategory.get(p.category) ?? byCategory.set(p.category, []).get(p.category)!).push(p);
  }

  const out: (CategoryRoundPoint & { rollingAvg: number })[] = [];
  for (const series of byCategory.values()) {
    for (let i = 0; i < series.length; i++) {
      const windowStart = Math.max(0, i - windowSize + 1);
      const window = series.slice(windowStart, i + 1);
      out.push({ ...series[i]!, rollingAvg: sum(window.map((w) => w.sg)) / window.length });
    }
  }
  out.sort((a, b) => (a.playedOn === b.playedOn ? a.roundId - b.roundId : a.playedOn.localeCompare(b.playedOn)));
  return out;
}

/**
 * "Latest round vs mean of prior N" per category — the grouped-bar
 * comparison in both the Phase 4 insights page and the Phase 5 trend view.
 * Returns null for a category with fewer than 2 rounds of history (nothing
 * to compare the latest round against).
 */
export type LatestVsPrior = {
  category: Category;
  latestSg: number;
  latestShotCount: number;
  priorMeanSg: number;
  priorRoundCount: number;
  priorShotCounts: number[];
  delta: number; // latestSg - priorMeanSg
};

export function latestVsPriorMean(points: CategoryRoundPoint[], priorWindow = 3): LatestVsPrior[] {
  const byCategory = new Map<Category, CategoryRoundPoint[]>();
  for (const p of points) {
    (byCategory.get(p.category) ?? byCategory.set(p.category, []).get(p.category)!).push(p);
  }

  const out: LatestVsPrior[] = [];
  for (const [category, series] of byCategory) {
    if (series.length < 2) continue;
    const latest = series[series.length - 1]!;
    const prior = series.slice(Math.max(0, series.length - 1 - priorWindow), series.length - 1);
    if (prior.length === 0) continue;
    const priorMeanSg = sum(prior.map((p) => p.sg)) / prior.length;
    out.push({
      category,
      latestSg: latest.sg,
      latestShotCount: latest.shotCount,
      priorMeanSg,
      priorRoundCount: prior.length,
      priorShotCounts: prior.map((p) => p.shotCount),
      delta: latest.sg - priorMeanSg,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Putting — SG and make% by band, vs an implied baseline make%
// ---------------------------------------------------------------------------

/**
 * The baseline (`src/lib/sg/baseline-scratch.ts`) only encodes expected
 * STROKES to hole out, not a make-percentage table — Phase 1 never defined
 * one. Rather than inventing a separate, unreviewed anchor table, this
 * derives the implied make rate from the existing GREEN curve under the
 * standard "holes it, or 2-putts" scratch model: E = p*1 + (1-p)*2 = 2 - p,
 * so p = 2 - E. This is exact at the two-putt crossover (E=2.0 -> p=0) and
 * at very short range (E~1.0 -> p~1), which is exactly what the baseline
 * file's own header calls out. It is clearly labeled "implied by baseline"
 * in the UI, not presented as a real make-percentage statistic.
 */
export function impliedMakeRate(feet: number): number {
  const e = expectedStrokes('GREEN', feet);
  return Math.min(1, Math.max(0, 2 - e));
}

export type PuttingBandStat = {
  band: string;
  order: number;
  attempts: number;
  makes: number;
  makePct: number;
  impliedBaselineMakePct: number;
  sgTotal: number;
  sgPerPutt: number;
};

export function puttingBandStats(shots: EnrichedShot[]): PuttingBandStat[] {
  const putts = shots.filter((s) => s.category === 'PUTTING');
  const byBand = new Map<string, { order: number; shots: EnrichedShot[] }>();
  for (const s of putts) {
    const b = puttingBand(s.startDistance);
    const entry = byBand.get(b.label) ?? { order: b.order, shots: [] };
    entry.shots.push(s);
    byBand.set(b.label, entry);
  }

  const out: PuttingBandStat[] = [];
  for (const [band, { order, shots: bandShots }] of byBand) {
    const attempts = bandShots.length;
    const makes = bandShots.filter((s) => s.holed).length;
    const impliedRates = bandShots.map((s) => impliedMakeRate(s.startDistance));
    out.push({
      band,
      order,
      attempts,
      makes,
      makePct: makes / attempts,
      impliedBaselineMakePct: sum(impliedRates) / impliedRates.length,
      sgTotal: sum(bandShots.map((s) => s.sg)),
      sgPerPutt: sum(bandShots.map((s) => s.sg)) / attempts,
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

/** Putts per round, chronological — for the putts/round trend line. */
export function puttsPerRound(shots: EnrichedShot[]): { roundId: number; playedOn: string; putts: number }[] {
  const rounds = byRound(shots);
  const out = [...rounds.entries()].map(([roundId, roundShots]) => ({
    roundId,
    playedOn: roundShots[0]!.playedOn,
    putts: roundShots.filter((s) => s.category === 'PUTTING').length,
  }));
  out.sort((a, b) => (a.playedOn === b.playedOn ? a.roundId - b.roundId : a.playedOn.localeCompare(b.playedOn)));
  return out;
}

// ---------------------------------------------------------------------------
// Short game — SG by band and by lie
// ---------------------------------------------------------------------------

export type BandStat = { band: string; order: number; count: number; sgTotal: number; sgPerShot: number };
export type LieStat = { lie: Lie; count: number; sgTotal: number; sgPerShot: number };

export function shortGameBandStats(shots: EnrichedShot[]): BandStat[] {
  const sg = shots.filter((s) => s.category === 'SHORT_GAME');
  const byBand = new Map<string, { order: number; shots: EnrichedShot[] }>();
  for (const s of sg) {
    const b = shortGameBand(s.startDistance);
    const entry = byBand.get(b.label) ?? { order: b.order, shots: [] };
    entry.shots.push(s);
    byBand.set(b.label, entry);
  }
  const out: BandStat[] = [...byBand.entries()].map(([band, { order, shots: bs }]) => ({
    band,
    order,
    count: bs.length,
    sgTotal: sum(bs.map((s) => s.sg)),
    sgPerShot: sum(bs.map((s) => s.sg)) / bs.length,
  }));
  out.sort((a, b) => a.order - b.order);
  return out;
}

export function shortGameLieStats(shots: EnrichedShot[]): LieStat[] {
  const sg = shots.filter((s) => s.category === 'SHORT_GAME');
  return byLie(sg);
}

function byLie(shots: EnrichedShot[]): LieStat[] {
  const byL = new Map<Lie, EnrichedShot[]>();
  for (const s of shots) {
    (byL.get(s.startLie) ?? byL.set(s.startLie, []).get(s.startLie)!).push(s);
  }
  return [...byL.entries()].map(([lie, ls]) => ({
    lie,
    count: ls.length,
    sgTotal: sum(ls.map((s) => s.sg)),
    sgPerShot: sum(ls.map((s) => s.sg)) / ls.length,
  }));
}

// ---------------------------------------------------------------------------
// Bunker — greenside vs fairway
// ---------------------------------------------------------------------------

export type BunkerStat = { subtype: BunkerSubtype; count: number; sgTotal: number; sgPerShot: number };

export function bunkerStats(shots: EnrichedShot[]): BunkerStat[] {
  const bunker = shots.filter((s) => s.category === 'BUNKER');
  const bySub = new Map<BunkerSubtype, EnrichedShot[]>();
  for (const s of bunker) {
    const sub = s.bunkerSubtype!;
    (bySub.get(sub) ?? bySub.set(sub, []).get(sub)!).push(s);
  }
  return [...bySub.entries()].map(([subtype, bs]) => ({
    subtype,
    count: bs.length,
    sgTotal: sum(bs.map((s) => s.sg)),
    sgPerShot: sum(bs.map((s) => s.sg)) / bs.length,
  }));
}

// ---------------------------------------------------------------------------
// Approach — by band and by start lie
// ---------------------------------------------------------------------------

export function approachBandStats(shots: EnrichedShot[]): BandStat[] {
  const approach = shots.filter((s) => s.category === 'APPROACH');
  const byBand = new Map<string, { order: number; shots: EnrichedShot[] }>();
  for (const s of approach) {
    const b = approachBand(s.startDistance);
    const entry = byBand.get(b.label) ?? { order: b.order, shots: [] };
    entry.shots.push(s);
    byBand.set(b.label, entry);
  }
  const out: BandStat[] = [...byBand.entries()].map(([band, { order, shots: bs }]) => ({
    band,
    order,
    count: bs.length,
    sgTotal: sum(bs.map((s) => s.sg)),
    sgPerShot: sum(bs.map((s) => s.sg)) / bs.length,
  }));
  out.sort((a, b) => a.order - b.order);
  return out;
}

export function approachLieStats(shots: EnrichedShot[]): LieStat[] {
  return byLie(shots.filter((s) => s.category === 'APPROACH'));
}

/** GIR% and fairways-hit% per round, chronological — trend lines. */
export function girAndFairwayTrend(
  shots: EnrichedShot[],
): { roundId: number; playedOn: string; girPct: number; fairwaysPct: number | null }[] {
  return roundSummaries(shots)
    .slice()
    .reverse() // roundSummaries is newest-first; trend lines want chronological
    .map((r) => ({
      roundId: r.roundId,
      playedOn: r.playedOn,
      girPct: r.traditional.girCount / r.traditional.girTotal,
      fairwaysPct: r.traditional.fairwaysTotal > 0 ? r.traditional.fairwaysHit / r.traditional.fairwaysTotal : null,
    }));
}

// ---------------------------------------------------------------------------
// Strokes lost to penalties and recovery, by hole
// ---------------------------------------------------------------------------

export type HoleLossStat = {
  courseName: string;
  holeNo: number;
  penaltyStrokes: number;
  penaltySgLost: number; // == -penaltyStrokes exactly, since SG subtracts penaltyStrokes 1:1
  recoverySgLost: number; // sum of SG on shots that started in RECOVERY (typically negative)
  recoveryShotCount: number;
};

export function penaltyAndRecoveryByHole(shots: EnrichedShot[]): HoleLossStat[] {
  const byKey = new Map<string, { courseName: string; holeNo: number; shots: EnrichedShot[] }>();
  for (const s of shots) {
    const key = `${s.courseName}::${s.holeNo}`;
    const entry = byKey.get(key) ?? { courseName: s.courseName, holeNo: s.holeNo, shots: [] };
    entry.shots.push(s);
    byKey.set(key, entry);
  }

  const out: HoleLossStat[] = [];
  for (const { courseName, holeNo, shots: hs } of byKey.values()) {
    const penaltyStrokes = sum(hs.map((s) => s.penaltyStrokes));
    const recoveryShots = hs.filter((s) => s.startLie === 'RECOVERY');
    out.push({
      courseName,
      holeNo,
      penaltyStrokes,
      penaltySgLost: -penaltyStrokes,
      recoverySgLost: sum(recoveryShots.map((s) => s.sg)),
      recoveryShotCount: recoveryShots.length,
    });
  }
  out.sort((a, b) => (a.courseName === b.courseName ? a.holeNo - b.holeNo : a.courseName.localeCompare(b.courseName)));
  return out.filter((h) => h.penaltyStrokes > 0 || h.recoveryShotCount > 0);
}

// ---------------------------------------------------------------------------
// Up-and-down % vs sand-save % trend — related but distinct (sand save is
// the subset of up-and-down attempts starting in SAND).
// ---------------------------------------------------------------------------

export function upAndDownVsSandSaveTrend(shots: EnrichedShot[]): {
  roundId: number;
  playedOn: string;
  upAndDownPct: number | null;
  sandSavePct: number | null;
}[] {
  return roundSummaries(shots)
    .slice()
    .reverse()
    .map((r) => ({
      roundId: r.roundId,
      playedOn: r.playedOn,
      upAndDownPct: r.traditional.upAndDown.attempted > 0 ? r.traditional.upAndDown.converted / r.traditional.upAndDown.attempted : null,
      sandSavePct: r.traditional.sandSave.attempted > 0 ? r.traditional.sandSave.converted / r.traditional.sandSave.attempted : null,
    }));
}
