/**
 * "I've seen the welcome tour" — a cookie, not a column: it's a per-browser convenience, and the
 * tour only ever appears unasked to a player with no rounds, so nothing important rides on it.
 */
import { NextResponse } from 'next/server';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { WELCOME_COOKIE } from '@/lib/learn/onboarding';

export async function POST() {
  try {
    await requireApiUser();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(WELCOME_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (e) {
    return toErrorResponse(e);
  }
}
