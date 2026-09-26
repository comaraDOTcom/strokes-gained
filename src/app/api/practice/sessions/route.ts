import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { parseSessionEntry } from '@/lib/practice/entry';
import { todayInIreland } from '@/lib/practice/progress';
import { logSession } from '@/lib/practice/sessions';

/** Log a practice session: one drill, one score. Pass/fail is worked out on the server. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
    }
    // A day's grace past Irish time, so a player abroad can log "today" wherever they are.
    const tomorrow = todayInIreland(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const parsed = parseSessionEntry(body, tomorrow);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const row = await logSession(user.id, parsed);
    return NextResponse.json(row);
  } catch (e) {
    return toErrorResponse(e);
  }
}
