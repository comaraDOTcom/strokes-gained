/**
 * Save a shot's RESULT (add or edit), in the caller's transaction. Moved out of
 * the shots API route so it can be tested against a real database (vitest has no
 * `@/` alias, so route handlers can't be imported in tests; `tee-edit.ts` is the
 * same split).
 *
 * The start is always derived server-side: shot 1 starts on the TEE at the hole's
 * yardage, shot n at shot n-1's end. Editing a past shot changes it IN PLACE;
 * later shots keep the results the user entered and their starts are re-derived
 * (`propagateChain`), except that marking a shot HOLED removes everything after it.
 *
 * Tags (focus, commitment, miss direction, putt slope/break) are stored with the
 * shot and never feed SG. They're normalised against the shot they end up on, so
 * an edit that turns a putt into a chip clears its putt tags rather than failing.
 */
import { and, asc, eq, gt, gte } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { shots, teeHoles, type Shot } from '../../db/schema';
import type { Lie } from '../sg/baseline-scratch';
import type { PenaltyType } from '../sg/compute';
import { recomputeRound } from '../sg/recompute';
import { feetToYards } from '../units';
import { propagateChain } from './chain';
import { normaliseShotTags, SHOT_TAG_KEYS, type ShotTags, type StoredShotTags, type TagContext } from './entry';

export type ShotResultInput = {
  holeNo: number;
  shotNo: number;
  endLie: Lie | null;
  /** Display units: feet if endLie is GREEN, yards otherwise. Ignored when holed. */
  endDistance: number;
  holed: boolean;
  penaltyStrokes: number;
  penaltyType: PenaltyType;
  /** Already value-checked by `parseShotTags`. */
  tags: ShotTags;
};

function mergeTags(stored: StoredShotTags | null, sent: ShotTags): StoredShotTags {
  const out = {} as Record<(typeof SHOT_TAG_KEYS)[number], string | null>;
  for (const k of SHOT_TAG_KEYS) {
    const v = sent[k];
    out[k] = v === undefined ? (stored ? stored[k] : null) : v;
  }
  return out as StoredShotTags;
}

function storedTags(row: Shot): StoredShotTags {
  return {
    focus: row.focus,
    commitment: row.commitment,
    missDirection: row.missDirection,
    puttSlope: row.puttSlope,
    puttBreak: row.puttBreak,
  } as StoredShotTags;
}

export async function saveShotResult(
  tx: DbOrTx,
  round: { id: number; teeId: number },
  input: ShotResultInput,
): Promise<{ shots: Shot[] } | { error: string }> {
  const roundId = round.id;
  const { holeNo, shotNo, holed, penaltyStrokes, penaltyType } = input;

  const [teeHole] = await tx
    .select()
    .from(teeHoles)
    .where(and(eq(teeHoles.teeId, round.teeId), eq(teeHoles.holeNo, holeNo)));
  if (!teeHole) return { error: `No tee_holes row for hole ${holeNo}` };

  // Derive this shot's START from the chain — never from the client.
  let startLie: Lie;
  let startYards: number;
  if (shotNo === 1) {
    startLie = 'TEE';
    startYards = teeHole.yards;
  } else {
    const [prev] = await tx
      .select()
      .from(shots)
      .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), eq(shots.shotNo, shotNo - 1)));
    if (!prev) return { error: `Shot ${shotNo - 1} hasn't been entered yet for hole ${holeNo}` };
    if (prev.holed) return { error: `Hole ${holeNo} was already finished at shot ${shotNo - 1}` };
    startLie = prev.endLie as Lie;
    startYards = prev.endYards;
  }

  // STROKE_AND_DISTANCE is enforced here too (defence in depth — compute.ts
  // enforces it again at recompute time regardless of what's stored).
  let endLie: Lie | null;
  let endYards: number;
  let finalHoled: boolean;
  if (penaltyType === 'STROKE_AND_DISTANCE') {
    endLie = startLie;
    endYards = startYards;
    finalHoled = false;
  } else if (holed) {
    endLie = null;
    endYards = 0;
    finalHoled = true;
  } else {
    endLie = input.endLie;
    endYards = endLie === 'GREEN' ? feetToYards(input.endDistance ?? 0) : (input.endDistance ?? 0);
    finalHoled = false;
  }

  const ctx: TagContext = { startLie, par: teeHole.par, endLie, holed: finalHoled, penaltyType: penaltyType ?? null };

  const [existing] = await tx
    .select()
    .from(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), eq(shots.shotNo, shotNo)));

  const tagResult = normaliseShotTags(mergeTags(existing ? storedTags(existing) : null, input.tags), ctx);
  if (!tagResult.ok) return { error: tagResult.error };
  const tags = tagResult.tags;

  if (!existing) {
    await tx.insert(shots).values({
      roundId,
      holeNo,
      shotNo,
      startLie,
      startYards,
      endLie,
      endYards,
      holed: finalHoled,
      penaltyStrokes: penaltyStrokes ?? 0,
      penaltyType: penaltyType ?? null,
      ...tags,
    });
  } else {
    // Edit in place. Tags that weren't sent keep their stored value.
    const updated = {
      ...existing,
      startLie,
      startYards,
      endLie,
      endYards,
      holed: finalHoled,
      penaltyStrokes: penaltyStrokes ?? 0,
      penaltyType: penaltyType ?? null,
      ...tags,
    };
    await tx.update(shots).set(updated).where(eq(shots.id, existing.id));

    // Re-derive every later shot's start from this one (and drop them if this shot is now holed).
    const chain = await tx
      .select()
      .from(shots)
      .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gte(shots.shotNo, shotNo)))
      .orderBy(asc(shots.shotNo));
    chain[0] = updated;
    const tail = propagateChain(chain, 0);
    if (updated.holed) {
      await tx.delete(shots).where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gt(shots.shotNo, shotNo)));
    }
    for (const t of tail) {
      // A later shot's tags stay, unless its new start makes a group meaningless (it's no longer a putt).
      const norm = normaliseShotTags(storedTags(t), {
        startLie: t.startLie as Lie,
        par: teeHole.par,
        endLie: t.endLie as Lie | null,
        holed: t.holed,
        penaltyType: t.penaltyType,
      });
      // A miss that no longer fits (e.g. now a tee-style miss) is dropped rather than failing the edit.
      const tailTags = norm.ok ? norm.tags : { ...storedTags(t), missDirection: null };
      await tx
        .update(shots)
        .set({
          startLie: t.startLie,
          startYards: t.startYards,
          endLie: t.endLie,
          endYards: t.endYards,
          missDirection: tailTags.missDirection,
          puttSlope: tailTags.puttSlope,
          puttBreak: tailTags.puttBreak,
        })
        .where(eq(shots.id, t.id));
    }
  }

  await recomputeRound(roundId, tx);

  const holeShots = await tx
    .select()
    .from(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo)))
    .orderBy(asc(shots.shotNo));
  return { shots: holeShots };
}
