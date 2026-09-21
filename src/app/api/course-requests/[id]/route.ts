import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { courseRequests } from '@/db/schema';
import { HttpError, requireApiUser, toErrorResponse } from '@/lib/auth/guards';

/** Admin only: mark a request done (or reopen it). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    if (!user.isAdmin) throw new HttpError(404, 'Not found');
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const { status } = (await req.json().catch(() => ({}))) as { status?: unknown };
    if (status !== 'open' && status !== 'done') {
      return NextResponse.json({ error: "status must be 'open' or 'done'" }, { status: 400 });
    }
    const [row] = await db.update(courseRequests).set({ status }).where(eq(courseRequests.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id, status: row.status });
  } catch (e) {
    return toErrorResponse(e);
  }
}
