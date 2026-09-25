import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { parsePlayedToggle, setPlayed } from '@/lib/directory/queries';

/** Tick a directory course off as played, or un-tick it. Only ever the caller's own list. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireApiUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
    }
    const parsed = parsePlayedToggle(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    await setPlayed(user.id, parsed.key, parsed.played);
    return NextResponse.json({ key: parsed.key, played: parsed.played });
  } catch (e) {
    return toErrorResponse(e);
  }
}
