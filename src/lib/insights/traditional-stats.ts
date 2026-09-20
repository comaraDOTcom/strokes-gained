/**
 * Traditional scorecard stats (GIR, putts, fairways hit, up-and-down, sand
 * save), computed per BUILD.md ("Phase 4 — Dashboard / Traditional stats,
 * derived — not entered"). Every one of these is a PURE function of the
 * shots already logged in Phase 3 — no new input fields, and they must
 * never be able to disagree with the shot log (same rule as hole score).
 *
 * Definitions (verbatim from BUILD.md):
 * - GIR: true iff some shot has endLie === 'GREEN' (or is holed directly
 *   onto/into the green) with shotNo <= par - 2. Par 3 requires the tee
 *   shot itself; par 5 allows 3 shots.
 * - Putts: count(shots where startLie === 'GREEN').
 * - Fairway hit: only defined for par 4/5 (par 3 -> null). True iff the tee
 *   shot's endLie === 'FAIRWAY'.
 * - Up-and-down: only attempted when GIR is false. True iff, from the first
 *   shot with startLie !== 'GREEN' after missing the green, the hole is
 *   completed in exactly 2 more shots (chip/pitch + 1 putt, or straight in)
 *   and gross score on that hole is par or better.
 * - Sand save: the up-and-down subset where the shot right after missing
 *   the green started in SAND. Same par-or-better condition.
 *
 * INTERPRETATION NOTE on "exactly 2 more shots (chip/pitch + 1 putt, or
 * straight in)": read literally, "exactly 2" and "straight in" (which is 1
 * shot, not 2) are in tension. We resolve this the way every mainstream
 * golf stat tracker does: a hole-out chip ("straight in") is at least as
 * good a save as chip+putt, so up-and-down is converted when the shots
 * taken from the miss point to the end of the hole is <= 2 (not
 * "exactly" 2), combined with the gross-score-par-or-better condition.
 * This is called out explicitly here (and in the top-level report) rather
 * than silently narrowed to a stricter "exactly 2" reading that would
 * wrongly exclude chip-ins from the successful-save count.
 */
import type { Lie } from '../sg/baseline-scratch';

export type TraditionalStatShot = {
  shotNo: number;
  startLie: Lie;
  endLie: Lie | null;
  holed: boolean;
  penaltyStrokes: number;
};

export type UpDownStat = { attempted: boolean; converted: boolean };

export type HoleTraditionalStats = {
  holeNo: number;
  par: number;
  grossScore: number;
  /** null only when the hole's regulation window hasn't finished yet (partial entry). */
  gir: boolean;
  putts: number;
  /** null for par 3 (no fairway stat) or for a hole still being entered. */
  fairwayHit: boolean | null;
  upAndDown: UpDownStat;
  sandSave: UpDownStat;
};

/**
 * Computes traditional stats for one hole from its shots (in any order —
 * they are sorted here by shotNo) and the hole's par.
 */
export function computeHoleTraditionalStats(
  holeNo: number,
  shots: TraditionalStatShot[],
  par: number,
): HoleTraditionalStats {
  const sorted = [...shots].sort((a, b) => a.shotNo - b.shotNo);
  const grossScore = sorted.length + sorted.reduce((sum, s) => sum + s.penaltyStrokes, 0);

  const regulationShots = par - 2;

  const gir = sorted.some((s) => s.shotNo <= regulationShots && (s.endLie === 'GREEN' || s.holed));

  const putts = sorted.filter((s) => s.startLie === 'GREEN').length;

  let fairwayHit: boolean | null = null;
  if (par >= 4) {
    const teeShot = sorted.find((s) => s.shotNo === 1);
    fairwayHit = teeShot ? teeShot.endLie === 'FAIRWAY' : null;
  }

  const upAndDown: UpDownStat = { attempted: false, converted: false };
  const sandSave: UpDownStat = { attempted: false, converted: false };

  // Only meaningful once the regulation window has actually closed — i.e.
  // we've seen at least `regulationShots` shots (or the hole finished
  // earlier, in which case gir is true and none of this applies). This
  // guards against a mid-entry hole (fewer shots logged so far than the
  // regulation count) being prematurely flagged as a missed-green attempt.
  const regulationWindowClosed = sorted.length >= regulationShots || sorted.some((s) => s.holed);

  if (!gir && regulationWindowClosed) {
    const missShotNo = regulationShots + 1;
    const missShot = sorted.find((s) => s.shotNo === missShotNo);

    if (missShot) {
      upAndDown.attempted = true;
      if (missShot.startLie === 'SAND') sandSave.attempted = true;

      const holeFinished = sorted[sorted.length - 1]?.holed === true;
      if (holeFinished) {
        const shotsFromMiss = sorted.length - missShotNo + 1;
        const converted = shotsFromMiss <= 2 && grossScore <= par;
        upAndDown.converted = converted;
        if (missShot.startLie === 'SAND') sandSave.converted = converted;
      }
    }
  }

  return { holeNo, par, grossScore, gir, putts, fairwayHit, upAndDown, sandSave };
}

export type RoundTraditionalStats = {
  girCount: number;
  girTotal: number;
  putts: number;
  fairwaysHit: number;
  fairwaysTotal: number;
  upAndDown: { attempted: number; converted: number };
  sandSave: { attempted: number; converted: number };
  grossScore: number;
};

/** Sums per-hole stats into round-level (or, given every hole in the DB, multi-round) totals. */
export function aggregateTraditionalStats(holes: HoleTraditionalStats[]): RoundTraditionalStats {
  const agg: RoundTraditionalStats = {
    girCount: 0,
    girTotal: holes.length,
    putts: 0,
    fairwaysHit: 0,
    fairwaysTotal: 0,
    upAndDown: { attempted: 0, converted: 0 },
    sandSave: { attempted: 0, converted: 0 },
    grossScore: 0,
  };

  for (const h of holes) {
    if (h.gir) agg.girCount++;
    agg.putts += h.putts;
    if (h.fairwayHit !== null) {
      agg.fairwaysTotal++;
      if (h.fairwayHit) agg.fairwaysHit++;
    }
    if (h.upAndDown.attempted) {
      agg.upAndDown.attempted++;
      if (h.upAndDown.converted) agg.upAndDown.converted++;
    }
    if (h.sandSave.attempted) {
      agg.sandSave.attempted++;
      if (h.sandSave.converted) agg.sandSave.converted++;
    }
    agg.grossScore += h.grossScore;
  }

  return agg;
}
