/**
 * Add or edit a shot's RESULT. Per BUILD.md, the user only ever taps a
 * shot's result — the start is always derived server-side (shot 1: TEE at
 * the hole's yardage; shot n: shot n-1's end), never accepted from the
 * client. That structurally rules out most broken-chain bugs before they
 * can happen.
 *
 * Editing a past shot re-submits it here with the same (holeNo, shotNo) and
 * changes it IN PLACE: later shots keep the results the user entered, and
 * their starts are re-derived from the edited shot (see `propagateChain`).
 * The one exception is marking the edited shot HOLED — nothing can follow a
 * holed shot, so anything after it is removed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gt, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { rounds, shots, teeHoles } from '@/db/schema';
import { recomputeRound } from '@/lib/sg/recompute';
import { feetToYards } from '@/lib/units';
import { parseShotTags } from '@/lib/rounds/entry';
import { propagateChain } from '@/lib/rounds/chain';
import type { Lie } from '@/lib/sg/baseline-scratch';
import type { PenaltyType } from '@/lib/sg/compute';

type ShotResultBody = {
  holeNo: number;
  shotNo: number;
  endLie: Lie | null;
  /** display units — feet if endLie is GREEN, yards otherwise. Ignored when holed. */
  endDistance: number;
  holed: boolean;
  penaltyStrokes: number;
  penaltyType: PenaltyType;
  /** Optional mentality tags; omitted on an edit = leave the stored value alone. */
  focus?: unknown;
  commitment?: unknown;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId: roundIdParam } = await params;
  const roundId = Number(roundIdParam);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ error: 'Invalid roundId' }, { status: 400 });
  }

  const body = (await req.json()) as Partial<ShotResultBody>;
  const { holeNo, shotNo, holed, penaltyStrokes, penaltyType } = body;
  if (!holeNo || !shotNo) {
    return NextResponse.json({ error: 'holeNo and shotNo are required' }, { status: 400 });
  }
  // endLie is required UNLESS the shot is holed, or it's stroke-and-distance
  // (end is auto-derived from start in that case — the client correctly
  // sends no endLie for it, so this can't require one).
  if (!holed && penaltyType !== 'STROKE_AND_DISTANCE' && !body.endLie) {
    return NextResponse.json({ error: 'endLie is required unless the shot is holed' }, { status: 400 });
  }

  const tags = parseShotTags({ focus: body.focus, commitment: body.commitment });
  if (!tags.ok) return NextResponse.json({ error: tags.error }, { status: 400 });

  const round = db.select().from(rounds).where(eq(rounds.id, roundId)).get();
  if (!round) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

  const teeHole = db
    .select()
    .from(teeHoles)
    .where(and(eq(teeHoles.teeId, round.teeId), eq(teeHoles.holeNo, holeNo)))
    .get();
  if (!teeHole) return NextResponse.json({ error: `No tee_holes row for hole ${holeNo}` }, { status: 400 });

  // Derive this shot's START from the chain — never from the client.
  let startLie: Lie;
  let startYards: number;
  if (shotNo === 1) {
    startLie = 'TEE';
    startYards = teeHole.yards;
  } else {
    const prev = db
      .select()
      .from(shots)
      .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), eq(shots.shotNo, shotNo - 1)))
      .get();
    if (!prev) {
      return NextResponse.json({ error: `Shot ${shotNo - 1} hasn't been entered yet for hole ${holeNo}` }, { status: 400 });
    }
    if (prev.holed) {
      return NextResponse.json({ error: `Hole ${holeNo} was already finished at shot ${shotNo - 1}` }, { status: 400 });
    }
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
    const lie = body.endLie as Lie;
    endLie = lie;
    endYards = lie === 'GREEN' ? feetToYards(body.endDistance ?? 0) : (body.endDistance ?? 0);
    finalHoled = false;
  }

  const existing = db
    .select()
    .from(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), eq(shots.shotNo, shotNo)))
    .get();

  db.transaction((tx) => {
    if (!existing) {
      tx.insert(shots)
        .values({
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
          focus: tags.focus ?? null,
          commitment: tags.commitment ?? null,
        })
        .run();
      return;
    }

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
      focus: tags.focus === undefined ? existing.focus : tags.focus,
      commitment: tags.commitment === undefined ? existing.commitment : tags.commitment,
    };
    tx.update(shots).set(updated).where(eq(shots.id, existing.id)).run();

    // Re-derive every later shot's start from this one (and drop them if this shot is now holed).
    const chain = tx
      .select()
      .from(shots)
      .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gte(shots.shotNo, shotNo)))
      .orderBy(asc(shots.shotNo))
      .all();
    chain[0] = updated;
    const tail = propagateChain(chain, 0);
    if (updated.holed) {
      tx.delete(shots).where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gt(shots.shotNo, shotNo))).run();
    }
    for (const t of tail) {
      tx.update(shots)
        .set({ startLie: t.startLie, startYards: t.startYards, endLie: t.endLie, endYards: t.endYards })
        .where(eq(shots.id, t.id))
        .run();
    }
  });

  recomputeRound(roundId);

  const holeShots = db
    .select()
    .from(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo)))
    .all()
    .sort((a, b) => a.shotNo - b.shotNo);

  return NextResponse.json({ shots: holeShots });
}

/**
 * Deletes shot `shotNo` and everything after it in `holeNo` — "undo the
 * last shot" without having to re-supply a replacement result.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId: roundIdParam } = await params;
  const roundId = Number(roundIdParam);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ error: 'Invalid roundId' }, { status: 400 });
  }

  const body = (await req.json()) as { holeNo?: number; shotNo?: number };
  const { holeNo, shotNo } = body;
  if (!holeNo || !shotNo) {
    return NextResponse.json({ error: 'holeNo and shotNo are required' }, { status: 400 });
  }

  db.delete(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gte(shots.shotNo, shotNo)))
    .run();

  const remaining = db
    .select()
    .from(shots)
    .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo)))
    .all();

  // Only recompute if something's left — recomputeRound would otherwise
  // just skip this hole (no rows), which is fine either way, but avoids an
  // unnecessary transaction when the hole is now empty.
  if (remaining.length > 0) recomputeRound(roundId);

  return NextResponse.json({ shots: remaining.sort((a, b) => a.shotNo - b.shotNo) });
}
