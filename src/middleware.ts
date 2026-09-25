/**
 * Optimistic gate: no session cookie -> /login (pages) or 401 (API). This only
 * checks that a cookie EXISTS; the real check is `getSessionUser()` in each page
 * and `requireApiUser()` in each route handler, so a forged cookie gets nothing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PUBLIC = [/^\/login(\/|$)/, /^\/join\//, /^\/api\/auth(\/|$)/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (getSessionCookie(req)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Static assets that must load without a session: the sign-in page's artwork (every season), and
  // everything a home-screen install fetches (manifest + icons).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icon-192.png|icon-512.png|manifest.webmanifest|golf-scene-).*)'],
};
