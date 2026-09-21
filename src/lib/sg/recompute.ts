/**
 * Recomputes and persists SG for every shot in a round. Called on every
 * shot mutation (Phase 3) and by `pnpm sg:recompute --all` after a baseline
 * edit. This is the only place `shots.sg` / `.category` / `.baseline_id`
 * are written — never set directly by a form handler.
 */
import { eq } from 'drizzle-orm';
import { db, type DbOrTx } from '../../db/client';
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

/**
 * Recompute one round. Pass `conn` (a transaction) to make the recompute part of
 * the caller's transaction — the shot-save routes do, so a shot and its SG commit
 * atomically. Without `conn` it opens its own transaction, so its reads and writes
 * are one consistent snapshot.
 *
 * Only rows whose derived values actually changed are written: a whole-round
 * recompute on every shot save would otherwise be ~100 network round trips.
 */
export async function recomputeRound(roundId: number, conn?: DbOrTx): Promise<void> {
  if (conn) return recomputeWith(conn, roundId);
  await db.transaction((tx) => recomputeWith(tx, roundId));
}

async function recomputeWith(conn: DbOrTx, roundId: number): Promise<void> {
  const [round] = await conn.select().from(rounds).where(eq(rounds.id, roundId));
  if (!round) throw new Error(`recomputeRound: round ${roundId} not found`);

  const holes = await conn.select().from(teeHoles).where(eq(teeHoles.teeId, round.teeId));
  const holesByNo = new Map(holes.map((h) => [h.holeNo, h]));

  const allShots = await conn.select().from(shots).where(eq(shots.roundId, roundId));
  const byHole = new Map<number, Shot[]>();
  for (const shot of allShots) {
    const list = byHole.get(shot.holeNo) ?? [];
    list.push(shot);
    byHole.set(shot.holeNo, list);
  }

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
      if (
        original.sg === result.sg &&
        original.category === result.category &&
        original.bunkerSubtype === result.bunkerSubtype &&
        original.baselineId === BASELINE_ID
      ) {
        continue;
      }
      await conn
        .update(shots)
        .set({
          sg: result.sg,
          category: result.category,
          bunkerSubtype: result.bunkerSubtype,
          baselineId: BASELINE_ID,
        })
        .where(eq(shots.id, original.id));
    }
  }
}

export async function recomputeAllRounds(): Promise<number> {
  const allRounds = await db.select({ id: rounds.id }).from(rounds);
  for (const round of allRounds) {
    await recomputeRound(round.id);
  }
  return allRounds.length;
}
