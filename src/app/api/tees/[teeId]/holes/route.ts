import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser, requireTeeEditor, toErrorResponse } from '@/lib/auth/guards';
import { validateParsedStructure } from '@/lib/import/validate-parsed-sheet';
import { applyTeeHoleEdits, type HoleEdit } from '@/lib/rounds/tee-edit';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ teeId: string }> }) {
  try {
    const { teeId: teeIdParam } = await params;
    const teeId = Number(teeIdParam);
    if (!Number.isInteger(teeId)) {
      return NextResponse.json({ error: 'Invalid teeId' }, { status: 400 });
    }

    const user = await requireApiUser();
    await requireTeeEditor(teeId, user); // creator or admin, and locked once others have played the tee

    const body = (await req.json()) as { holes?: HoleEdit[] };
    const holes = body.holes ?? [];

    // Reuse the same structural checks the importer runs — a typo that
    // duplicates a stroke index or drops a hole should be visible immediately,
    // not silently saved. (`yards` is required by the shared type but unused
    // by this check, so it's stubbed.)
    const errors = validateParsedStructure(holes.map((h) => ({ ...h, yards: {} })));
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    const { roundsRecomputed } = await db.transaction((tx) => applyTeeHoleEdits(tx, teeId, holes));
    return NextResponse.json({ ok: true, roundsRecomputed });
  } catch (e) {
    return toErrorResponse(e);
  }
}
