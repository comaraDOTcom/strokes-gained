import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rounds, tees } from '@/db/schema';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { parseRoundDetailsPatch } from '@/lib/rounds/details';

type CreateRoundBody = {
  courseId: number;
  teeId: number;
  playedOn: string; // YYYY-MM-DD
  weather?: string;
  notes?: string;
  name?: string;
  /** Open the mentality inputs by default for this round? Omitted = yes. */
  trackMentality?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json()) as Partial<CreateRoundBody>;

    if (!body.courseId || !body.teeId || !body.playedOn) {
      return NextResponse.json({ error: 'courseId, teeId and playedOn are required' }, { status: 400 });
    }

    // The tee must belong to the course — previously nothing checked this.
    const [tee] = await db
      .select({ id: tees.id })
      .from(tees)
      .where(and(eq(tees.id, body.teeId), eq(tees.courseId, body.courseId)));
    if (!tee) return NextResponse.json({ error: 'That tee does not belong to that course' }, { status: 400 });

    // Same validation/trimming as the PATCH route (name and date are optional/validated).
    const details = parseRoundDetailsPatch({
      playedOn: body.playedOn,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.trackMentality !== undefined && { trackMentality: body.trackMentality }),
    });
    if (!details.ok) return NextResponse.json({ error: details.error }, { status: 400 });

    const [round] = await db
      .insert(rounds)
      .values({
        userId: user.id,
        courseId: body.courseId,
        teeId: body.teeId,
        playedOn: details.patch.playedOn ?? body.playedOn,
        weather: body.weather ?? null,
        notes: body.notes ?? null,
        name: details.patch.name ?? null,
        trackMentality: details.patch.trackMentality ?? true,
      })
      .returning();

    return NextResponse.json({ roundId: round!.id });
  } catch (e) {
    return toErrorResponse(e);
  }
}
