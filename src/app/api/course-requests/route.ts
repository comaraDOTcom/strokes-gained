import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { courseRequests } from '@/db/schema';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { MAX_OPEN_REQUESTS_PER_USER, parseCourseRequest } from '@/lib/courses/requests';
import { notifyAdmin } from '@/lib/notify';

/** Any signed-in player can ask for a course to be added. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
    }
    const parsed = parseCourseRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const open = await db
      .select({ id: courseRequests.id })
      .from(courseRequests)
      .where(and(eq(courseRequests.userId, user.id), eq(courseRequests.status, 'open')));
    if (open.length >= MAX_OPEN_REQUESTS_PER_USER) {
      return NextResponse.json(
        { error: `You already have ${open.length} requests waiting — give us a chance to add those first.` },
        { status: 429 },
      );
    }

    const [row] = await db
      .insert(courseRequests)
      .values({ userId: user.id, courseName: parsed.courseName, details: parsed.details })
      .returning();

    await notifyAdmin(
      `Course request: ${parsed.courseName}`,
      `${user.name} <${user.email}> asked for a course to be added.\n\nCourse: ${parsed.courseName}\nDetails: ${parsed.details ?? '—'}\n\nOpen requests: ${process.env.BETTER_AUTH_URL ?? ''}/courses`,
    );

    return NextResponse.json({ id: row!.id });
  } catch (e) {
    return toErrorResponse(e);
  }
}
