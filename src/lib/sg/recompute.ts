/**
 * Recomputes and persists SG for every shot in a round. Called on every
 * shot mutation (Phase 3) and by `pnpm sg:recompute --all` after a baseline
 * edit. This is the only place `shots.sg` / `.category` / `.baseline_id`
 * are written — never set directly by a form handler.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { rounds, shots, teeHoles, type Shot } from '../../db/schema';
import { computeHole, type ShotInput, type PenaltyType } from './compute';
import { yardsToFeet } from '../units';
import { BASELINE_ID, type Lie } from './baseline-scratch';

function toShotInput(shot: Shot): ShotInput {
  const startLie = shot.startLie as Lie;
  const endLie = shot.endLie as Lie | null;
  return {
    holeNo: shot.holeNo,
    shotNo: shot.shotNo,
    startLie,
    startDistance: startLie === 'GREEN' ? yardsToFeet(shot.startYards) : shot.startYards,
    endLie,
    endDistance: endLie === 'GREEN' ? yardsToFeet(shot.endYards) : shot.endYards,
    holed: shot.holed,
    penaltyStrokes: shot.penaltyStrokes,
    penaltyType: shot.penaltyType as PenaltyType,
  };
}

export function recomputeRound(roundId: number): void {
  const round = db.select().from(rounds).where(eq(rounds.id, roundId)).get();
  if (!round) throw new Error(`recomputeRound: round ${roundId} not found`);

  const holes = db.select().from(teeHoles).where(eq(teeHoles.teeId, round.teeId)).all();
  const holesByNo = new Map(holes.map((h) => [h.holeNo, h]));

  const allShots = db.select().from(shots).where(eq(shots.roundId, roundId)).all();
  const byHole = new Map<number, Shot[]>();
  for (const shot of allShots) {
    const list = byHole.get(shot.holeNo) ?? [];
    list.push(shot);
    byHole.set(shot.holeNo, list);
  }

  db.transaction((tx) => {
    for (const [holeNo, holeShots] of byHole) {
      const teeHole = holesByNo.get(holeNo);
      if (!teeHole) {
        throw new Error(
          `recomputeRound: no tee_holes row for hole ${holeNo} on tee ${round.teeId} (round ${roundId})`,
        );
      }

      const sorted = [...holeShots].sort((a, b) => a.shotNo - b.shotNo);
      const results = computeHole(sorted.map(toShotInput), teeHole.yards, teeHole.par);

      for (const result of results) {
        const original = sorted.find((s) => s.shotNo === result.shotNo);
        if (!original) continue;
        tx.update(shots)
          .set({
            sg: result.sg,
            category: result.category,
            bunkerSubtype: result.bunkerSubtype,
            baselineId: BASELINE_ID,
          })
          .where(eq(shots.id, original.id))
          .run();
      }
    }
  });
}

export function recomputeAllRounds(): number {
  const allRounds = db.select().from(rounds).all();
  for (const round of allRounds) {
    recomputeRound(round.id);
  }
  return allRounds.length;
}
