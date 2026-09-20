import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rounds } from '@/db/schema';
import { parseRoundDetailsPatch } from '@/lib/rounds/details';

/** Update a round's name / commentary / mentality / date played. Shots are untouched, so no SG recompute. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roundId: string }> }) {
  const { roundId: roundIdParam } = await params;
  const roundId = Number(roundIdParam);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ error: 'Invalid round id' }, { status: 400 });
  }

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

  const updated = db.update(rounds).set(parsed.patch).where(eq(rounds.id, roundId)).returning().get();
  if (!updated) return NextResponse.json({ error: 'Round not found' }, { status: 404 });

  return NextResponse.json({
    name: updated.name,
    notes: updated.notes,
    playedOn: updated.playedOn,
    mentalBalance: updated.mentalBalance,
    mentalTempo: updated.mentalTempo,
    mentalTension: updated.mentalTension,
  });
}
