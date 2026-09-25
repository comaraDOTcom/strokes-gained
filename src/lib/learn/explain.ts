/**
 * Plain-English readings of the app's scores, shared by the hexagon popover, the
 * Rounds tour and the Learn hub. Pure, so every number a player reads is tested.
 */
import { fmtSg } from '../insights/chart-colors';
import { MIN_SHOTS_FOR_QUALITY, QUALITY_PER_SG_SHOT, SCRATCH_QUALITY, type QualityStat } from '../insights/quality';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A short word for where a shot-quality score sits. */
export function qualityBand(q: number): string {
  const r = Math.round(q);
  if (r >= 105) return 'better than scratch';
  if (r >= 100) return 'scratch level';
  if (r >= 95) return 'close to scratch';
  if (r >= 88) return 'a solid club golfer';
  if (r >= 80) return 'a mid-handicap round';
  return 'a tough day';
}

export type QualityExplanation = {
  /** e.g. "87 means your average shot lost 0.13 strokes to a scratch golfer's." */
  headline: string;
  /** e.g. "Over these 79 shots that adds up to 10.4 strokes." */
  detail: string;
  /** Present when there were too few shots to lean on. */
  caveat: string | null;
};

/** What a hexagon number means, in the player's own numbers. */
export function explainQuality(stat: QualityStat): QualityExplanation {
  const q = Math.round(stat.quality);
  const perShot = stat.sg / stat.shots;
  const shownPerShot = Math.abs(perShot).toFixed(2);
  let headline: string;
  if (q === SCRATCH_QUALITY) {
    headline = `${q} means your shots were as good, on average, as a scratch golfer's.`;
  } else if (perShot < 0) {
    headline = `${q} means your average shot lost ${shownPerShot} strokes to a scratch golfer's.`;
  } else {
    headline = `${q} means your average shot gained ${shownPerShot} strokes on a scratch golfer's.`;
  }
  const total = Math.abs(stat.sg).toFixed(1);
  const detail =
    Math.abs(stat.sg) < 0.05
      ? `Over these ${plural(stat.shots, 'shot')} that comes out level with scratch.`
      : `Over these ${plural(stat.shots, 'shot')} that adds up to ${total} strokes ${stat.sg < 0 ? 'lost' : 'gained'} (${fmtSg(stat.sg, 1)}).`;
  const caveat = stat.thin
    ? `Only ${plural(stat.shots, 'shot')}, so treat it as a hint: it needs ${MIN_SHOTS_FOR_QUALITY} to mean much.`
    : null;
  return { headline, detail, caveat };
}

export type LadderRung = { quality: number; strokesPerRound: number; shots: number; band: string };

/**
 * What each score means over a whole round on a par-`par` course. A round of S shots at quality q
 * loses L = (100 − q)/100 × S strokes, and S = par + L, so L = k·par / (1 − k) with k = (100 − q)/100.
 */
export function qualityLadder(par = 72, rungs: readonly number[] = [110, 105, 100, 95, 90, 85, 80, 75]): LadderRung[] {
  return rungs.map((quality) => {
    const k = (SCRATCH_QUALITY - quality) / QUALITY_PER_SG_SHOT;
    const lost = (k * par) / (1 - k);
    return { quality, strokesPerRound: lost, shots: par + lost, band: qualityBand(quality) };
  });
}
