/**
 * Scorecards and eclectics. Pure.
 *
 *  - A round's card: gross score per hole (finished holes only), with SG, and — when the round
 *    has a playing handicap and the tee has a full set of stroke indexes — net and Stableford.
 *  - A course's ECLECTIC: every round's card side by side, plus the best ("low") and worst
 *    ("high") score made on each hole. Only meaningful within one course.
 */
import type { EnrichedShot } from './aggregate';

export type CardHoleMeta = { holeNo: number; par: number; strokeIndex: number | null };

export type CardHole = CardHoleMeta & {
  /** Gross strokes incl. penalties; null until the hole is finished. */
  score: number | null;
  toPar: number | null;
  sg: number | null;
  strokesReceived: number | null;
  points: number | null;
};

export type ScoreTone = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'worse' | 'none';

export function scoreTone(toPar: number | null): ScoreTone {
  if (toPar === null) return 'none';
  if (toPar <= -2) return 'eagle';
  if (toPar === -1) return 'birdie';
  if (toPar === 0) return 'par';
  if (toPar === 1) return 'bogey';
  if (toPar === 2) return 'double';
  return 'worse';
}

/** Handicap strokes received on a hole (WHS allocation by stroke index; plus-handicaps give strokes back). */
export function strokesReceived(playingHandicap: number, strokeIndex: number): number {
  if (playingHandicap >= 0) {
    return Math.floor(playingHandicap / 18) + (strokeIndex <= playingHandicap % 18 ? 1 : 0);
  }
  // Plus handicap: give a stroke back on the EASIEST holes first (SI 18, 17, …).
  const give = -playingHandicap;
  return -(Math.floor(give / 18) + (strokeIndex > 18 - (give % 18) ? 1 : 0));
}

export function stablefordPoints(par: number, gross: number, received: number): number {
  return Math.max(0, 2 + par + received - gross);
}

export type RoundCard = {
  holes: CardHole[]; // always the tee's full set of holes, in order
  front: Totals;
  back: Totals;
  overall: Totals;
  /** True when net/points could be worked out (handicap given AND every hole has a stroke index). */
  hasHandicapScoring: boolean;
};
export type Totals = { par: number; score: number | null; holesPlayed: number; points: number | null; sg: number; net: number | null };

export function buildRoundCard(
  meta: readonly CardHoleMeta[],
  roundShots: readonly EnrichedShot[],
  playingHandicap: number | null = null,
): RoundCard {
  const ordered = [...meta].sort((a, b) => a.holeNo - b.holeNo);
  const fullSi = ordered.length > 0 && ordered.every((h) => h.strokeIndex !== null);
  const hasHandicapScoring = playingHandicap !== null && fullSi;

  const byHole = new Map<number, EnrichedShot[]>();
  for (const s of roundShots) (byHole.get(s.holeNo) ?? byHole.set(s.holeNo, []).get(s.holeNo)!).push(s);

  const holes: CardHole[] = ordered.map((m) => {
    const hs = byHole.get(m.holeNo) ?? [];
    const finished = hs.some((s) => s.holed);
    const score = finished ? hs.length + hs.reduce((a, s) => a + s.penaltyStrokes, 0) : null;
    const received = hasHandicapScoring ? strokesReceived(playingHandicap!, m.strokeIndex!) : null;
    return {
      ...m,
      score,
      toPar: score === null ? null : score - m.par,
      sg: hs.length ? hs.reduce((a, s) => a + s.sg, 0) : null,
      strokesReceived: received,
      points: score !== null && received !== null ? stablefordPoints(m.par, score, received) : null,
    };
  });

  const totals = (hs: CardHole[]): Totals => {
    const played = hs.filter((h) => h.score !== null);
    const score = played.length ? played.reduce((a, h) => a + h.score!, 0) : null;
    return {
      par: hs.reduce((a, h) => a + h.par, 0),
      score,
      holesPlayed: played.length,
      points: hasHandicapScoring && played.length ? played.reduce((a, h) => a + (h.points ?? 0), 0) : null,
      sg: hs.reduce((a, h) => a + (h.sg ?? 0), 0),
      net: hasHandicapScoring && score !== null ? score - played.reduce((a, h) => a + (h.strokesReceived ?? 0), 0) : null,
    };
  };

  return {
    holes,
    front: totals(holes.filter((h) => h.holeNo <= 9)),
    back: totals(holes.filter((h) => h.holeNo > 9)),
    overall: totals(holes),
    hasHandicapScoring,
  };
}

// ---------------------------------------------------------------------------
// Eclectic
// ---------------------------------------------------------------------------

export type EclecticRow = { roundId: number; title: string; playedOn: string; scores: (number | null)[]; total: number | null; holesPlayed: number };

export type Eclectic = {
  holes: { holeNo: number; par: number }[];
  rows: EclecticRow[]; // newest first, as given
  low: (number | null)[];
  high: (number | null)[];
  /** Sum of the best score on every hole — only when every hole has been finished at least once. */
  eclecticTotal: number | null;
  eclecticToPar: number | null;
  holesCovered: number;
};

export function buildEclectic(
  holes: readonly { holeNo: number; par: number }[],
  rounds: readonly { roundId: number; title: string; playedOn: string; card: RoundCard }[],
): Eclectic {
  const ordered = [...holes].sort((a, b) => a.holeNo - b.holeNo);
  const rows: EclecticRow[] = rounds.map((r) => {
    const scores = ordered.map((h) => r.card.holes.find((c) => c.holeNo === h.holeNo)?.score ?? null);
    const played = scores.filter((s): s is number => s !== null);
    return {
      roundId: r.roundId,
      title: r.title,
      playedOn: r.playedOn,
      scores,
      holesPlayed: played.length,
      total: played.length === ordered.length ? played.reduce((a, b) => a + b, 0) : null,
    };
  });
  const col = (i: number) => rows.map((r) => r.scores[i]).filter((s): s is number => s !== null && s !== undefined);
  const low = ordered.map((_, i) => (col(i).length ? Math.min(...col(i)) : null));
  const high = ordered.map((_, i) => (col(i).length ? Math.max(...col(i)) : null));
  const covered = low.filter((s) => s !== null).length;
  const complete = ordered.length > 0 && covered === ordered.length;
  const eclecticTotal = complete ? (low as number[]).reduce((a, b) => a + b, 0) : null;
  return {
    holes: ordered,
    rows,
    low,
    high,
    eclecticTotal,
    eclecticToPar: eclecticTotal === null ? null : eclecticTotal - ordered.reduce((a, h) => a + h.par, 0),
    holesCovered: covered,
  };
}
