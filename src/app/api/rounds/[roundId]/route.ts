import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rounds } from '@/db/schema';
import { requireApiUser, requireRoundOwner, toErrorResponse } from '@/lib/auth/guards';
import { parseRoundDetailsPatch } from '@/lib/rounds/details';

/** Update a round's name / commentary / mentality / date played. Owner only. Shots are untouched, so no SG recompute. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  try {
    const { roundId: roundIdParam } = await params;
    const roundId = Number(roundIdParam);
    if (!Number.isInteger(roundId)) {
      return NextResponse.json({ error: 'Invalid round id' }, { status: 400 });
    }

    const user = await requireApiUser();
    await requireRoundOwner(roundId, user);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
    }

    const parsed = parseRoundDetailsPatch(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (Object.keys(parsed.patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const [updated] = await db.update(rounds).set(parsed.patch).where(eq(rounds.id, roundId)).returning();
    if (!updated) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

    return NextResponse.json({
      name: updated.name,
      notes: updated.notes,
      playedOn: updated.playedOn,
      playingHandicap: updated.playingHandicap,
      mentalBalance: updated.mentalBalance,
      mentalTempo: updated.mentalTempo,
      mentalTension: updated.mentalTension,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** Delete a round and (by FK cascade) all its shots. Owner only — the admin can see others'
 * rounds but not remove them. Irreversible; the UI asks for confirmation first. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  try {
    const { roundId: roundIdParam } = await params;
    const roundId = Number(roundIdParam);
    if (!Number.isInteger(roundId)) {
      return NextResponse.json({ error: 'Invalid round id' }, { status: 400 });
    }

    const user = await requireApiUser();
    await requireRoundOwner(roundId, user);

    await db.delete(rounds).where(eq(rounds.id, roundId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
