import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, requirePracticeSessionOwner, toErrorResponse } from '@/lib/auth/guards';
import { deleteSession } from '@/lib/practice/sessions';

/** Delete one of your own practice sessions. Anyone else's is a 404. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const id = await requirePracticeSessionOwner(Number((await params).id), user);
    await deleteSession(user.id, id);
    return NextResponse.json({ id });
  } catch (e) {
    return toErrorResponse(e);
  }
}
