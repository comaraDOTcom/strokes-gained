import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { isAdminEmail } from './config';

const TEST_MODE = process.env.AUTH_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Admin = ADMIN_EMAIL *and* a verified email (an unverified address proves nothing). */
  isAdmin: boolean;
};

/** The signed-in user, or null. Safe to call from any Server Component or route handler. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    // Test mode's email sign-up can't verify an address, so let it stand in there — it is
    // hard-disabled in production, where only a Google-verified ADMIN_EMAIL is the admin.
    isAdmin: (Boolean(u.emailVerified) || TEST_MODE) && isAdminEmail(u.email),
  };
}

/** For pages: the signed-in user, or redirect to /login. */
export async function requirePageUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}
