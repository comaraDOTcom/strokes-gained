import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { rounds } from '@/db/schema';

type CreateRoundBody = {
  courseId: number;
  teeId: number;
  playedOn: string; // YYYY-MM-DD
  weather?: string;
  notes?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<CreateRoundBody>;

  if (!body.courseId || !body.teeId || !body.playedOn) {
    return NextResponse.json({ error: 'courseId, teeId and playedOn are required' }, { status: 400 });
  }

  const round = db
    .insert(rounds)
    .values({
      courseId: body.courseId,
      teeId: body.teeId,
      playedOn: body.playedOn,
      weather: body.weather ?? null,
      notes: body.notes ?? null,
    })
    .returning()
    .get();

  return NextResponse.json({ roundId: round.id });
}
