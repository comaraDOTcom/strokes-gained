/**
 * Add or edit a shot's RESULT. Per BUILD.md, the user only ever taps a
 * shot's result — the start is always derived server-side (shot 1: TEE at
 * the hole's yardage; shot n: shot n-1's end), never accepted from the
 * client. That structurally rules out most broken-chain bugs before they
 * can happen.
 *
 * Only the round's owner may write (see `requireRoundOwner`).
 *
 * Editing a past shot re-submits it here with the same (holeNo, shotNo) and
 * changes it IN PLACE: later shots keep the results the user entered, and
 * their starts are re-derived from the edited shot (see `propagateChain`).
 * The one exception is marking the edited shot HOLED — nothing can follow a
 * holed shot, so anything after it is removed.
 *
 * The write and the SG recompute happen in ONE transaction, so a shot can
 * never be committed without its derived SG (or vice versa).
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from '@/db/client';
import { shots } from '@/db/schema';
import { requireApiUser, requireRoundOwner, toErrorResponse } from '@/lib/auth/guards';
import { recomputeRound } from '@/lib/sg/recompute';
import { parseShotTags } from '@/lib/rounds/entry';
import { saveShotResult } from '@/lib/rounds/save-shot';
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
  /** Optional tags; omitted on an edit = leave the stored value alone. */
  focus?: unknown;
  commitment?: unknown;
  missDirection?: unknown;
  puttSlope?: unknown;
  puttBreak?: unknown;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  try {
    const { roundId: roundIdParam } = await params;
    const roundId = Number(roundIdParam);
    if (!Number.isInteger(roundId)) {
      return NextResponse.json({ error: 'Invalid roundId' }, { status: 400 });
    }

    const user = await requireApiUser();
    const round = await requireRoundOwner(roundId, user);

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

    const tags = parseShotTags({
      focus: body.focus,
      commitment: body.commitment,
      missDirection: body.missDirection,
      puttSlope: body.puttSlope,
      puttBreak: body.puttBreak,
    });
    if (!tags.ok) return NextResponse.json({ error: tags.error }, { status: 400 });

    const outcome = await db.transaction((tx) =>
      saveShotResult(tx, round, {
        holeNo,
        shotNo,
        endLie: body.endLie ?? null,
        endDistance: body.endDistance ?? 0,
        holed: Boolean(holed),
        penaltyStrokes: penaltyStrokes ?? 0,
        penaltyType: penaltyType ?? null,
        tags,
      }),
    );

    if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: 400 });
    return NextResponse.json({ shots: outcome.shots });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * Deletes shot `shotNo` and everything after it in `holeNo` — "undo the
 * last shot" without having to re-supply a replacement result.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  try {
    const { roundId: roundIdParam } = await params;
    const roundId = Number(roundIdParam);
    if (!Number.isInteger(roundId)) {
      return NextResponse.json({ error: 'Invalid roundId' }, { status: 400 });
    }

    const user = await requireApiUser();
    await requireRoundOwner(roundId, user); // also 404s a round that doesn't exist

    const body = (await req.json()) as { holeNo?: number; shotNo?: number };
    const { holeNo, shotNo } = body;
    if (!holeNo || !shotNo) {
      return NextResponse.json({ error: 'holeNo and shotNo are required' }, { status: 400 });
    }

    const remaining = await db.transaction(async (tx) => {
      await tx
        .delete(shots)
        .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo), gte(shots.shotNo, shotNo)));

      const left = await tx
        .select()
        .from(shots)
        .where(and(eq(shots.roundId, roundId), eq(shots.holeNo, holeNo)))
        .orderBy(asc(shots.shotNo));

      // Only recompute if something's left on this hole; other holes are unaffected.
      if (left.length > 0) await recomputeRound(roundId, tx);
      return left;
    });

    return NextResponse.json({ shots: remaining });
  } catch (e) {
    return toErrorResponse(e);
  }
}
