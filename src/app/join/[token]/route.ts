/**
 * The WhatsApp link: `/join/<INVITE_TOKEN>`. A valid token sets a short-lived
 * cookie that the sign-up gate (`mayCreateAccount`) reads, then sends the person to the sign-in
 * page (Google, or a link by email). An invalid token gets nothing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { INVITE_COOKIE, isValidInvite } from '@/lib/auth/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = isValidInvite(decodeURIComponent(token));

  const dest = new URL('/login', req.url);
  dest.searchParams.set(valid ? 'invited' : 'error', valid ? '1' : 'bad_invite');
  const res = NextResponse.redirect(dest);

  if (valid) {
    res.cookies.set(INVITE_COOKIE, decodeURIComponent(token), {
      httpOnly: true,
      sameSite: 'lax', // must survive the redirect back from Google (a top-level GET)
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // a day is plenty to finish signing in
    });
  }
  return res;
}
