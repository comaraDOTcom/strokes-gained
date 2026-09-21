/**
 * Editing a tee's holes (par / stroke index / yardage) after rounds have been
 * played on it.
 *
 * A round stores only its `teeId`; shot 1 of each hole copied the hole's yardage
 * into `start_yards` when it was entered, and `computeHole` REFUSES to run if
 * shot 1's start disagrees with the hole's yardage. So a naive UPDATE of
 * `tee_holes.yards` used to make every existing round on that tee unrecomputable
 * (and the shot-save that triggered it would fail after committing).
 *
 * `applyTeeHoleEdits` keeps everything consistent, in the caller's transaction:
 *   1. write the new hole values;
 *   2. for each hole whose YARDAGE changed, rewrite shot 1's start on every round
 *      on this tee and re-derive the rest of that hole's chain (`propagateChain`);
 *   3. recompute SG for every round that a changed yardage OR par touches
 *      (par changes reclassify shots, so stored categories would go stale).
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { rounds, shots, teeHoles } from '../../db/schema';
import { recomputeRound } from '../sg/recompute';
import { propagateChain } from './chain';

export type HoleEdit = { holeNo: number; par: number; strokeIndex: number | null; yards: number };

export async function applyTeeHoleEdits(
  tx: Tx,
  teeId: number,
  edits: readonly HoleEdit[],
): Promise<{ roundsRecomputed: number }> {
  const before = new Map((await tx.select().from(teeHoles).where(eq(teeHoles.teeId, teeId))).map((h) => [h.holeNo, h]));

  const yardsChanged = new Set<number>();
  const anyChanged = new Set<number>();
  for (const e of edits) {
    const old = before.get(e.holeNo);
    if (!old) continue; // this endpoint edits existing holes only
    if (old.yards !== e.yards) yardsChanged.add(e.holeNo);
    if (old.yards !== e.yards || old.par !== e.par) anyChanged.add(e.holeNo);
    await tx
      .update(teeHoles)
      .set({ par: e.par, strokeIndex: e.strokeIndex, yards: e.yards })
      .where(and(eq(teeHoles.teeId, teeId), eq(teeHoles.holeNo, e.holeNo)));
  }
  if (anyChanged.size === 0) return { roundsRecomputed: 0 };

  const teeRounds = await tx.select({ id: rounds.id }).from(rounds).where(eq(rounds.teeId, teeId));
  if (teeRounds.length === 0) return { roundsRecomputed: 0 };
  const roundIds = teeRounds.map((r) => r.id);

  const newYards = new Map(edits.map((e) => [e.holeNo, e.yards]));

  for (const holeNo of yardsChanged) {
    const yards = newYards.get(holeNo)!;
    const holeShots = await tx
      .select()
      .from(shots)
      .where(and(inArray(shots.roundId, roundIds), eq(shots.holeNo, holeNo)))
      .orderBy(asc(shots.roundId), asc(shots.shotNo));

    const byRound = new Map<number, typeof holeShots>();
    for (const s of holeShots) (byRound.get(s.roundId) ?? byRound.set(s.roundId, []).get(s.roundId)!).push(s);

    for (const chain of byRound.values()) {
      const first = chain[0];
      if (!first || first.shotNo !== 1) continue;
      // Shot 1 always starts on the TEE at the hole's yardage; a stroke-and-distance
      // shot 1 also ends where it started.
      const rebased = { ...first, startYards: yards };
      if (rebased.penaltyType === 'STROKE_AND_DISTANCE') {
        rebased.endLie = rebased.startLie;
        rebased.endYards = yards;
      }
      chain[0] = rebased;
      await tx
        .update(shots)
        .set({ startYards: rebased.startYards, endLie: rebased.endLie, endYards: rebased.endYards })
        .where(eq(shots.id, first.id));

      for (const t of propagateChain(chain, 0)) {
        await tx
          .update(shots)
          .set({ startLie: t.startLie, startYards: t.startYards, endLie: t.endLie, endYards: t.endYards })
          .where(eq(shots.id, t.id));
      }
    }
  }

  for (const id of roundIds) await recomputeRound(id, tx);
  return { roundsRecomputed: roundIds.length };
}
