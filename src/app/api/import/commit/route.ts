import { NextRequest, NextResponse } from 'next/server';
import { toSeedCourse, type TeeMeta } from '@/lib/import/validate-parsed-sheet';
import type { ParsedHole } from '@/lib/import/parse-course-sheet';
import { validateCourseChecksums } from '@/db/checksum';
import { insertCourse } from '@/db/insert-course';
import { db } from '@/db/client';
import { courses } from '@/db/schema';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';

type CommitBody = {
  courseName: string;
  location: string;
  holes: ParsedHole[];
  teeMeta: TeeMeta[];
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await req.json()) as Partial<CommitBody>;

    if (!body.courseName?.trim()) {
      return NextResponse.json({ error: 'Course name is required' }, { status: 400 });
    }
    if (!body.teeMeta || body.teeMeta.length === 0) {
      return NextResponse.json({ error: 'At least one tee is required' }, { status: 400 });
    }
    if (!body.holes || body.holes.length === 0) {
      return NextResponse.json({ error: 'No holes to import' }, { status: 400 });
    }

    const seedCourse = toSeedCourse(body.courseName.trim(), body.location ?? '', body.holes, body.teeMeta);

    // Reject on failed checksum with a row-by-row (here: tee-by-tee) report,
    // same validator `db:seed` uses — nothing is written on failure.
    const errors = validateCourseChecksums(seedCourse);
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    // The course library is shared, so a second "Sunningdale" would just confuse everyone's picker.
    const existing = await db.select({ name: courses.name }).from(courses);
    const dupe = existing.find((c) => c.name.trim().toLowerCase() === seedCourse.name.trim().toLowerCase());
    if (dupe) {
      return NextResponse.json(
        { error: `"${dupe.name}" is already in the course library — pick it when you log a round instead of importing it again.` },
        { status: 409 },
      );
    }

    const courseId = await insertCourse(seedCourse, user.id);
    return NextResponse.json({ courseId });
  } catch (e) {
    return toErrorResponse(e);
  }
}
