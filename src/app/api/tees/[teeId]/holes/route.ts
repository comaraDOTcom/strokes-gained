import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { teeHoles } from '@/db/schema';
import { validateParsedStructure } from '@/lib/import/validate-parsed-sheet';

type HoleUpdate = { holeNo: number; par: number; strokeIndex: number | null; yards: number };

export async function PUT(req: NextRequest, { params }: { params: Promise<{ teeId: string }> }) {
  const { teeId: teeIdParam } = await params;
  const teeId = Number(teeIdParam);
  if (!Number.isInteger(teeId)) {
    return NextResponse.json({ error: 'Invalid teeId' }, { status: 400 });
  }

  const body = (await req.json()) as { holes?: HoleUpdate[] };
  const holes = body.holes ?? [];

  // Reuse the same structural checks the importer runs — a typo that
  // duplicates a stroke index or drops a hole should be visible immediately,
  // not silently saved. (`yards` is required by the shared type but unused
  // by this check, so it's stubbed.)
  const errors = validateParsedStructure(holes.map((h) => ({ ...h, yards: {} })));
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  db.transaction((tx) => {
    for (const hole of holes) {
      tx.update(teeHoles)
        .set({ par: hole.par, strokeIndex: hole.strokeIndex, yards: hole.yards })
        .where(and(eq(teeHoles.teeId, teeId), eq(teeHoles.holeNo, hole.holeNo)))
        .run();
    }
  });

  return NextResponse.json({ ok: true });
}
