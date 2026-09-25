import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { courses } from '@/db/schema';
import { HttpError, requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { directoryCourse } from '@/lib/directory';

/**
 * Admin only: link a scorecard course to its course-directory entry (or unlink with null), so
 * rounds logged there count the directory course as played for everyone who played it.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireApiUser();
    if (!user.isAdmin) throw new HttpError(404, 'Not found');
    const id = Number((await params).courseId);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const { directoryKey } = (await req.json().catch(() => ({}))) as { directoryKey?: unknown };
    if (directoryKey !== null && (typeof directoryKey !== 'string' || !directoryCourse(directoryKey))) {
      return NextResponse.json({ error: 'directoryKey must be a course in the directory, or null' }, { status: 400 });
    }
    const [row] = await db.update(courses).set({ directoryKey }).where(eq(courses.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id: row.id, directoryKey: row.directoryKey });
  } catch (e) {
    return toErrorResponse(e);
  }
}
