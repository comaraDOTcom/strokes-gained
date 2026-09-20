/**
 * Per-hole strokes-gained computation. See BUILD.md ("Phase 1 — SG engine")
 * for the exact contract this file implements.
 */
import { expectedStrokes } from './interpolate';
import { categoriseShot, type BunkerSubtype, type Category } from './categorise';
import type { Lie } from './baseline-scratch';

export type PenaltyType = null | 'LATERAL' | 'STROKE_AND_DISTANCE';

export type ShotInput = {
  holeNo: number;
  shotNo: number;
  startLie: Lie;
  startDistance: number; // display units (feet on green, yards otherwise)
  endLie: Lie | null; // null lie + holed=true when holed
  endDistance: number;
  holed: boolean;
  penaltyStrokes: number; // 0 or 1
  penaltyType: PenaltyType;
};

export type ShotSG = {
  holeNo: number;
  shotNo: number;
  startLie: Lie;
  startDistance: number;
  endLie: Lie | null;
  endDistance: number;
  holed: boolean;
  penaltyStrokes: number;
  penaltyType: PenaltyType;
  sg: number;
  category: Category;
  bunkerSubtype: BunkerSubtype | null;
  /**
   * Penalty strokes on this shot, surfaced separately from `sg` so a blow-up
   * shows as damage to the causing shot's category rather than silently
   * inflating (e.g.) approach numbers when aggregated.
   */
  penaltyStrokesLost: number;
};

const EPS = 1e-9;

function sameSpot(lieA: Lie | null, distA: number, lieB: Lie | null, distB: number): boolean {
  return lieA === lieB && Math.abs(distA - distB) < EPS;
}

/**
 * Expected strokes from a (lie, distance) position, where a holed-out
 * position (lie === null) is by definition 0 strokes remaining.
 */
function expectedFrom(lie: Lie | null, distance: number): number {
  if (lie === null) return 0;
  return expectedStrokes(lie, distance);
}

export function computeHole(shots: ShotInput[], holeYards: number, par: number): ShotSG[] {
  if (shots.length === 0) {
    throw new Error('computeHole: shots must not be empty');
  }

  const sorted = [...shots].sort((a, b) => a.shotNo - b.shotNo);

  const holeNo = sorted[0]!.holeNo;
  for (const shot of sorted) {
    if (shot.holeNo !== holeNo) {
      throw new Error(
        `computeHole: mixed holeNo in shots array (expected ${holeNo}, got ${shot.holeNo})`,
      );
    }
  }
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.shotNo !== i + 1) {
      throw new Error(
        `computeHole: broken shot sequence — expected shotNo ${i + 1}, got ${sorted[i]!.shotNo}`,
      );
    }
  }

  const first = sorted[0]!;
  if (first.startLie !== 'TEE') {
    throw new Error(
      `computeHole: shot 1 must start from TEE, got ${first.startLie}`,
    );
  }
  if (Math.abs(first.startDistance - holeYards) >= EPS) {
    throw new Error(
      `computeHole: shot 1 startDistance (${first.startDistance}) must equal holeYards (${holeYards})`,
    );
  }

  const results: ShotSG[] = [];
  let prevEndLie: Lie | null = null;
  let prevEndDistance = 0;
  let prevHoled = false;

  for (let i = 0; i < sorted.length; i++) {
    const shot = sorted[i]!;

    if (i > 0) {
      if (prevHoled) {
        throw new Error(
          `computeHole: shot ${shot.shotNo} follows a holed shot — the hole was already finished`,
        );
      }
      if (!sameSpot(prevEndLie, prevEndDistance, shot.startLie, shot.startDistance)) {
        throw new Error(
          `computeHole: broken chain — shot ${shot.shotNo}'s start (${shot.startLie} ${shot.startDistance}) ` +
            `does not match shot ${shot.shotNo - 1}'s end (${prevEndLie ?? 'HOLED'} ${prevEndDistance})`,
        );
      }
    }

    if (shot.holed && shot.endLie !== null) {
      throw new Error(
        `computeHole: shot ${shot.shotNo} is holed but has a non-null endLie (${shot.endLie})`,
      );
    }
    if (!shot.holed && shot.endLie === null) {
      throw new Error(
        `computeHole: shot ${shot.shotNo} has a null endLie but is not marked holed`,
      );
    }

    // STROKE_AND_DISTANCE is enforced here, not left to the caller/UI: the
    // shot replays from the exact spot it started, so it always costs a
    // full stroke-plus-penalty (2.0 with penaltyStrokes = 1).
    let endLie: Lie | null;
    let endDistance: number;
    let holed: boolean;
    if (shot.penaltyType === 'STROKE_AND_DISTANCE') {
      endLie = shot.startLie;
      endDistance = shot.startDistance;
      holed = false;
    } else {
      endLie = shot.endLie;
      endDistance = shot.endDistance;
      holed = shot.holed;
    }

    const startExpected = expectedStrokes(shot.startLie, shot.startDistance);
    const endExpected = holed ? 0 : expectedFrom(endLie, endDistance);
    const sg = startExpected - endExpected - 1 - shot.penaltyStrokes;

    const { category, bunkerSubtype } = categoriseShot(shot.startLie, shot.startDistance, par);

    results.push({
      holeNo: shot.holeNo,
      shotNo: shot.shotNo,
      startLie: shot.startLie,
      startDistance: shot.startDistance,
      endLie: holed ? null : endLie,
      endDistance,
      holed,
      penaltyStrokes: shot.penaltyStrokes,
      penaltyType: shot.penaltyType,
      sg,
      category,
      bunkerSubtype,
      penaltyStrokesLost: shot.penaltyStrokes,
    });

    prevEndLie = holed ? null : endLie;
    prevEndDistance = endDistance;
    prevHoled = holed;
  }

  // Invariant: sum(SG) === E('TEE', holeYards) - grossScore, where
  // grossScore = shots.length + sum(penaltyStrokes). This only holds — and
  // only needs to hold — once the hole is finished (last shot holed out);
  // a partial hole (mid-entry) is allowed to compute a running SG total
  // without this check.
  const last = results[results.length - 1]!;
  if (last.holed) {
    const sumSg = results.reduce((acc, r) => acc + r.sg, 0);
    const grossScore = results.length + results.reduce((acc, r) => acc + r.penaltyStrokes, 0);
    const expectedTotal = expectedStrokes('TEE', holeYards) - grossScore;
    if (Math.abs(sumSg - expectedTotal) > 1e-6) {
      throw new Error(
        `computeHole: invariant violated — sum(SG)=${sumSg} but E(TEE,${holeYards})-grossScore=${expectedTotal}`,
      );
    }
  }

  return results;
}
